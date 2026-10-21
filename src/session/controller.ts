// One sparring session, without any UI. The teacher plays one side of the corner from the book (the
// engine once off book), the owner plays the other side, and every owner move is judged. The Spar
// screen subscribes to the state and calls ownerPlay / retry / playOn / switchTo.
//
// Frames: the book is canonical (studied corner upper right); the board is that frame turned by `sym`.
// Book moves are turned by `sym` before they are played, the owner's taps turned back before they are
// matched against the book, and notes have their coordinates turned with orientNote.

import { startPosition } from '../book/setups'
import type { Book, BookNode, FamilyId } from '../book/types'
import type { CornerAnalysis, TeacherEngine } from '../engine/teacher'
import { BOARD_SIZE, inRegion, inverse, parseGtp, transform, type Move, type Pt, type Region, type Sym } from '../go/coords'
import { otherColor, play, type Color, type Position } from '../go/rules'
import { bookChild, isSound, judgeMove, type Thresholds, type Verdict } from './judge'
import { orientNote } from './orient'
import { mulberry32, pickTeacherMove } from './pick'
import { drillableSides, ownerColor, type Side } from './sides'

export { DEFAULT_THRESHOLDS, type Thresholds, type Verdict } from './judge'
export type { Side } from './sides'

/** The longest any engine call is waited for; after that the move is unjudged (or the teacher stops). */
export const ENGINE_TIMEOUT_MS = 8000
/** Moves played off the book, by either side, before the session ends. */
const MAX_OFF_BOOK = 6
/** Off book, the teacher leaves the corner (and ends the session) when elsewhere is this much bigger. */
const TENUKI_MARGIN = 1.0
/** Off book, the teacher picks at random among corner moves this close to the best one. */
const NEAR_BEST = 0.5
/** The book was checked with KataGo's Chinese rules, which give White +4 in the 4-stone setup (R9). */
const HANDICAP_BONUS = 4
/** Big points away from the studied corner (canonical frame): where a tenuki goes when the engine has none. */
const BIG_POINTS: Pt[] = ['D10', 'K4', 'C14', 'N3', 'C6', 'F3', 'F17', 'R7', 'G10', 'K7'].map(parseGtp)

const MESSAGES = {
  occupied: 'There’s already a stone there.',
  suicide: 'That stone would have no liberties. Try another point.',
  ko: 'Ko: you can’t take back right away. Play somewhere else first.',
  engineLoading: 'The engine is still loading, so the teacher can’t answer off the book yet. This session ends here.',
  engineFailed: 'The engine couldn’t answer this position, so this session ends here.',
  noMove: 'The teacher has no move here, so this session ends here.',
}

export interface SessionResult {
  /** The drilled pattern, or in free sparring the one pattern whose line was reached. */
  patternIds: string[]
  side: Side
  clean: boolean
  mistakes: number
  pointsLost: number
  /** Book positions (node keys) where the owner went wrong. */
  missedKeys: string[]
}

export type LogEntry = { move: Move | { tenuki: Color }; by: 'owner' | 'teacher'; verdict?: Verdict }

export interface SparState {
  pos: Position
  /** The setup's komi (the engine is asked with the R9 bonus on top). */
  komi: number
  region: Region
  /** The book node of the last move; null once off book. Its own `note` is in the book's frame: show `note` below. */
  node: BookNode | null
  offBookMoves: number
  status: 'teacher-thinking' | 'owner-to-move' | 'stopped' | 'done'
  lastVerdict: Verdict | null
  log: LogEntry[]
  result: SessionResult | null
  message: string | null
  /** The note on `node`'s move with its coordinates turned to the board; null off book. */
  note: string | null
}

export interface SparConfig {
  mode: 'drill' | 'free'
  family: FamilyId
  patternId?: string
  side: Side
  sym: Sym
  seed: number
  thresholds: Thresholds
  /** Node keys the owner missed before; free sparring steers toward them. */
  missed: Set<string>
}

type Cached = { pos: Position; analysis: Promise<CornerAnalysis> }
type Undo = Pick<SparState, 'pos' | 'node' | 'offBookMoves' | 'log' | 'note'> & { lastBook: BookNode | null; cached: Cached | null }

