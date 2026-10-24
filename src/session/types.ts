// The shapes a sparring session shares with its UI: the state it publishes, the config it starts from,
// and the state before the first move.

import type { BookNode, FamilyId } from '../book/types'
import type { Board, Move, Pt, Region, Sym } from '../go/coords'
import type { Color, Position } from '../go/rules'
import type { Thresholds, Verdict } from './judge'
import type { SessionResult } from './result'
import type { Side } from './sides'

export type LogEntry = { move: Move | { tenuki: Color }; by: 'owner' | 'teacher'; verdict?: Verdict }

/**
 * One position the owner went wrong in (R51), for the report's review: in the board's frame, as the owner
 * saw it. A mistake retried in the same position is kept once, the first time, as the session counts it.
 */
export interface MistakeRecord {
  /** The mistake's move number in the session, 1 for the first move after the setup. */
  moveNumber: number
  /** The board before the move. */
  before: Board
  region: Region
  /** Where the stone went; for a tenuki the point it was played on elsewhere, when there is one. */
  played: Pt | null
  tenuki: boolean
  /** The move to play instead (null when nothing names one). */
  better: Pt | 'tenuki' | null
  pointsLost: number | null
  /** The book's word on the move, turned to the board and in the app's language; null off book. */
  note: string | null
  /** How the book was turned on the board at that moment. */
  sym: Sym
  /**
   * Where "Practise this move again" starts: a drill of `patternId` with its first `from` book moves played
   * for you. Null when the position isn't on a main line the owner can drill (off book, a punishment line).
   */
  practice: { family: FamilyId; patternId: string; from: number } | null
}

export interface SparState {
  /** While an owner move is being judged, this already shows its stone; the log gets it with its verdict. */
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
  /**
   * How the book is turned on this board. It starts as the config's and changes when the owner plays a
   * move that is book with the book turned another way the position allows (R47); the board doesn't change.
   */
  sym: Sym
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
  /**
   * R51 practice: a drill that starts with its first `from` book moves already played (both sides, not
   * judged), so the owner's first move is the one they missed. Ignored unless the drill's line has an
   * owner move there.
   */
  from?: number
}

/** The state of a session that hasn't started: the setup position, at the root of the book. */
export function startState(start: { pos: Position; komi: number; region: Region }, root: BookNode, sym: Sym): SparState {
  return {
    pos: start.pos,
    komi: start.komi,
    region: start.region,
    node: root,
    offBookMoves: 0,
    status: 'teacher-thinking',
    lastVerdict: null,
    log: [],
    result: null,
    message: null,
    note: null,
    sym,
  }
}
