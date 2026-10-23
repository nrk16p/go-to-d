// A pattern's main line replayed move by move in the book's own frame (sym 0, studied corner upper
// right), for the Library thumbnails and the Pattern page. The book never changes while the app runs,
// so each line is worked out once.

import { startPosition } from '../book/setups'
import type { Book, BookNode } from '../book/types'
import { CORNER_REGION, type Pt, type Region } from '../go/coords'
import { pass, play, type Position } from '../go/rules'

export interface LineStep {
  pos: Position
  /** The book node just played; null at the start position. */
  node: BookNode | null
  /** Where it was played; null at the start and for a move elsewhere. */
  at: Pt | null
}

export interface MainLine {
  steps: LineStep[]
  region: Region
}

const cache = new WeakMap<Book, Map<string, MainLine>>()

export function mainLine(book: Book, patternId: string): MainLine {
  let byId = cache.get(book)
  if (!byId) cache.set(book, (byId = new Map()))
  const hit = byId.get(patternId)
  if (hit) return hit

  const entry = book.patterns[patternId]
  const start = startPosition(book, entry.family, patternId, 0)
  const steps: LineStep[] = [{ pos: start.pos, node: null, at: null }]
  let pos = start.pos
  for (const node of entry.path) {
    const m = node.move!
    if (m.at === 'tenuki') {
      pos = pass(pos)
      steps.push({ pos, node, at: null })
      continue
    }
    const r = play(pos, m.at, m.color)
    if ('illegal' in r) throw new Error(`${patternId}: ${node.key} is ${r.illegal}`)
    pos = r.pos
    steps.push({ pos, node, at: m.at })
  }
  const line = { steps, region: start.region }
  byId.set(patternId, line)
  return line
}

/**
 * How many lines of the corner a thumbnail shows (from the corner, square): enough for every stone
 * in the studied corner at the end of the line, plus one, between 6 and 11.
 */
export function thumbSize(pos: Position): number {
  let reach = 0
  for (let y = CORNER_REGION.yMin; y <= CORNER_REGION.yMax; y++) {
    for (let x = CORNER_REGION.xMin; x <= CORNER_REGION.xMax; x++) {
      if (pos.board[y][x] !== null) reach = Math.max(reach, 18 - x, y)
    }
  }
  return Math.min(11, Math.max(6, reach + 2))
}
