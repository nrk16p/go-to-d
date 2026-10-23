// One sparring session, without any UI. The teacher plays one side of the corner from the book (the
// engine once off book), the owner plays the other side, and every owner move is judged. The Spar
// screen subscribes to the state and calls ownerPlay / retry / playOn / switchTo.
//
// Frames (frame.ts): the book is canonical (studied corner upper right); the board is that frame
// turned by `sym`. Engine calls go through engineAccess.ts, what a session counts for through result.ts.
//
// Families that start the same way share their book (R42, src/book/siblings.ts): at every position the
// book's moves are the session tree's own plus those its siblings have there. A move found in a sibling
// tree is judged as book, and the session goes on in that tree, so its patterns get the credit.

import { nodeSetups } from '../book/build'
import type { CheckedLoss } from '../book/checkedLoss'
import { startPosition } from '../book/setups'
import { bookIndex, type BookIndex } from '../book/siblings'
import type { Book, BookNode, SetupId } from '../book/types'
import type { TeacherEngine } from '../engine/teacher'
import { BOARD_SIZE, inRegion, withMargin, type Pt } from '../go/coords'
import { otherColor, play, type Color, type Position } from '../go/rules'
import { EngineAccess, legal } from './engineAccess'
import { analysisToBook, lineKey, noteOn, toBoardPt, toBookPt, verdictToBoard } from './frame'
import { bookChild, isSound, judgeMove, scoreAfterNeeded, type Verdict } from './judge'
import { mulberry32, pickTeacherMove } from './pick'
import { countOwnerMove, newTally, sessionResult, switchablePatterns, type SessionResult, type Tally } from './result'
import { drillableSides, ownerColor } from './sides'
import { MESSAGES } from './messages'
import { startState, type SparConfig, type SparState } from './types'

export { ENGINE_TIMEOUT_MS } from './engineAccess'
export { DEFAULT_THRESHOLDS, type Thresholds, type Verdict } from './judge'
export type { SessionResult } from './result'
export type { Side } from './sides'
export type { LogEntry, SparConfig, SparState } from './types'

/** Moves played off the book, by either side, before the session ends. */
const MAX_OFF_BOOK = 6
/** Off book, the teacher leaves the corner (and ends the session) when elsewhere is this much bigger. */
const TENUKI_MARGIN = 1.0
/** Off book, the teacher picks at random among corner moves this close to the best one. */
const NEAR_BEST = 0.5
/** The book was checked with KataGo's Chinese rules, which give White +4 in the 4-stone setup (R9). */
const HANDICAP_BONUS = 4

type Undo = Pick<SparState, 'pos' | 'node' | 'offBookMoves' | 'log' | 'note'> & { lastBook: BookNode | null }

export interface SparOptions {
  /**
   * R29: the book check's points lost for a book node. An in-book mistake reports it instead of asking
   * the engine. The app passes `checkedLoss` (src/book/checkedLoss.ts); without it the engine decides.
   */
  bookLoss?: CheckedLoss
}

function onBoard(p: Pt): boolean {
  return [p.x, p.y].every((v) => Number.isInteger(v) && v >= 0 && v < BOARD_SIZE)
}

const lastMove = (pos: Position) => pos.history[pos.history.length - 1]

export class SparController {
  private readonly book: Book
  private readonly engine: TeacherEngine
  private readonly bookLoss: CheckedLoss | undefined
  private readonly index: BookIndex
  private disposed = false
  private readonly listeners = new Set<(s: SparState) => void>()
  private s!: SparState
  private cfg!: SparConfig
  private owner!: Color
  /** The setup this session is played in; a sibling's move counts only if it was checked in it too. */
  private setup!: SetupId
  private eng!: EngineAccess
  private drillPath: BookNode[] | undefined
  private rng!: () => number
  private tally!: Tally
  /** Bumped on every restart, so an engine answer for an old session is dropped. */
  private gen = 0
  private started = false
  private undo: Undo | null = null
  /** The last book node on the line actually played (free sparring credits its pattern). */
  private lastBook: BookNode | null = null
  /** Play went on after a stopped move off the drilled line: book moves are judged as in free sparring. */
  private leftDrill = false

  constructor(book: Book, engine: TeacherEngine, config: SparConfig, options: SparOptions = {}) {
    this.book = book
    this.engine = engine
    this.bookLoss = options.bookLoss
    this.index = bookIndex(book)
    this.reset({ ...config })
  }

