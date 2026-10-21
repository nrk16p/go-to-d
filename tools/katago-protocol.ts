// KataGo analysis-engine protocol: query building and response reading. Pure TypeScript, no Node
// imports, so unit tests (and the browser-side benchmark) can use it. The process handling is in katago.ts.
// Protocol reference: https://github.com/lightvector/KataGo/blob/master/docs/Analysis_Engine.md

import { BOARD_SIZE, toGtp, type Board } from '../src/go/coords'

export type Letter = 'B' | 'W'

/** Whose point of view KataGo reports winrate and score from. Set by `reportAnalysisWinratesAs` in the config. */
export type ReportedAs = 'BLACK' | 'WHITE' | 'SIDETOMOVE'

/** A position to analyse. Points are GTP strings ("Q16"); a move may also be "pass". */
export interface AnalysisRequest {
  /** Stones on the board before `moves`. */
  initialStones: Array<[Letter, string]>
  /** Who plays first in `moves`, or who is to move if `moves` is empty. */
  initialPlayer: Letter
  /** Moves played from the initial stones, each with its colour. */
  moves: Array<[Letter, string]>
  komi: number
  /** KataGo rules name. Defaults to "chinese". */
  rules?: string
  /** Defaults to 400. */
  maxVisits?: number
  /** Only these first moves are searched, for the player to move after `moves` (the reply tree below is free). */
  allowMoves?: string[]
  /** These first moves are not searched, for the player to move after `moves`. */
  avoidMoves?: string[]
}

export const DEFAULT_VISITS = 400

/** One line sent to `katago analysis`. */
export interface KataGoQuery {
  id: string
  initialStones: Array<[Letter, string]>
  initialPlayer: Letter
  moves: Array<[Letter, string]>
  rules: string
  komi: number
  boardXSize: number
  boardYSize: number
  maxVisits: number
  analyzeTurns: number[]
  allowMoves?: Array<{ player: Letter; moves: string[]; untilDepth: number }>
  avoidMoves?: Array<{ player: Letter; moves: string[]; untilDepth: number }>
}

export function otherLetter(l: Letter): Letter {
  return l === 'B' ? 'W' : 'B'
}

/** The player to move after the request's moves. */
export function nextPlayer(req: Pick<AnalysisRequest, 'initialPlayer' | 'moves'>): Letter {
  const last = req.moves[req.moves.length - 1]
  return last ? otherLetter(last[0]) : req.initialPlayer
}

export function buildQuery(req: AnalysisRequest, id: string): KataGoQuery {
  const player = nextPlayer(req)
  const query: KataGoQuery = {
    id,
    initialStones: req.initialStones.map(([c, p]) => [c, p]),
    initialPlayer: req.initialPlayer,
    moves: req.moves.map(([c, p]) => [c, p]),
    rules: req.rules ?? 'chinese',
    komi: req.komi,
    boardXSize: BOARD_SIZE,
    boardYSize: BOARD_SIZE,
    maxVisits: req.maxVisits ?? DEFAULT_VISITS,
    // Only the position after the last move; without this KataGo analyses the same.
    analyzeTurns: [req.moves.length],
  }
  if (req.allowMoves && req.allowMoves.length > 0) {
    query.allowMoves = [{ player, moves: [...req.allowMoves], untilDepth: 1 }]
  }
  if (req.avoidMoves && req.avoidMoves.length > 0) {
    query.avoidMoves = [{ player, moves: [...req.avoidMoves], untilDepth: 1 }]
  }
  return query
}

/** Every stone on a board as colour letter + GTP point, row by row from the top. */
export function stonesFromBoard(board: Board): Array<[Letter, string]> {
  const out: Array<[Letter, string]> = []
  for (let y = 0; y < BOARD_SIZE; y++) {
    for (let x = 0; x < BOARD_SIZE; x++) {
      const c = board[y][x]
      if (c !== null) out.push([c === 'black' ? 'B' : 'W', toGtp({ x, y })])
    }
  }
  return out
}

