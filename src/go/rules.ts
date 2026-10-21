// Go rules for the teacher: positions, legal play, captures, simple ko.
// Pure TypeScript, no DOM. Positions are immutable: play() and placeSetup() return new ones.

import { BOARD_SIZE, type Board, type Color, type Move, type Pt } from './coords'

export type { Board, Color, Move, Pt } from './coords'

/** How many previous boards a Position keeps (the engine reads up to 5). */
const MAX_PREVIOUS_BOARDS = 8

export interface Position {
  board: Board
  toMove: Color
  /** The point the player to move may not play because it would retake a simple ko. */
  ko: Pt | null
  /** Moves played from the setup position, oldest first. Setup stones are not in here. */
  history: Move[]
  /** Boards before each recent move, newest last (at most 8). */
  boards: Board[]
}

export function otherColor(c: Color): Color {
  return c === 'black' ? 'white' : 'black'
}

function onBoard(p: Pt): boolean {
  return Number.isInteger(p.x) && Number.isInteger(p.y) && p.x >= 0 && p.x < BOARD_SIZE && p.y >= 0 && p.y < BOARD_SIZE
}

function cloneBoard(board: Board): Board {
  return board.map((row) => row.slice())
}

export function emptyPosition(): Position {
  const board: Board = Array.from({ length: BOARD_SIZE }, () => Array<Color | null>(BOARD_SIZE).fill(null))
  return { board, toMove: 'black', ko: null, history: [], boards: [] }
}

/** Adds handicap/corner stones without any move bookkeeping and sets who moves next. */
export function placeSetup(pos: Position, stones: Move[], toMove: Color): Position {
  const board = cloneBoard(pos.board)
  for (const s of stones) {
    if (!onBoard(s)) throw new Error(`Setup stone off the board: ${s.x},${s.y}`)
    if (board[s.y][s.x] !== null) throw new Error(`Setup stone on an occupied point: ${s.x},${s.y}`)
    board[s.y][s.x] = s.player
  }
  return { ...pos, board, toMove, ko: null }
}

const NEIGHBOURS: ReadonlyArray<readonly [number, number]> = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
]

function neighbours(p: Pt): Pt[] {
  const out: Pt[] = []
  for (const [dx, dy] of NEIGHBOURS) {
    const q = { x: p.x + dx, y: p.y + dy }
    if (onBoard(q)) out.push(q)
  }
  return out
}

/** Flood fill: the connected same-colour stones from `start` and how many distinct liberties they have. */
function groupAt(board: Board, start: Pt): { stones: Pt[]; liberties: number } {
  const color = board[start.y][start.x]
  const seen = new Set<number>([start.y * BOARD_SIZE + start.x])
  const libs = new Set<number>()
  const stones: Pt[] = []
  const stack: Pt[] = [start]
  while (stack.length > 0) {
    const p = stack.pop()!
    stones.push(p)
    for (const q of neighbours(p)) {
      const k = q.y * BOARD_SIZE + q.x
      const c = board[q.y][q.x]
      if (c === null) libs.add(k)
      else if (c === color && !seen.has(k)) {
        seen.add(k)
        stack.push(q)
      }
    }
  }
  return { stones, liberties: libs.size }
}

/**
 * Plays `color` at `p`. Returns the new position and the captured points,
 * or why the move is illegal. Simple ko only (no superko); suicide is illegal.
 */
export function play(
  pos: Position,
  p: Pt,
  color: Color,
): { pos: Position; captured: Pt[] } | { illegal: 'occupied' | 'suicide' | 'ko' } {
  if (!onBoard(p)) throw new Error(`Move off the board: ${p.x},${p.y}`)
  if (pos.board[p.y][p.x] !== null) return { illegal: 'occupied' }
  if (pos.ko && pos.ko.x === p.x && pos.ko.y === p.y) return { illegal: 'ko' }

  const board = cloneBoard(pos.board)
  board[p.y][p.x] = color

  // Enemy groups next to the new stone with no liberties left are captured.
  const enemy = otherColor(color)
  const captured: Pt[] = []
  for (const q of neighbours(p)) {
    if (board[q.y][q.x] !== enemy) continue
    const g = groupAt(board, q)
    if (g.liberties > 0) continue
    for (const s of g.stones) {
      board[s.y][s.x] = null
      captured.push(s)
    }
  }

  // Judged after captures, so a stone that takes its last liberty back by capturing is fine.
  const own = groupAt(board, p)
  if (own.liberties === 0) return { illegal: 'suicide' }

  // Simple ko: one stone taken by a lone stone left with that single liberty.
  const isKo = captured.length === 1 && own.stones.length === 1 && own.liberties === 1

  const next: Position = {
    board,
    toMove: enemy,
    ko: isKo ? captured[0] : null,
    history: [...pos.history, { x: p.x, y: p.y, player: color }],
    boards: [...pos.boards, pos.board].slice(-MAX_PREVIOUS_BOARDS),
  }
  return { pos: next, captured }
}