/** The value, or null if the call rejects or takes longer than ENGINE_TIMEOUT_MS. */
function timed<T>(p: Promise<T>): Promise<T | null> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), ENGINE_TIMEOUT_MS)
    const done = (v: T | null) => {
      clearTimeout(timer)
      resolve(v)
    }
    p.then(done, () => done(null))
  })
}

/** Starts an engine call. A throw becomes a rejection, and a rejection nobody awaits is never unhandled. */
function ask<T>(call: () => Promise<T>): Promise<T> {
  let p: Promise<T>
  try {
    p = call()
  } catch (err) {
    p = Promise.reject(err)
  }
  p.catch(() => {})
  return p
}

function legal(pos: Position, p: Pt, color: Color): boolean {
  return !('illegal' in play(pos, p, color))
}

function round1(x: number): number {
  return Math.round(x * 10) / 10
}

export class SparController {
  private readonly book: Book
  private readonly engine: TeacherEngine
  private readonly listeners = new Set<(s: SparState) => void>()
  private s!: SparState
  private cfg!: SparConfig
  private owner!: Color
  private engineKomi!: number
  private drillPath: BookNode[] | undefined
  private rng!: () => number
  /** Bumped on every restart, so an engine answer for an old session is dropped. */
  private gen = 0
  private started = false
  private cached: Cached | null = null
  private undo: Undo | null = null
  /** The last book node on the line actually played (free sparring credits its pattern). */
  private lastBook: BookNode | null = null
  private mistakes = 0
  private lost = 0
  private misses = new Set<string>()

  constructor(book: Book, engine: TeacherEngine, config: SparConfig) {
    this.book = book
    this.engine = engine
    this.reset({ ...config })
  }

  get state(): SparState {
    return this.s
  }

  subscribe(fn: (s: SparState) => void): () => void {
    this.listeners.add(fn)
    return () => {
      this.listeners.delete(fn)
    }
  }

  async start(): Promise<void> {
    if (this.started) return
    this.started = true
    await this.next(this.gen)
  }

  async ownerPlay(p: Pt | 'tenuki'): Promise<void> {
    if (this.s.status !== 'owner-to-move') return
    const { pos, node, region, log, offBookMoves } = this.s
    const gen = this.gen
    let tapped: Position | null = null
    if (p !== 'tenuki') {
      if (![p.x, p.y].every((v) => Number.isInteger(v) && v >= 0 && v < BOARD_SIZE)) return
      const r = play(pos, p, this.owner)
      if ('illegal' in r) {
        this.set({ message: MESSAGES[r.illegal] })
        return
      }
      tapped = r.pos
    }
    // A tap outside the corner is a tenuki played on that point.
    const played = p !== 'tenuki' && inRegion(p, region) ? transform(p, inverse(this.cfg.sym)) : 'tenuki'
    const undo: Undo = { pos, node, offBookMoves, log, note: this.s.note, lastBook: this.lastBook, cached: this.cached }
    const engineState = this.engine.status()
    this.set({ status: 'teacher-thinking', message: null, lastVerdict: null })

    const after = tapped ?? this.place(pos, this.tenukiPoint(pos, await this.analysisOf(pos), this.owner), this.owner)
    if (gen !== this.gen) return
    const child = node ? bookChild(node, played) : null
    const verdict = await this.judge(node, child, played, pos, after, engineState)
    if (gen !== this.gen) return

    if (verdict.type === 'mistake') {
      this.mistakes++
      if (node && node.key !== '') this.misses.add(node.key)
    }
    if ((verdict.type === 'mistake' || verdict.type === 'fine-offbook') && verdict.pointsLost !== null) this.lost += verdict.pointsLost
    if (child) this.lastBook = child
    const last = after.history[after.history.length - 1]
    const stop = verdict.type === 'mistake' || verdict.type === 'other-joseki'
    if (stop) this.undo = undo
    this.set({
      pos: after,
      node: child,
      offBookMoves: offBookMoves + (child ? 0 : 1),
      log: [...log, { move: played === 'tenuki' ? { tenuki: this.owner } : last, by: 'owner', verdict }],
      lastVerdict: verdict,
      note: this.noteOf(child),
      ...(stop ? { status: 'stopped' as const } : {}),
    })
    if (!stop) await this.next(gen)
  }

