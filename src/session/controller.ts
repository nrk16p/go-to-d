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
//
// A position can look the same turned (the empty board, the four handicap stones and the diagonal through
// the 4-4 point). Then the owner can't know which way the book is turned, so a move that is book once the
// book is turned that way counts as book, and the session's sym turns with it (R47): the board stays as it
// is and the book follows, notes and markers included.
//
// A whole-board opening (R46) works the same way with the board as its region: every tap is a move on
// the board (never a tenuki, there is no elsewhere), the engine's best is the best anywhere, and the
// teacher never leaves to play elsewhere. Six moves off the book still end the session.

import { nodeSetups } from '../book/build'
import type { CheckedLoss } from '../book/checkedLoss'
import { canonicalRegion, isBoardFamily, startPosition } from '../book/setups'
import { bookIndex, type BookIndex } from '../book/siblings'
import type { Book, BookNode, SetupId } from '../book/types'
import type { TeacherEngine } from '../engine/teacher'
import { BOARD_SIZE, inRegion, transform, withMargin, type Pt, type Region, type Sym } from '../go/coords'
import { otherColor, play, type Color, type Position } from '../go/rules'
import { EngineAccess, legal } from './engineAccess'
import {
  analysisToBook,
  lineKey,
  noteOn,
  positionSymmetries,
  toBoardPt,
  toBookPt,
  turnedSym,
  verdictToBoard,
} from './frame'
import { bookChild, isSound, judgeMove, scoreAfterNeeded, type Verdict } from './judge'
import { mulberry32, pickTeacherMove } from './pick'
import { countOwnerMove, newTally, sessionResult, switchablePatterns, type SessionResult, type Tally } from './result'
import { drillableSides, ownerColor } from './sides'
import { MESSAGES } from './messages'
import { startState, type MistakeRecord, type SparConfig, type SparState } from './types'

export { ENGINE_TIMEOUT_MS } from './engineAccess'
export { DEFAULT_THRESHOLDS, type Thresholds, type Verdict } from './judge'
export type { SessionResult } from './result'
export type { Side } from './sides'
export type { LogEntry, MistakeRecord, SparConfig, SparState } from './types'

/** Moves played off the book, by either side, before the session ends. */
const MAX_OFF_BOOK = 6
/** Off book, the teacher leaves the corner (and ends the session) when elsewhere is this much bigger. Corners only. */
const TENUKI_MARGIN = 1.0
/** Off book, the teacher picks at random among corner moves this close to the best one. */
const NEAR_BEST = 0.5
/** The book was checked with KataGo's Chinese rules, which give White +4 in the 4-stone setup (R9). */
const HANDICAP_BONUS = 4

