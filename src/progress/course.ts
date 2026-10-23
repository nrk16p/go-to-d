// The course through the book (R32): what comes next, what is due, how much is mastered.
// The 4 kyu test is handicap games with the owner as Black on the star points, so the course opens
// with the defend side of the 4-4 point and the 3-3 invasion; everything else follows by `order`.
//
// Whole-board openings (R46) are a second list next to it, not a part of it: they have their own new
// item a day (settings.newOpeningsPerDay), so a new opening never waits for every joseki to be started,
// and joseki keep the R32 order they had. Reviews and the mastered count cover both.

import { isBoardFamily } from '../book/setups'
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

/** The two lists of new items: corner joseki (R32) and whole-board openings (R46). */
export type Track = 'joseki' | 'openings'

/** Which list a pattern's items are on. */
export function trackOf(book: Book, patternId: string): Track {
  return isBoardFamily(book.families[book.patterns[patternId].family].def) ? 'openings' : 'joseki'
}

/** The track's patterns by `order`. */
function byOrder(book: Book, track: Track): string[] {
  return Object.keys(book.patterns)
    .filter((id) => trackOf(book, id) === track)
    .sort((a, b) => book.patterns[a].def.order - book.patterns[b].def.order)
}

function item(book: Book, patternId: string, side: Side): CourseItem {
  return { patternId, family: book.patterns[patternId].family, side, key: reviewKey(patternId, side) }
}

/**
 * Every joseki pattern × drillable side once, in course order: first the defend side of the lead families'
 * patterns by `order`, then everything else by `order`, defend before attack within a pattern. Openings
 * are not in it (openingOrder).
 */
export function courseOrder(book: Book): CourseItem[] {
  const ids = byOrder(book, 'joseki')
  const lead = ids
    .filter((id) => LEAD_FAMILIES.includes(book.patterns[id].family) && drillableSides(book, id).includes('defend'))
    .map((id) => item(book, id, 'defend'))
  const taken = new Set(lead.map((i) => i.key))
  const rest = ids.flatMap((id) => drillableSides(book, id).map((side) => item(book, id, side))).filter((i) => !taken.has(i.key))
  return [...lead, ...rest]
}

/**
 * Every opening pattern × drillable side once (R46): Black's side ('defend') of every opening by `order`
 * first, then White's side by `order`. The owner plays Black in the test, so Black comes first.
 */
export function openingOrder(book: Book): CourseItem[] {
  const ids = byOrder(book, 'openings')
  const side = (s: Side) => ids.filter((id) => drillableSides(book, id).includes(s)).map((id) => item(book, id, s))
  return [...side('defend'), ...side('attack')]
}

/** The track's items in order. */
export function trackOrder(book: Book, track: Track): CourseItem[] {
  return track === 'joseki' ? courseOrder(book) : openingOrder(book)
}

/** The first `n` items of the track (joseki unless told) that have no review yet. */
export function newItems(book: Book, p: Progress, n: number, track: Track = 'joseki'): CourseItem[] {
  if (n <= 0) return []
  return trackOrder(book, track)
    .filter((i) => !Object.hasOwn(p.reviews, i.key))
    .slice(0, n)
}

/** The pattern id of a review key ("star44-low-jump:defend"), or null when the book no longer has it. */
function patternOfKey(book: Book, key: string): string | null {
  const id = key.slice(0, key.lastIndexOf(':'))
  return Object.hasOwn(book.patterns, id) ? id : null
}

/**
 * How many patterns × sides were first played on `today` (R44). Reviews with no first day (older saves)
 * don't count. With a book and a track, only that track's patterns count, so starting an opening doesn't
 * use up a joseki's place and the other way round.
 */
export function startedToday(p: Progress, today: string, only?: { book: Book; track: Track }): number {
  return Object.entries(p.reviews).filter(([key, r]) => {
    if (r.firstDay !== today) return false
    if (!only) return true
    const id = patternOfKey(only.book, key)
    return id !== null && trackOf(only.book, id) === only.track
  }).length
}

/**
 * The new items Today offers (R44, spec §4: about newPerDay a day, a suggestion): newPerDay less the ones
 * already started today, in course order. Once they're done the list is empty until tomorrow; the next one
 * stays one tap away (newItems(book, p, 1)) for whoever wants more. Joseki only; openings: newOpeningsToday.
 */
export function newToday(book: Book, p: Progress, today: string): CourseItem[] {
  const started = startedToday(p, today, { book, track: 'joseki' })
  return newItems(book, p, Math.max(0, p.settings.newPerDay - started))
}

/** The same for openings (R46): newOpeningsPerDay less the openings started today, in openingOrder. */
export function newOpeningsToday(book: Book, p: Progress, today: string): CourseItem[] {
  const started = startedToday(p, today, { book, track: 'openings' })
  return newItems(book, p, Math.max(0, p.settings.newOpeningsPerDay - started), 'openings')
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

/**
 * Mastered pattern × sides over all drillable ones, joseki and openings (a pattern with a trick, or an
 * opening from the handicap setup, has one side, not two).
 */
export function masteredCount(book: Book, p: Progress): { mastered: number; total: number } {
  const all = [...courseOrder(book), ...openingOrder(book)]
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