  /** After a stopped move: back to the position before it, as if it was never played. */
  retry(): void {
    if (this.s.status !== 'stopped' || !this.undo) return
    const { lastBook, cached, ...state } = this.undo
    this.undo = null
    this.lastBook = lastBook
    this.cached = cached
    this.ownerTurn({ ...state, lastVerdict: null, message: null })
  }

  /** After a stopped move: keep it, and the teacher answers (the book's punishment line, or the engine). */
  async playOn(): Promise<void> {
    if (this.s.status !== 'stopped') return
    this.undo = null
    await this.next(this.gen)
  }

  /** Starts over as a drill of `patternId`, same side and symmetry. Throws if it cannot be drilled from this side. */
  switchTo(patternId: string): void {
    const entry = Object.hasOwn(this.book.patterns, patternId) ? this.book.patterns[patternId] : undefined
    if (!entry) throw new Error(`Unknown pattern "${patternId}"`)
    this.reset({ ...this.cfg, mode: 'drill', patternId, family: entry.family })
    this.started = true
    this.next(this.gen).catch((err: unknown) => {
      console.error('[spar] restart failed', err)
      this.finish(MESSAGES.noMove)
    })
  }

  /** Checks the config and sets up a fresh session. Changes nothing if it throws. */
  private reset(cfg: SparConfig): void {
    const { book } = this
    if (cfg.mode === 'drill') {
      if (cfg.patternId === undefined) throw new Error('A drill needs a pattern to drill')
      if (!drillableSides(book, cfg.patternId).includes(cfg.side)) {
        throw new Error(`Pattern "${cfg.patternId}" can't be drilled from the ${cfg.side} side`)
      }
    }
    const start = startPosition(book, cfg.family, cfg.patternId ?? null, cfg.sym)
    const fam = book.families[cfg.family]
    const entry = cfg.patternId === undefined ? undefined : book.patterns[cfg.patternId]
    const setup = entry?.def.setup ?? fam.def.setup

    this.gen++
    this.cfg = cfg
    this.owner = ownerColor(fam.def, cfg.side)
    this.engineKomi = start.komi + (setup === 'handicap4' ? HANDICAP_BONUS : 0)
    this.drillPath = cfg.mode === 'drill' ? entry?.path : undefined
    this.rng = mulberry32(cfg.seed)
    this.cached = null
    this.undo = null
    this.lastBook = null
    this.mistakes = 0
    this.lost = 0
    this.misses = new Set()
    this.s = {
      pos: start.pos,
      komi: start.komi,
      region: start.region,
      node: fam.root,
      offBookMoves: 0,
      status: 'teacher-thinking',
      lastVerdict: null,
      log: [],
      result: null,
      message: null,
      note: null,
    }
    this.emit()
  }

  private set(patch: Partial<SparState>): void {
    this.s = { ...this.s, ...patch }
    this.emit()
  }

  private emit(): void {
    for (const fn of [...this.listeners]) fn(this.s)
  }

  /** Whoever is to move moves next, unless the session is over. */
  private async next(gen: number): Promise<void> {
    if (gen !== this.gen) return
    if (this.isDone()) this.finish()
    else if (this.s.pos.toMove === this.owner) this.ownerTurn()
    else await this.teacherTurn(gen)
  }

  private isDone(): boolean {
    const { node, offBookMoves } = this.s
    if (offBookMoves >= MAX_OFF_BOOK) return true
    if (!node || node.move === null) return false
    if (this.drillPath && node === this.drillPath[this.drillPath.length - 1]) return true
    // A mistake or trick at the end of a line still wants an answer.
    return node.children.length === 0 && isSound(node)
  }

  private finish(message: string | null = null): void {
    this.set({ status: 'done', message, result: this.result() })
  }

  private result(): SessionResult {
    const { cfg } = this
    return {
      patternIds: cfg.mode === 'drill' && cfg.patternId !== undefined ? [cfg.patternId] : this.reachedPattern(),
      side: cfg.side,
      clean: this.mistakes === 0,
      mistakes: this.mistakes,
      pointsLost: round1(this.lost),
      missedKeys: [...this.misses],
    }
  }

  /** Free sparring: the pattern whose main line holds the last book node reached (the most basic one if several). */
  private reachedPattern(): string[] {
    const n = this.lastBook
    if (!n || n.patternIds.length === 0) return []
    const onLine = n.patternIds.filter((id) => this.book.patterns[id]?.path.includes(n))
    const pool = onLine.length > 0 ? onLine : n.patternIds
    const order = (id: string) => this.book.patterns[id]?.def.order ?? Infinity
    return [pool.reduce((a, b) => (order(b) < order(a) ? b : a))]
  }

