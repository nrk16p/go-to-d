// Progress in localStorage, with JSON export and import as the backup. Every storage access is inside
// try/catch: in a private window or with storage blocked the app still works, on defaults held in memory.

import { DEFAULT_VISITS } from '../engine/model'
import type { SessionResult } from '../session/controller'
import { DEFAULT_THRESHOLDS } from '../session/judge'
import { addDays, applyResult, isDay, reviewKey, type Progress, type ReviewState, type Settings } from './srs'

export const STORAGE_KEY = 'go-to-d:progress'
/** Where loadProgress parks saved text it can't read, so a later save can't destroy it. */
export const UNREADABLE_BACKUP_KEY = 'go-to-d:progress:unreadable'

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

/** The range the Settings form allows, and that load and import hold saved values to. */
export const SETTING_LIMITS = {
  visits: { min: 16, max: 400 },
  newPerDay: { min: 0, max: 10 },
} as const

const clamp = (n: number, r: { min: number; max: number }) => Math.min(r.max, Math.max(r.min, n))

/**
 * Settings from whatever was saved: each field that is missing or the wrong type falls back to its default.
 * Visits and new per day are held to SETTING_LIMITS. Thresholds where fine isn't below big go back to
 * the default pair, as the form would never have saved them.
 */
function settingsFrom(raw: Obj): Settings {
  const d = defaultProgress().settings
  const t = isObj(raw.thresholds) ? raw.thresholds : {}
  const fine = finite(t.fine) && t.fine >= 0 ? t.fine : d.thresholds.fine
  const big = finite(t.big) && t.big >= 0 ? t.big : d.thresholds.big
  return {
    thresholds: fine < big ? { fine, big } : { ...d.thresholds },
    visits:
      finite(raw.visits) && Number.isInteger(raw.visits) ? clamp(raw.visits, SETTING_LIMITS.visits) : d.visits,
    newPerDay: isCount(raw.newPerDay) ? clamp(raw.newPerDay, SETTING_LIMITS.newPerDay) : d.newPerDay,
    iosHintDismissed: typeof raw.iosHintDismissed === 'boolean' ? raw.iosHintDismissed : d.iosHintDismissed,
  }
}

/**
 * A clean Progress from parsed JSON, or null when it isn't a version 1 Go-to-D file (not an object, another
 * version, or no `reviews` object). Past that point it repairs piece by piece instead of giving up: a review
 * that can't be read is dropped and the rest kept, a bad streak starts over, and settings fall back to the
 * defaults field by field. Copies, never aliases. Load and import both use it.
 */
function progressFrom(raw: unknown): Progress | null {
  if (!isObj(raw) || raw.version !== 1 || !isObj(raw.reviews)) return null

  const entries: Array<[string, ReviewState]> = []
  for (const [key, r] of Object.entries(raw.reviews)) {
    if (!isReview(r)) continue
    // A missing or unreadable first day is unknown (R44): the review itself is still good.
    const firstDay = isDay(r.firstDay) ? { firstDay: r.firstDay } : {}
    entries.push([key, { box: r.box, due: r.due, runs: r.runs, cleanRuns: r.cleanRuns, missedKeys: [...r.missedKeys], ...firstDay }])
  }
  const s = raw.streak
  const streak =
    isObj(s) && isCount(s.count) && (s.lastDay === null || isDay(s.lastDay))
      ? { count: s.count, lastDay: s.lastDay }
      : { count: 0, lastDay: null }
  return {
    version: 1,
    // fromEntries defines own properties, so a key called "__proto__" stays plain data.
    reviews: Object.fromEntries(entries),
    streak,
    settings: settingsFrom(isObj(raw.settings) ? raw.settings : {}),
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

/**
 * The saved progress; defaults when nothing usable is saved. It never writes the progress key. Text it
 * can't use (corrupt JSON, another version) is copied once to UNREADABLE_BACKUP_KEY first, because the
 * next save will replace it; an earlier backup is kept.
 */
export function loadProgress(): Progress {
  try {
    const s = storage()
    const raw = s?.getItem(STORAGE_KEY)
    if (s === null || raw == null) return defaultProgress()
    let p: Progress | null = null
    try {
      p = progressFrom(JSON.parse(raw))
    } catch {
      // Not JSON.
    }
    if (p) return p
    backUpUnreadable(s, raw)
  } catch {
    // Storage wouldn't answer: carry on with defaults.
  }
  return defaultProgress()
}

function backUpUnreadable(s: Storage, raw: string): void {
  try {
    if (s.getItem(UNREADABLE_BACKUP_KEY) == null) s.setItem(UNREADABLE_BACKUP_KEY, raw)
  } catch {
    // Nowhere to put it: nothing more to do.
  }
}

/**
 * Saves `p`. Returns false when storage is missing, blocked or full (the app keeps going on what it
 * has in memory); the caller decides whether to tell the owner.
 */
export function saveProgress(p: Progress): boolean {
  try {
    const s = storage()
    if (!s) return false
    s.setItem(STORAGE_KEY, JSON.stringify(p))
    return true
  } catch {
    return false
  }
}

export function exportProgress(p: Progress): string {
  return JSON.stringify(p, null, 2)
}

/**
 * Reads an exported file. Throws on anything that isn't a Go-to-D progress file; a real one with a few
 * odd pieces is repaired the same way load does. Never touches storage: the caller saves.
 */
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

/**
 * The streak after a session on `today`: same day unchanged, next day +1, a gap back to 1. A last day
 * after today (clock set back, or flying west) counts as today, so the streak can't freeze.
 */
function nextStreak(streak: Progress['streak'], today: string): Progress['streak'] {
  const last = streak.lastDay
  if (last === null) return { count: 1, lastDay: today }
  if (last >= today) return { count: streak.count, lastDay: today }
  if (last === addDays(today, -1)) return { count: streak.count + 1, lastDay: today }
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