/** One line from `katago analysis`, the parts this repo reads. */
export interface RawResponse {
  id?: string
  error?: string
  warning?: string
  field?: string
  isDuringSearch?: boolean
  turnNumber?: number
  rootInfo?: { currentPlayer: Letter; visits: number; winrate: number; scoreLead: number }
  moveInfos?: Array<{
    move: string
    order: number
    visits: number
    prior: number
    winrate: number
    scoreLead: number
    pv?: string[]
  }>
}

export interface AnalysisMove {
  /** GTP point or "pass". */
  move: string
  /** 0 = KataGo's first choice. */
  order: number
  visits: number
  /** Points, from the view of the player to move at the analysed position. Positive = that player leads. */
  scoreLead: number
  /** Win probability of the player to move, 0..1. */
  winrate: number
  prior: number
  pv: string[]
}

/** KataGo's answer for one position, everything from the view of the player to move there. */
export interface Analysis {
  id: string
  toMove: Letter
  /** Root visits actually spent. */
  visits: number
  scoreLead: number
  winrate: number
  /** Sorted by `order`, best first. */
  moves: AnalysisMove[]
}

function asMover(value: number, reportedAs: ReportedAs, toMove: Letter): number {
  let v = value
  if (reportedAs === 'BLACK' && toMove === 'W') v = -value
  if (reportedAs === 'WHITE' && toMove === 'B') v = -value
  return v === 0 ? 0 : v // never -0
}

function winAsMover(value: number, reportedAs: ReportedAs, toMove: Letter): number {
  if (reportedAs === 'BLACK' && toMove === 'W') return 1 - value
  if (reportedAs === 'WHITE' && toMove === 'B') return 1 - value
  return value
}

/**
 * Turns a raw response into an `Analysis` seen from the player to move.
 * `reportedAs` must be the config's `reportAnalysisWinratesAs`; the response itself does not say.
 */
export function normalizeResponse(raw: RawResponse, reportedAs: ReportedAs): Analysis {
  const id = raw.id ?? '?'
  if (raw.error !== undefined) {
    throw new Error(`KataGo rejected query ${id}: ${raw.error}${raw.field ? ` (field ${raw.field})` : ''}`)
  }
  if (!raw.rootInfo) throw new Error(`KataGo answer ${id} has no rootInfo`)
  const toMove = raw.rootInfo.currentPlayer
  const infos = raw.moveInfos ?? []
  if (infos.length === 0) throw new Error(`KataGo answer ${id} has no moves (every allowed move illegal?)`)
  return {
    id,
    toMove,
    visits: raw.rootInfo.visits,
    scoreLead: asMover(raw.rootInfo.scoreLead, reportedAs, toMove),
    winrate: winAsMover(raw.rootInfo.winrate, reportedAs, toMove),
    moves: infos
      .map((m) => ({
        move: m.move,
        order: m.order,
        visits: m.visits,
        scoreLead: asMover(m.scoreLead, reportedAs, toMove),
        winrate: winAsMover(m.winrate, reportedAs, toMove),
        prior: m.prior,
        pv: m.pv ?? [],
      }))
      .sort((a, b) => a.order - b.order),
  }
}

/** `reportAnalysisWinratesAs` from config text. KataGo's own default, when the key is absent, is SIDETOMOVE. */
export function parseReportedAs(configText: string): ReportedAs {
  for (const line of configText.split('\n')) {
    const m = /^\s*reportAnalysisWinratesAs\s*=\s*([^#\s]+)/.exec(line)
    if (!m) continue
    const value = m[1].toUpperCase()
    if (value === 'BLACK' || value === 'WHITE' || value === 'SIDETOMOVE') return value
    throw new Error(`reportAnalysisWinratesAs = ${m[1]} is not BLACK, WHITE or SIDETOMOVE`)
  }
  return 'SIDETOMOVE'
}
