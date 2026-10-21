// The shapes a sparring session shares with its UI: the state it publishes, the config it starts from,
// and the state before the first move.

import type { BookNode, FamilyId } from '../book/types'
import type { Move, Region, Sym } from '../go/coords'
import type { Color, Position } from '../go/rules'
import type { Thresholds, Verdict } from './judge'
import type { SessionResult } from './result'
import type { Side } from './sides'

export type LogEntry = { move: Move | { tenuki: Color }; by: 'owner' | 'teacher'; verdict?: Verdict }

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

/** The state of a session that hasn't started: the setup position, at the root of the book. */
export function startState(start: { pos: Position; komi: number; region: Region }, root: BookNode): SparState {
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
  }
}
