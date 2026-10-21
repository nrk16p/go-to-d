// Spaced repetition: a Leitner ladder with one review state per pattern and side. A clean run climbs a
// box, a miss falls back to box 1. All days are local calendar days, "YYYY-MM-DD".

import type { Side, Thresholds } from '../session/controller'

export interface ReviewState {
  /** 0 = never reviewed (not stored by the app), 5 = top box. */
  box: 0 | 1 | 2 | 3 | 4 | 5
  /** The local day this is next due. */
  due: string
  runs: number
  cleanRuns: number
  /** Book positions (node keys) where the owner last went wrong, oldest first. */
  missedKeys: string[]
}

export interface Settings {
  thresholds: Thresholds
  visits: number
  /** New patterns offered per day. */
  newPerDay: number
  iosHintDismissed: boolean
}

export interface Progress {
  version: 1
  /** Keyed by reviewKey(patternId, side). */
  reviews: Record<string, ReviewState>
  /** `lastDay` is the last local day a session was finished. */
  streak: { count: number; lastDay: string | null }
  settings: Settings
}

/** Days until the next review, by box. */
export const BOX_DAYS = [0, 1, 3, 7, 14, 30] as const
const TOP_BOX = BOX_DAYS.length - 1
/** A miss goes back here, due tomorrow. */
const MISS_BOX = 1
/** Boxes from here up count as mastered. */
const MASTERED_BOX = 4
const MAX_MISSED_KEYS = 20

export function reviewKey(patternId: string, side: Side): string {
  return `${patternId}:${side}`
}

const DAY = /^(\d{4})-(\d{2})-(\d{2})$/

function shift(day: string, n: number): string | null {
  const m = DAY.exec(day)
  if (!m) return null
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]) + n, 12)
  const y = String(d.getFullYear()).padStart(4, '0')
  return `${y}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Whether `s` is a real calendar day written as YYYY-MM-DD ("2026-02-30" is not). */
export function isDay(s: unknown): s is string {
  return typeof s === 'string' && shift(s, 0) === s
}

/**
 * The day `n` days after `day` (before it when negative). Works on the date parts, not on milliseconds,
 * so month and year ends and daylight saving changes can't move it by a day. Noon keeps it clear of
 * zones where midnight doesn't exist on the day the clocks change. Throws on anything but a real day.
 */
export function addDays(day: string, n: number): string {
  if (!isDay(day)) throw new RangeError(`Not a YYYY-MM-DD day: "${day}"`)
  return shift(day, n)!
}

/**
 * The review state after one more run on `today`.
 * - Clean, on or after the due day: up a box, due in that box's days (a first run counts as box 0).
 * - Clean, before the due day: box and due stay as they are, so doing the same pattern three times in
 *   one evening doesn't climb the ladder. The run still counts.
 * - Missed: back to box 1, due tomorrow, with the missed positions added (newest last, the last 20 kept).
 * A clean run keeps the missed keys it had, so the positions that went wrong stay on the list until
 * newer ones push them out.
 */
export function applyResult(prev: ReviewState | undefined, clean: boolean, missedKeys: string[], today: string): ReviewState {
  const before: ReviewState = prev ?? { box: 0, due: today, runs: 0, cleanRuns: 0, missedKeys: [] }
  const runs = before.runs + 1
  const cleanRuns = before.cleanRuns + (clean ? 1 : 0)
  if (!clean) {
    const added = new Set(missedKeys)
    const kept = [...before.missedKeys.filter((k) => !added.has(k)), ...added].slice(-MAX_MISSED_KEYS)
    return { box: MISS_BOX, due: addDays(today, BOX_DAYS[MISS_BOX]), runs, cleanRuns, missedKeys: kept }
  }
  if (prev && today < prev.due) {
    return { box: prev.box, due: prev.due, runs, cleanRuns, missedKeys: [...prev.missedKeys] }
  }
  const box = Math.min(before.box + 1, TOP_BOX) as ReviewState['box']
  return { box, due: addDays(today, BOX_DAYS[box]), runs, cleanRuns, missedKeys: [...before.missedKeys] }
}

export function isMastered(r: ReviewState): boolean {
  return r.box >= MASTERED_BOX
}

/** The review keys due on `today` or earlier: the most overdue first, ties by key. */
export function dueKeys(p: Progress, today: string): string[] {
  return Object.entries(p.reviews)
    .filter(([, r]) => r.due <= today)
    .sort(([ka, a], [kb, b]) => (a.due < b.due ? -1 : a.due > b.due ? 1 : ka < kb ? -1 : ka > kb ? 1 : 0))
    .map(([k]) => k)
}