type Undo = Pick<SparState, 'pos' | 'node' | 'offBookMoves' | 'log' | 'note' | 'sym'> & { lastBook: BookNode | null }

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
  /** A whole-board opening (R46): no tenuki, for either side. */
  private wholeBoard = false
  /** The family's region in the book's frame, for R47's symmetries. */
  private bookRegion!: Region
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
  /** R51: each position's first mistake, by the tally's key for that position. */
  private mistakeLog = new Map<string, MistakeRecord>()
  /** R51 practice: book moves played for the owner before the session starts (0: none). */
  private from = 0

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

  /** The session's mistakes so far, one per position (R51), in the order they were made. */
  get mistakes(): MistakeRecord[] {
    return [...this.mistakeLog.values()]
  }

  async start(): Promise<void> {
    if (this.started || this.disposed) return
    this.started = true
    this.fastForward()
    await this.next(this.gen)
  }

  async ownerPlay(p: Pt | 'tenuki'): Promise<void> {
    if (this.s.status !== 'owner-to-move' || this.disposed) return
    // An opening has no elsewhere: the screen shows no Play elsewhere button, and one is ignored.
    if (p === 'tenuki' && this.wholeBoard) return
    const { pos, node, region, log, offBookMoves, note } = this.s
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
    let played: Pt | 'tenuki' = p !== 'tenuki' && inRegion(p, withMargin(region)) ? toBookPt(p, this.cfg.sym) : 'tenuki'
    const undo: Undo = { pos, node, offBookMoves, log, note, sym: this.cfg.sym, lastBook: this.lastBook }
    let child = node ? bookChild(this.withSiblings(node), played) : null
    // R47: not book as the book is turned now, but book turned another way the position allows.
    if (!child && node && played !== 'tenuki') {
      const turned = this.turnedMatch(pos, node, played)
      if (turned) {
        this.setSym(turned.sym)
        played = turned.played
        child = turned.child
      }
    }
    const { sym } = this.cfg
    const engineState = this.engine.status()
    // The stone shows at once; its verdict follows.
    this.set({ status: 'teacher-thinking', message: null, lastVerdict: null, ...(after ? { pos: after } : {}) })
    if (!after) {
      const a = await this.eng.analysis(pos)
      if (gen !== this.gen) return
      after = this.place(pos, this.eng.tenukiPoint(pos, a, this.owner), this.owner)
      this.set({ pos: after })
    }
    const tenukiAt = played === 'tenuki' ? toBookPt(lastMove(after), sym) : undefined
    const verdict = await this.judge(gen, node && this.withSiblings(node), child, played, tenukiAt, pos, after, engineState)
    if (gen !== this.gen) return

    const where = node ? `book:${node.key}` : `off:${lineKey(pos, sym)}`
    countOwnerMove(this.tally, { verdict, node, child, where, drill: this.cfg.mode === 'drill' })
    if (verdict.type === 'mistake' && !this.mistakeLog.has(where)) {
      const stone = lastMove(after)
      this.mistakeLog.set(where, {
        moveNumber: pos.history.length + 1,
        before: pos.board,
        region,
        played: stone ? { x: stone.x, y: stone.y } : null,
        tenuki: played === 'tenuki',
        better: verdict.better,
        pointsLost: verdict.pointsLost,
        note: verdict.note ?? null,
        sym,
        practice: this.practiceFrom(node, pos.history.length),
      })
    }
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
    // A move matched by turning the book (R47) is taken back with its turn.
    this.setSym(state.sym)
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
    // A practice start (R51) was for the drill switched away from.
    this.reset({ ...this.cfg, mode: 'drill', patternId, family: entry.family, from: undefined })
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
    this.wholeBoard = isBoardFamily(fam.def)
    this.bookRegion = canonicalRegion(fam.def)
    const komi = start.komi + (setup === 'handicap4' ? HANDICAP_BONUS : 0)
    const isCurrent = (pos: Position) => gen === this.gen && this.s.pos === pos && this.s.status === 'owner-to-move'
    this.eng = new EngineAccess(this.engine, komi, start.region, cfg.sym, isCurrent)
    this.drillPath = cfg.mode === 'drill' ? entry?.path : undefined
    this.rng = mulberry32(cfg.seed)
    this.tally = newTally()
    this.undo = null
    this.lastBook = null
    this.leftDrill = false
    this.mistakeLog = new Map()
    this.from = this.practiceStart(cfg)
    this.s = startState(start, fam.root, cfg.sym)
    this.emit()
  }

  /**
   * R51: how many book moves a practice drill plays first: `cfg.from` when the drilled line has an owner
   * move right after that many moves, else 0 (a plain drill).
   */
  private practiceStart(cfg: SparConfig): number {
    const n = cfg.from
    const path = this.drillPath
    if (n === undefined || !path || !Number.isInteger(n) || n < 1 || n >= path.length) return 0
    return path[n].move?.color === this.owner ? n : 0
  }

  /**
   * R51: plays the drilled line's first `from` moves for both sides, unjudged and out of the log, so the
   * session starts at the position where the owner went wrong. A book tenuki goes on a big point elsewhere
   * (no engine is asked); the corner is the same as in the session the mistake came from.
   */
  private fastForward(): void {
    if (this.from === 0 || !this.drillPath) return
    const { sym } = this.cfg
    let pos = this.s.pos
    const line = this.drillPath.slice(0, this.from)
    for (const n of line) {
      const { color, at } = n.move!
      pos = this.place(pos, at === 'tenuki' ? this.eng.tenukiPoint(pos, null, color) : toBoardPt(at, sym), color)
    }
    const node = line[line.length - 1]
    this.lastBook = node
    this.set({ pos, node, note: noteOn(node, sym) })
  }

  /**
   * R51: where "Practise this move again" starts for a mistake played at `node` after `from` moves: a drill
   * whose main line reaches `node` in exactly that many moves and goes on with an owner move, from this
   * side. The drilled pattern first (unless play left its line), then the others by course order. Null off
   * book, or on a line no pattern drills (a punishment line after Play on).
   */
  private practiceFrom(node: BookNode | null, from: number): MistakeRecord['practice'] {
    if (!node) return null
    const family = this.index.familyOf(node) ?? this.cfg.family
    const pool =
      node.move === null
        ? Object.keys(this.book.patterns).filter((id) => this.book.patterns[id].family === family)
        : node.patternIds
    const order = (id: string) => this.book.patterns[id]?.def.order ?? Infinity
    const drilled = this.cfg.mode === 'drill' && !this.leftDrill ? this.cfg.patternId : undefined
    const ids = [...pool].sort((a, b) => (a === drilled ? -1 : b === drilled ? 1 : order(a) - order(b)))
    for (const id of ids) {
      const entry = this.book.patterns[id]
      if (!entry) continue
      const { path } = entry
      const reached = from === 0 ? node.move === null : path[from - 1] === node
      if (!reached || from >= path.length || path[from].move?.color !== this.owner) continue
      if (!drillableSides(this.book, id).includes(this.cfg.side)) continue
      return { family: entry.family, patternId: id, from }
    }
    return null
  }

  /**
   * R47: the owner's move `played` (book frame) is no book move, but the position looks the same turned by
   * some g, and turned by g the move is one. The turn that keeps to the drilled line wins, then a sound
   * move, then any. Null when no turn makes it book.
   */
  private turnedMatch(pos: Position, node: BookNode, played: Pt): { sym: Sym; played: Pt; child: BookNode } | null {
    const book = this.withSiblings(node)
    const found: Array<{ sym: Sym; played: Pt; child: BookNode }> = []
    for (const g of positionSymmetries(pos, this.cfg.sym, this.bookRegion)) {
      const q = transform(played, g)
      const child = bookChild(book, q)
      if (child) found.push({ sym: turnedSym(this.cfg.sym, g), played: q, child })
    }
    const onDrill = this.drillPath && !this.leftDrill ? found.find((f) => this.drillPath!.includes(f.child)) : undefined
    return onDrill ?? found.find((f) => isSound(f.child)) ?? found[0] ?? null
  }

  /** Turns the book on the board (R47): the engine's frame and the published state follow. */
  private setSym(sym: Sym): void {
    if (sym === this.cfg.sym) return
    this.cfg = { ...this.cfg, sym }
    this.eng.setSym(sym)
    this.set({ sym })
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
    // In a corner the teacher may leave for a bigger point elsewhere; an opening's region is the board.
    const leave = !this.wholeBoard && tenukiBest && tenukiBest.scoreLead > cornerBest.scoreLead + TENUKI_MARGIN
    if (leave && tenukiBest && legal(pos, tenukiBest.pt, color)) {
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