  /** The owner's turn: start the engine on the position now, so an off-book move is judged sooner. */
  private ownerTurn(patch: Partial<SparState> = {}): void {
    this.set({ ...patch, status: 'owner-to-move' })
    this.analyze(this.s.pos)
  }

  private async judge(
    node: BookNode | null,
    child: BookNode | null,
    played: Pt | 'tenuki',
    pos: Position,
    after: Position,
    engineState: ReturnType<TeacherEngine['status']>,
  ): Promise<Verdict> {
    let before: CornerAnalysis | null = null
    let scoreAfter: number | null = null
    // A sound book move needs no engine; a book mistake uses it for the points lost when it can.
    if (!(child && isSound(child)) && engineState === 'ready') {
      const score = timed(ask(() => this.engine.scoreFor(after, this.engineKomi, this.owner)))
      ;[before, scoreAfter] = await Promise.all([this.analysisOf(pos), score])
    }
    const { cfg } = this
    let v = judgeMove({
      node,
      played,
      mode: cfg.mode,
      drillPatternId: cfg.mode === 'drill' ? cfg.patternId : undefined,
      drillPath: this.drillPath,
      before: before && this.toCanonical(before),
      scoreAfter,
      thresholds: cfg.thresholds,
    })
    if (v.type === 'unjudged' && engineState === 'loading') v = { type: 'unjudged', reason: 'engine-loading' }
    if (v.type === 'other-joseki' && child) v = { ...v, patternIds: this.switchable(child, v.patternIds) }
    return this.toBoard(v)
  }

  /** The patterns "Switch to that pattern" can offer: the move is on their main line and they drill from this side. */
  private switchable(child: BookNode, ids: string[]): string[] {
    const ok = ids.filter(
      (id) => this.book.patterns[id]?.path.includes(child) && drillableSides(this.book, id).includes(this.cfg.side),
    )
    return ok.length > 0 ? ok : ids
  }

  private async teacherTurn(gen: number): Promise<void> {
    this.set({ status: 'teacher-thinking' })
    const node = this.s.node
    const child = node ? this.pickBook(node) : null
    if (!child) return this.engineReply(gen)

    const { pos, log } = this.s
    const color = otherColor(this.owner)
    const at = child.move!.at
    const pt = at === 'tenuki' ? this.tenukiPoint(pos, await this.analysisOf(pos), color) : transform(at, this.cfg.sym)
    if (gen !== this.gen) return
    if (!legal(pos, pt, color)) return this.finish(MESSAGES.noMove)
    const after = this.place(pos, pt, color)
    this.lastBook = child
    this.set({
      pos: after,
      node: child,
      log: [...log, { move: at === 'tenuki' ? { tenuki: color } : after.history[after.history.length - 1], by: 'teacher' }],
      note: this.noteOf(child),
    })
    await this.next(gen)
  }

  /** Drill: the drilled line; off it (a punishment line, another joseki) or in free sparring: by weight. */
  private pickBook(node: BookNode): BookNode | null {
    const opts = { missed: this.cfg.missed, rng: this.rng }
    const onPath = this.drillPath ? pickTeacherMove(node, { ...opts, mode: 'drill', drillPath: this.drillPath }) : null
    return onPath ?? pickTeacherMove(node, { ...opts, mode: 'free' })
  }

  /** The engine answers off book. If it can't, the session ends rather than waiting. */
  private async engineReply(gen: number): Promise<void> {
    const status = this.engine.status()
    if (status !== 'ready') return this.finish(status === 'loading' ? MESSAGES.engineLoading : MESSAGES.engineFailed)
    const { pos, region } = this.s
    const a = await this.analysisOf(pos)
    if (gen !== this.gen) return
    if (!a) return this.finish(MESSAGES.engineFailed)
    const color = otherColor(this.owner)
    const { cornerBest, tenukiBest } = a
    if (tenukiBest && tenukiBest.scoreLead > cornerBest.scoreLead + TENUKI_MARGIN && legal(pos, tenukiBest.pt, color)) {
      this.playEngineMove(tenukiBest.pt, color, true)
      return this.finish()
    }
    const near = a.candidates.filter((c) => c.scoreLead >= cornerBest.scoreLead - NEAR_BEST)
    const pick = near.length > 0 ? near[Math.floor(this.rng() * near.length)].pt : cornerBest.pt
    const pt = [pick, cornerBest.pt, ...a.candidates.map((c) => c.pt)].find((p) => inRegion(p, region) && legal(pos, p, color))
    if (!pt) return this.finish(MESSAGES.noMove)
    this.playEngineMove(pt, color, false)
    await this.next(gen)
  }

