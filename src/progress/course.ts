// The course through the book (R32): what comes next, what is due, how much is mastered.
// The 4 kyu test is handicap games with the owner as Black on the star points, so the course opens
// with the defend side of the 4-4 point and the 3-3 invasion; everything else follows by `order`.

import type { Book, FamilyId } from '../book/types'
import { drillableSides, type Side } from '../session/sides'
import { addDays, dueKeys, isMastered, reviewKey, type Progress } from './srs'

export interface CourseItem {
  patternId: string
  family: FamilyId
  side: Side
  /** reviewKey(patternId, side) */
  key: string
}

/** Families whose defend side leads the course. */
export const LEAD_FAMILIES: readonly FamilyId[] = ['star44', 'invade33']

function byOrder(book: Book): string[] {
  return Object.keys(book.patterns).sort((a, b) => book.patterns[a].def.order - book.patterns[b].def.order)
}

function item(book: Book, patternId: string, side: Side): CourseItem {
  return { patternId, family: book.patterns[patternId].family, side, key: reviewKey(patternId, side) }
}

/**
 * Every pattern × drillable side once, in course order: first the defend side of the lead families'
 * patterns by `order`, then everything else by `order`, defend before attack within a pattern.
 */
export function courseOrder(book: Book): CourseItem[] {
  const ids = byOrder(book)
  const lead = ids
    .filter((id) => LEAD_FAMILIES.includes(book.patterns[id].family) && drillableSides(book, id).includes('defend'))
    .map((id) => item(book, id, 'defend'))
  const taken = new Set(lead.map((i) => i.key))
  const rest = ids.flatMap((id) => drillableSides(book, id).map((side) => item(book, id, side))).filter((i) => !taken.has(i.key))
  return [...lead, ...rest]
}

/** The first `n` course items that have no review yet. */
export function newItems(book: Book, p: Progress, n: number): CourseItem[] {
  if (n <= 0) return []
  return courseOrder(book)
    .filter((i) => !Object.hasOwn(p.reviews, i.key))
    .slice(0, n)
}

/** How many patterns × sides were first played on `today` (R44). Reviews with no first day (older saves) don't count. */
export function startedToday(p: Progress, today: string): number {
  return Object.values(p.reviews).filter((r) => r.firstDay === today).length
}

/**
 * The new items Today offers (R44, spec §4: about newPerDay a day, a suggestion): newPerDay less the ones
 * already started today, in course order. Once they're done the list is empty until tomorrow; the next one
 * stays one tap away (newItems(book, p, 1)) for whoever wants more.
 */
export function newToday(book: Book, p: Progress, today: string): CourseItem[] {
  return newItems(book, p, Math.max(0, p.settings.newPerDay - startedToday(p, today)))
}

/** The reviews due on `today`, most overdue first, leaving out keys the book no longer drills. */
export function dueItems(book: Book, p: Progress, today: string): CourseItem[] {
  const out: CourseItem[] = []
  for (const key of dueKeys(p, today)) {
    const cut = key.lastIndexOf(':')
    const id = key.slice(0, cut)
    const side = key.slice(cut + 1)
    if (!Object.hasOwn(book.patterns, id) || (side !== 'attack' && side !== 'defend')) continue
    if (!drillableSides(book, id).includes(side)) continue
    out.push(item(book, id, side))
  }
  return out
}

/** Mastered pattern × sides over all drillable ones (a pattern with a trick has one side, not two). */
export function masteredCount(book: Book, p: Progress): { mastered: number; total: number } {
  const all = courseOrder(book)
  const mastered = all.filter((i) => {
    const r = Object.hasOwn(p.reviews, i.key) ? p.reviews[i.key] : undefined
    return r !== undefined && isMastered(r)
  }).length
  return { mastered, total: all.length }
}

/** The streak as it stands today: it lives while the last session was today or yesterday. */
export function currentStreak(p: Progress, today: string): number {
  const last = p.streak.lastDay
  if (last === null) return 0
  return last >= addDays(today, -1) ? p.streak.count : 0
}
