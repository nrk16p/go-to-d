// What a session counts for: the numbers in SessionResult, which patterns get them, and which
// patterns "Switch to that pattern" may offer. Pure functions of the book and the session's tally.

import type { Book, BookNode } from '../book/types'
import { isSound, round1, type Verdict } from './judge'
import { drillableSides, type Side } from './sides'

export interface SessionResult {
  /** The drilled pattern; in free sparring the pattern reached, or none if the owner never played a book move. */
  patternIds: string[]
  side: Side
  clean: boolean
  /** Distinct positions the owner went wrong in (a retried mistake in the same position counts once). */
  mistakes: number
  pointsLost: number
  /** Book positions (node keys) where the owner went wrong, or left the book in a drill. */
  missedKeys: string[]
}

/** The running counts of one session. Retry does not undo them. */
export interface Tally {
  /** Points lost by each position's first mistake (null without the engine), keyed by position. */
  mistakes: Map<string, number | null>
  /** Points lost by "fine" off-book moves. */
  fineLost: number
  missed: Set<string>
  ownerMoves: number
  /** Owner moves that matched the book (sound or not). */
  ownerBookMoves: number
}

export function newTally(): Tally {
  return { mistakes: new Map(), fineLost: 0, missed: new Set(), ownerMoves: 0, ownerBookMoves: 0 }
}

/**
 * Counts one judged owner move. `node` is the book position it was played in (null off book), `child`
 * the book move it matched (null if none), `where` a key naming the position.
 */
export function countOwnerMove(
  t: Tally,
  m: { verdict: Verdict; node: BookNode | null; child: BookNode | null; where: string; drill: boolean },
): void {
  t.ownerMoves++
  if (m.child) t.ownerBookMoves++
  const bookKey = m.node && m.node.key !== '' ? m.node.key : null
  if (m.verdict.type === 'mistake') {
    if (!t.mistakes.has(m.where)) t.mistakes.set(m.where, m.verdict.pointsLost)
    if (bookKey) t.missed.add(bookKey)
  } else if (m.verdict.type === 'fine-offbook') {
    t.fineLost += m.verdict.pointsLost
  }
  // Leaving the book in a drill means the pattern wasn't played: remember where.
  if (m.drill && !m.child && bookKey) t.missed.add(bookKey)
}

/**
 * A drill is clean when it ended on a book leaf of the drilled pattern (its main line's end, or the end
 * of one of its own alternatives) with no mistakes. Free sparring is clean with no mistakes, and credits
 * the pattern reached only if the owner played at least one book move.
 */
export function sessionResult(
  book: Book,
  cfg: { mode: 'drill' | 'free'; patternId?: string; side: Side },
  t: Tally,
  end: { lastBook: BookNode | null; node: BookNode | null },
): SessionResult {
  const lost = [...t.mistakes.values()].reduce<number>((sum, p) => sum + (p ?? 0), 0) + t.fineLost
  const base = { side: cfg.side, mistakes: t.mistakes.size, pointsLost: round1(lost), missedKeys: [...t.missed] }
  if (cfg.mode === 'drill' && cfg.patternId !== undefined) {
    const id = cfg.patternId
    const path = book.patterns[id]?.path ?? []
    const n = end.node
    const atLeaf =
      n !== null && (n === path[path.length - 1] || (n.children.length === 0 && n.patternIds.includes(id) && isSound(n)))
    return { ...base, patternIds: [id], clean: t.mistakes.size === 0 && atLeaf }
  }
  return {
    ...base,
    patternIds: t.ownerBookMoves > 0 ? reachedPattern(book, end.lastBook) : [],
    clean: t.mistakes.size === 0,
  }
}

/** The pattern whose main line holds `lastBook` (the lowest `order` if several; a branch's own patterns if none). */
export function reachedPattern(book: Book, lastBook: BookNode | null): string[] {
  if (!lastBook || lastBook.patternIds.length === 0) return []
  const onLine = lastBook.patternIds.filter((id) => book.patterns[id]?.path.includes(lastBook))
  const pool = onLine.length > 0 ? onLine : lastBook.patternIds
  const order = (id: string) => book.patterns[id]?.def.order ?? Infinity
  return [pool.reduce((a, b) => (order(b) < order(a) ? b : a))]
}

/**
 * The patterns "Switch to that pattern" may offer after an other-joseki move: the move is on their
 * main line and they can be drilled from `side`. Empty when none qualify (the UI then offers only Retry).
 */
export function switchablePatterns(book: Book, child: BookNode, side: Side): string[] {
  return child.patternIds.filter(
    (id) => book.patterns[id]?.path.includes(child) === true && drillableSides(book, id).includes(side),
  )
}