  /** Plays the engine's choice for the teacher, following the book if the move happens to be in it. */
  private playEngineMove(pt: Pt, color: Color, tenuki: boolean): void {
    const { pos, node, log, offBookMoves } = this.s
    const after = this.place(pos, pt, color)
    const child = node ? bookChild(node, tenuki ? 'tenuki' : transform(pt, inverse(this.cfg.sym))) : null
    if (child) this.lastBook = child
    this.set({
      pos: after,
      node: child,
      offBookMoves: offBookMoves + (child ? 0 : 1),
      log: [...log, { move: tenuki ? { tenuki: color } : after.history[after.history.length - 1], by: 'teacher' }],
      note: this.noteOf(child),
    })
  }

  /** Starts (or reuses) the engine's analysis of `pos`, if the engine is ready. Nobody waits for it here. */
  private analyze(pos: Position): Cached | null {
    if (this.engine.status() !== 'ready') return null
    if (this.cached?.pos !== pos) {
      const region = this.s.region
      this.cached = { pos, analysis: ask(() => this.engine.analyzeCorner(pos, this.engineKomi, region)) }
    }
    return this.cached
  }

  /** The engine's analysis of `pos` (board frame, from the side to move), or null: not ready, failed or too slow. */
  private analysisOf(pos: Position): Promise<CornerAnalysis | null> {
    const c = this.analyze(pos)
    return c ? timed(c.analysis) : Promise.resolve(null)
  }

  /** Where a tenuki goes: the engine's move elsewhere, else the first free big point, else any free point outside the corner. */
  private tenukiPoint(pos: Position, a: CornerAnalysis | null, color: Color): Pt {
    const ok = (p: Pt) => !inRegion(p, this.s.region) && legal(pos, p, color)
    if (a?.tenukiBest && ok(a.tenukiBest.pt)) return a.tenukiBest.pt
    const big = BIG_POINTS.map((p) => transform(p, this.cfg.sym)).find(ok)
    if (big) return big
    for (let y = 0; y < BOARD_SIZE; y++) for (let x = 0; x < BOARD_SIZE; x++) if (ok({ x, y })) return { x, y }
    throw new Error('No free point outside the corner')
  }

  private place(pos: Position, pt: Pt, color: Color): Position {
    const r = play(pos, pt, color)
    if ('illegal' in r) throw new Error(`Illegal move ${pt.x},${pt.y}: ${r.illegal}`)
    return r.pos
  }

  private noteOf(node: BookNode | null): string | null {
    return node && node.note !== '' ? orientNote(node.note, this.cfg.sym) : null
  }

  private toCanonical(a: CornerAnalysis): CornerAnalysis {
    const back = (p: Pt) => transform(p, inverse(this.cfg.sym))
    return {
      toMove: a.toMove,
      cornerBest: { ...a.cornerBest, pt: back(a.cornerBest.pt) },
      tenukiBest: a.tenukiBest && { ...a.tenukiBest, pt: back(a.tenukiBest.pt) },
      candidates: a.candidates.map((c) => ({ ...c, pt: back(c.pt) })),
    }
  }

  /** A canonical verdict on the board: points turned by `sym`, notes oriented. */
  private toBoard(v: Verdict): Verdict {
    const sym = this.cfg.sym
    const turn = (p: Pt | 'tenuki'): Pt | 'tenuki' => (p === 'tenuki' ? p : transform(p, sym))
    switch (v.type) {
      case 'good':
      case 'other-joseki':
        return { ...v, note: orientNote(v.note, sym) }
      case 'mistake':
        return { ...v, better: turn(v.better), ...(v.note === undefined ? {} : { note: orientNote(v.note, sym) }) }
      case 'fine-offbook':
        return { ...v, bookMove: v.bookMove === null ? null : turn(v.bookMove) }
      case 'unjudged':
        return v
    }
  }
}
