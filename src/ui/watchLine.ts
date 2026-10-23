// A pattern's main line as the watch phase shows it (R45): the start position, then one book move at a
// time, everything turned by the same `sym` the test after it uses, so the owner watches on the very
// board they then play on. Points and notes turn the way a sparring session turns them (session/frame.ts).
//
// A tenuki in the line puts no stone down. The corner view couldn't show a stone far away anyway; the
// note area says "White plays elsewhere" instead, which is also how the test's move list says it.
// Captures come from the rules (go/rules.ts play), so a stone taken in the line leaves the board.
// The Pattern page shows the same line with sym 0, the book's own frame.

import { startPosition } from '../book/setups'
import type { Book, BookNode } from '../book/types'
import type { Color, Pt, Region, Sym } from '../go/coords'
import { pass, play, type Position } from '../go/rules'
import { noteOn, toBoardPt } from '../session/frame'
import { orientNote } from '../session/orient'

export interface WatchStep {
  pos: Position
  /** The book node just played; null at the start. */
  node: BookNode | null
  /** Who played it; null at the start. */
  color: Color | null
  /** Where it went on this board; null at the start and for a move elsewhere. */
  at: Pt | null
  /** The move was a tenuki: played elsewhere, no stone in the corner. */
  tenuki: boolean
  /** The stones this move took off the board (this board's points). */
  captured: Pt[]
  /** What the teacher says: the move's note, or at the start the corner stone's, points turned. '' when there is none. */
  note: string
  /** The note is marked `confidence: low`. */
  low: boolean
}

export interface WatchLine {
  patternId: string
  sym: Sym
  /** The studied corner on this board. */
  region: Region
  /** The start position first, then one step per move of the main line. */
  steps: WatchStep[]
}

// The book never changes while the app runs, so each line is worked out once per board turn.
const cache = new WeakMap<Book, Map<string, WatchLine>>()

/** The main line of `patternId`, played out under `sym`. Throws if a book move turns out illegal. */
export function watchLine(book: Book, patternId: string, sym: Sym): WatchLine {
  let lines = cache.get(book)
  if (!lines) cache.set(book, (lines = new Map()))
  const key = `${sym}:${patternId}`
  const hit = lines.get(key)
  if (hit) return hit

  if (!Object.hasOwn(book.patterns, patternId)) throw new Error(`Unknown pattern "${patternId}"`)
  const entry = book.patterns[patternId]
  const start = startPosition(book, entry.family, patternId, sym)
  const corner = book.families[entry.family].def.start[0]?.note ?? ''
  const steps: WatchStep[] = [
    { pos: start.pos, node: null, color: null, at: null, tenuki: false, captured: [], note: orientNote(corner, sym), low: false },
  ]

  let pos = start.pos
  for (const node of entry.path) {
    const move = node.move
    if (!move) throw new Error(`${patternId}: the root has no move`)
    const said = { node, color: move.color, note: noteOn(node, sym) ?? '', low: node.confidence === 'low' }
    if (move.at === 'tenuki') {
      pos = pass(pos)
      steps.push({ ...said, pos, at: null, tenuki: true, captured: [] })
      continue
    }
    const at = toBoardPt(move.at, sym)
    const r = play(pos, at, move.color)
    if ('illegal' in r) throw new Error(`${patternId}: ${node.key} is ${r.illegal}`)
    pos = r.pos
    steps.push({ ...said, pos, at, tenuki: false, captured: r.captured })
  }

  const line = { patternId, sym, region: start.region, steps }
  lines.set(key, line)
  return line
}

/** How long Auto-play leaves each move on the board before the next. */
export const AUTO_PLAY_MS = 1800

/** The system asks for less motion: Auto-play then waits for a tap instead of starting by itself. */
export function prefersReducedMotion(): boolean {
  try {
    return typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  } catch {
    return false
  }
}
