// Progress in localStorage, with JSON export and import as the backup. Every storage access is inside
// try/catch: in a private window or with storage blocked the app still works, on defaults held in memory.

import { DEFAULT_VISITS } from '../engine/model'
import type { SessionResult } from '../session/controller'
import { DEFAULT_THRESHOLDS } from '../session/judge'
import { addDays, applyResult, isDay, reviewKey, type Progress, type ReviewState, type Settings } from './srs'

export const STORAGE_KEY = 'go-to-d:progress'

const NOT_A_PROGRESS_FILE = 'Not a Go-to-D progress file'

/** A fresh, empty progress. A new object every time, so callers can't share or change the defaults. */
export function defaultProgress(): Progress {
  return {
    version: 1,
    reviews: {},
    streak: { count: 0, lastDay: null },
    settings: {
      thresholds: { ...DEFAULT_THRESHOLDS },
      visits: DEFAULT_VISITS,
      newPerDay: 2,
      iosHintDismissed: false,
    },
  }
}

/** Today's local calendar day, "YYYY-MM-DD". */
export function todayLocal(d: Date = new Date()): string {
  const y = String(d.getFullYear()).padStart(4, '0')
  return `${y}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// ---------- validation ----------

type Obj = Record<string, unknown>

function isObj(v: unknown): v is Obj {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function isCount(v: unknown): v is number {
  return typeof v === 'number' && Number.isInteger(v) && v >= 0
}

function isReview(v: unknown): v is ReviewState {
  return (
    isObj(v) &&
    Number.isInteger(v.box) &&
    (v.box as number) >= 0 &&
    (v.box as number) <= 5 &&
    isDay(v.due) &&
    isCount(v.runs) &&
    isCount(v.cleanRuns) &&
    Array.isArray(v.missedKeys) &&
    v.missedKeys.every((k) => typeof k === 'string')
  )
}

function finite(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v)
}

/** Settings from whatever was saved: each field that is missing or the wrong type falls back to its default. */
function settingsFrom(raw: Obj): Settings {
  const d = defaultProgress().settings
  const t = isObj(raw.thresholds) ? raw.thresholds : {}
  return {
    thresholds: {
      fine: finite(t.fine) && t.fine >= 0 ? t.fine : d.thresholds.fine,
      big: finite(t.big) && t.big >= 0 ? t.big : d.thresholds.big,
    },
    visits: finite(raw.visits) && Number.isInteger(raw.visits) && raw.visits >= 1 ? raw.visits : d.visits,
    newPerDay: isCount(raw.newPerDay) ? raw.newPerDay : d.newPerDay,
    iosHintDismissed: typeof raw.iosHintDismissed === 'boolean' ? raw.iosHintDismissed : d.iosHintDismissed,
  }
}

/** A clean Progress from parsed JSON, or null when it isn't a version 1 progress file. Copies, never aliases. */
function progressFrom(raw: unknown): Progress | null {
  if (!isObj(raw) || raw.version !== 1) return null
  if (!isObj(raw.reviews) || !isObj(raw.streak) || !isObj(raw.settings)) return null
  const { count, lastDay } = raw.streak
  if (!isCount(count) || !(lastDay === null || isDay(lastDay))) return null

  const entries: Array<[string, ReviewState]> = []
  for (const [key, r] of Object.entries(raw.reviews)) {
    if (!isReview(r)) return null
    entries.push([key, { box: r.box, due: r.due, runs: r.runs, cleanRuns: r.cleanRuns, missedKeys: [...r.missedKeys] }])
  }
  return {
    version: 1,
    // fromEntries defines own properties, so a key called "__proto__" stays plain data.
    reviews: Object.fromEntries(entries),
    streak: { count, lastDay },
    settings: settingsFrom(raw.settings),
  }
}

// ---------- storage ----------

/** localStorage, or null when this browser won't give it (even reading the property can throw). */
function storage(): Storage | null {
  try {
    return globalThis.localStorage ?? null
  } catch {
    return null
  }
}

/** The saved progress; defaults when nothing usable is saved. Never writes. */
export function loadProgress(): Progress {
  try {
    const raw = storage()?.getItem(STORAGE_KEY)
    if (raw == null) return defaultProgress()
    return progressFrom(JSON.parse(raw)) ?? defaultProgress()
  } catch {
    return defaultProgress()
  }
}

/** Saves `p`. Fails quietly when storage is missing, blocked or full: the app keeps going on what it has in memory. */
export function saveProgress(p: Progress): void {
  try {
    storage()?.setItem(STORAGE_KEY, JSON.stringify(p))
  } catch {
    // Private window, blocked storage or quota: nothing to do.
  }
}

export function exportProgress(p: Progress): string {
  return JSON.stringify(p, null, 2)
}

/** Reads an exported file. Throws on anything that isn't one. Never touches storage: the caller saves. */
export function importProgress(json: string): Progress {
  let raw: unknown
  try {
    raw = JSON.parse(json)
  } catch {
    throw new Error(NOT_A_PROGRESS_FILE)
  }
  const p = progressFrom(raw)
  if (!p) throw new Error(NOT_A_PROGRESS_FILE)
  return p
}

// ---------- recording ----------

/** The streak after a session on `today`: same day unchanged, next day +1, a gap back to 1. */
function nextStreak(streak: Progress['streak'], today: string): Progress['streak'] {
  const last = streak.lastDay
  if (last === today) return { ...streak }
  // A last day after today means the clock moved back (or the owner flew west). Don't punish that.
  if (last !== null && last > today) return { ...streak }
  if (last !== null && last === addDays(today, -1)) return { count: streak.count + 1, lastDay: today }
  return { count: 1, lastDay: today }
}

/**
 * The progress after a finished session: every pattern it reached gets its review updated on the
 * session's side, and the streak moves once per local day. A session that never reached a named
 * pattern (empty patternIds) still counts toward the streak. Returns a new object.
 */
export function recordSession(p: Progress, r: SessionResult, today: string): Progress {
  const reviews = { ...p.reviews }
  for (const id of new Set(r.patternIds)) {
    const key = reviewKey(id, r.side)
    reviews[key] = applyResult(reviews[key], r.clean, r.missedKeys, today)
  }
  return { ...p, reviews, streak: nextStreak(p.streak, today) }
}