  /**
   * Ends the session for good (the screen went away): engine answers still on their way are dropped,
   * a queued look-ahead never runs, nothing more is asked of the engine, and every call after this does
   * nothing. The state stays as it was. Safe to call twice.
   */
  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    this.gen++
    this.listeners.clear()
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
    if (this.started || this.disposed) return
    this.started = true
    await this.next(this.gen)
  }

  async ownerPlay(p: Pt | 'tenuki'): Promise<void> {
    if (this.s.status !== 'owner-to-move' || this.disposed) return
    const { pos, node, region, log, offBookMoves, note } = this.s
    const { sym } = this.cfg
    const gen = this.gen
    let after: Position | null = null
    if (p !== 'tenuki') {
      if (!onBoard(p)) return
      const r = play(pos, p, this.owner)
      if ('illegal' in r) {
        this.set({ message: MESSAGES[r.illegal] })
        return
      }
      after = r.pos
    }
    // A tap in the corner, its margin line included, is a corner move (R43): the margin looks and plays
    // like the corner. Only the Play elsewhere button, or a tap beyond the margin on the full board, is a
    // tenuki played on that point.
    const played = p !== 'tenuki' && inRegion(p, withMargin(region)) ? toBookPt(p, sym) : 'tenuki'
    const undo: Undo = { pos, node, offBookMoves, log, note, lastBook: this.lastBook }
    const engineState = this.engine.status()
    // The stone shows at once; its verdict follows.
    this.set({ status: 'teacher-thinking', message: null, lastVerdict: null, ...(after ? { pos: after } : {}) })
    if (!after) {
      const a = await this.eng.analysis(pos)
      if (gen !== this.gen) return
      after = this.place(pos, this.eng.tenukiPoint(pos, a, this.owner), this.owner)
      this.set({ pos: after })
    }
    const child = node ? bookChild(this.withSiblings(node), played) : null
    const tenukiAt = played === 'tenuki' ? toBookPt(lastMove(after), sym) : undefined
    const verdict = await this.judge(gen, node && this.withSiblings(node), child, played, tenukiAt, pos, after, engineState)
    if (gen !== this.gen) return

    const where = node ? `book:${node.key}` : `off:${lineKey(pos, sym)}`
    countOwnerMove(this.tally, { verdict, node, child, where, drill: this.cfg.mode === 'drill' })
    if (child) this.lastBook = child
    const stop = verdict.type === 'mistake' || verdict.type === 'other-joseki'
    if (stop) this.undo = undo
    this.set({
      node: child,
      offBookMoves: offBookMoves + (child ? 0 : 1),
      log: [...log, { move: played === 'tenuki' ? { tenuki: this.owner } : lastMove(after), by: 'owner', verdict }],
      lastVerdict: verdict,
      note: noteOn(child, sym),
      ...(stop ? { status: 'stopped' as const } : {}),
    })
    if (!stop) await this.next(gen)
  }

  /**
   * After a stopped move: back to the position, book node, log and off-book count from before it.
   * `lastVerdict` is cleared, not restored. The mistake stays counted (once per position).
   */
  retry(): void {
    if (this.s.status !== 'stopped' || !this.undo || this.disposed) return
    const { lastBook, ...state } = this.undo
    this.undo = null
    this.lastBook = lastBook
    this.ownerTurn({ ...state, lastVerdict: null, message: null })
  }

  /** After a mistake: keep it, and the teacher answers (the book's punishment line, or the engine). Not after other-joseki. */
  async playOn(): Promise<void> {
    if (this.s.status !== 'stopped' || this.s.lastVerdict?.type !== 'mistake' || this.disposed) return
    this.undo = null
    const node = this.s.node
    if (this.drillPath && !(node && this.drillPath.includes(node))) this.leftDrill = true
    await this.next(this.gen)
  }

  /**
   * Starts over as a drill of `patternId`, same side and symmetry. Returns the abandoned session's result
   * for the UI to record only if it had a mistake (then `clean: false`): switching after another joseki
   * carries no penalty (spec 1b, R27). Null too if the session had already ended and reported its result.
   * Throws, changing nothing, if the pattern is unknown or can't be drilled from this side.
   */
  switchTo(patternId: string): SessionResult | null {
    if (this.disposed) return null
    const entry = Object.hasOwn(this.book.patterns, patternId) ? this.book.patterns[patternId] : undefined
    if (!entry) throw new Error(`Unknown pattern "${patternId}"`)
    const abandoned = this.s.status !== 'done' && this.tally.mistakes.size > 0 ? this.result() : null
    this.reset({ ...this.cfg, mode: 'drill', patternId, family: entry.family })
    this.started = true
    this.next(this.gen).catch((err: unknown) => {
      console.error('[spar] restart failed', err)
      this.finish(MESSAGES.noMove)
    })
    return abandoned
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

    const gen = ++this.gen
    this.cfg = cfg
    this.owner = ownerColor(fam.def, cfg.side)
    this.setup = setup
    const komi = start.komi + (setup === 'handicap4' ? HANDICAP_BONUS : 0)
    const isCurrent = (pos: Position) => gen === this.gen && this.s.pos === pos && this.s.status === 'owner-to-move'
    this.eng = new EngineAccess(this.engine, komi, start.region, cfg.sym, isCurrent)
    this.drillPath = cfg.mode === 'drill' ? entry?.path : undefined
    this.rng = mulberry32(cfg.seed)
    this.tally = newTally()
    this.undo = null
    this.lastBook = null
    this.leftDrill = false
    this.s = startState(start, fam.root)
    this.emit()
  }

  private set(patch: Partial<SparState>): void {
    this.s = { ...this.s, ...patch }
    this.emit()
  }

  /** A listener that throws must not stop the session (or the other listeners). */
  private emit(): void {
    for (const fn of [...this.listeners]) {
      try {
        fn(this.s)
      } catch (err) {
        console.error('[spar] a state listener threw', err)
      }
    }
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
    return this.bookMoves(node).length === 0 && isSound(node)
  }

  private finish(message: string | null = null): void {
    this.set({ status: 'done', message, result: this.result() })
  }

  private result(): SessionResult {
    return sessionResult(this.book, this.cfg, this.tally, { lastBook: this.lastBook, node: this.s.node })
  }

  /** The owner's turn: start the engine on the position now, so an off-book move is judged sooner. */
  private ownerTurn(patch: Partial<SparState> = {}): void {
    this.set({ ...patch, status: 'owner-to-move' })
    this.eng.lookAhead(this.s.pos)
  }

  /** The verdict on the owner's move. If the session moves on (or ends) meanwhile, the engine is asked nothing more. */
  private async judge(
    gen: number,
    node: BookNode | null,
    child: BookNode | null,
    played: Pt | 'tenuki',
    tenukiAt: Pt | undefined,
    pos: Position,
    after: Position,
    engineState: ReturnType<TeacherEngine['status']>,
  ): Promise<Verdict> {
    const { cfg } = this
    // A sound book move needs no engine. A book mistake takes its points from the book check (R29), or
    // from the engine when the check has none for it.
    // The check's numbers are per family: a move from a sibling tree (R42) takes its own family's.
    const checked = child && !isSound(child) && this.bookLoss ? this.bookLoss(this.index.familyOf(child) ?? cfg.family, child.key) : null
    const needEngine = !(child && isSound(child)) && checked === null && engineState === 'ready'
    // The analysis of the position before the move is usually the look-ahead, already done or under way.
    // Most moves are among its candidates and are judged from it alone (R40); only a move it didn't look
    // at needs a search of the position after it.
    const analysis = needEngine ? await this.eng.analysis(pos) : null
    const before = analysis && analysisToBook(analysis, cfg.sym)
    const second = scoreAfterNeeded({ before, played, tenukiAt }) && gen === this.gen
    const scoreAfter = second ? await this.eng.score(after, this.owner) : null
    const drill = cfg.mode === 'drill' && !this.leftDrill
    let v = judgeMove({
      node,
      played,
      tenukiAt,
      mode: drill ? 'drill' : 'free',
      drillPatternId: drill ? cfg.patternId : undefined,
      drillPath: drill ? this.drillPath : undefined,
      before,
      scoreAfter,
      thresholds: cfg.thresholds,
      checkedLoss: checked,
    })
    if (v.type === 'unjudged' && engineState === 'loading') v = { type: 'unjudged', reason: 'engine-loading' }
    if (v.type === 'other-joseki' && child) v = { ...v, patternIds: switchablePatterns(this.book, child, cfg.side) }
    return verdictToBoard(v, cfg.sym)
  }

  private async teacherTurn(gen: number): Promise<void> {
    this.set({ status: 'teacher-thinking' })
    const node = this.s.node
    const child = node ? this.pickBook(node) : null
    if (!child) return this.engineReply(gen)

    const pos = this.s.pos
    const color = otherColor(this.owner)
    const at = child.move!.at
    const pt = at === 'tenuki' ? this.eng.tenukiPoint(pos, await this.eng.analysis(pos), color) : toBoardPt(at, this.cfg.sym)
    if (gen !== this.gen) return
    if (!legal(pos, pt, color)) return this.finish(MESSAGES.noMove)
    this.teacherPlays(pt, at === 'tenuki', child)
    await this.next(gen)
  }

  /** Drill: the drilled line; off it (a punishment line, another joseki) or in free sparring: by weight. */
  private pickBook(at: BookNode): BookNode | null {
    const node = this.withSiblings(at)
    const opts = { missed: this.cfg.missed, rng: this.rng }
    const onPath = this.drillPath ? pickTeacherMove(node, { ...opts, mode: 'drill', drillPath: this.drillPath }) : null
    return onPath ?? pickTeacherMove(node, { ...opts, mode: 'free' })
  }

  /** The engine answers off book. If it can't, the session ends rather than waiting. */
  private async engineReply(gen: number): Promise<void> {
    const status = this.engine.status()
    if (status !== 'ready') return this.finish(status === 'loading' ? MESSAGES.engineLoading : MESSAGES.engineFailed)
    const { pos, region, node } = this.s
    const a = await this.eng.analysis(pos)
    if (gen !== this.gen) return
    if (!a) return this.finish(MESSAGES.engineFailed)
    const color = otherColor(this.owner)
    const { cornerBest, tenukiBest } = a
    if (tenukiBest && tenukiBest.scoreLead > cornerBest.scoreLead + TENUKI_MARGIN && legal(pos, tenukiBest.pt, color)) {
      this.teacherPlays(tenukiBest.pt, true, node && bookChild(this.withSiblings(node), 'tenuki'))
      return this.finish()
    }
    const near = a.candidates.filter((c) => c.scoreLead >= cornerBest.scoreLead - NEAR_BEST)
    const pick = near.length > 0 ? near[Math.floor(this.rng() * near.length)].pt : cornerBest.pt
    const pt = [pick, cornerBest.pt, ...a.candidates.map((c) => c.pt)].find((p) => inRegion(p, region) && legal(pos, p, color))
    if (!pt) return this.finish(MESSAGES.noMove)
    // The engine's answer may still be a book move.
    this.teacherPlays(pt, false, node && bookChild(this.withSiblings(node), toBookPt(pt, this.cfg.sym)))
    await this.next(gen)
  }

  /**
   * The book's moves from `node` (R42): its own children, then the moves the families that start the same
   * way have at this position and checked under this session's setup. Each node stays in its own tree.
   */
  private bookMoves(node: BookNode): BookNode[] {
    const own = this.index.familyOf(node)
    if (!own) return node.children
    const out = [...node.children]
    const seen = new Set(out.map((c) => c.key))
    for (const family of this.index.group(own).slice(1)) {
      for (const c of this.index.node(family, node.key)?.children ?? []) {
        if (seen.has(c.key) || !nodeSetups(this.book, family, c).some((s) => s.setup === this.setup)) continue
        seen.add(c.key)
        out.push(c)
      }
    }
    return out
  }

  /** `node` with all of bookMoves as its children: what judgeMove and pickTeacherMove look at. */
  private withSiblings(node: BookNode): BookNode {
    const children = this.bookMoves(node)
    return children.length === node.children.length ? node : { ...node, children }
  }

  /** Puts the teacher's stone on `pt`; `child` is the book move it is, or null off book. */
  private teacherPlays(pt: Pt, tenuki: boolean, child: BookNode | null): void {
    const { pos, log, offBookMoves } = this.s
    const color = otherColor(this.owner)
    const after = this.place(pos, pt, color)
    if (child) this.lastBook = child
    this.set({
      pos: after,
      node: child,
      offBookMoves: offBookMoves + (child ? 0 : 1),
      log: [...log, { move: tenuki ? { tenuki: color } : lastMove(after), by: 'teacher' }],
      note: noteOn(child, this.cfg.sym),
    })
  }

  private place(pos: Position, pt: Pt, color: Color): Position {
    const r = play(pos, pt, color)
    if ('illegal' in r) throw new Error(`Illegal move ${pt.x},${pt.y}: ${r.illegal}`)
    return r.pos
  }
}
