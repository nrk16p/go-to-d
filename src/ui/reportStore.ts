// Hands the finished session from the Spar screen to the Report screen. Kept in memory, with a copy
// in sessionStorage so a reload of #/report still shows it (best effort: storage may be blocked).

import type { FamilyId } from '../book/types'
import type { Pt, Region } from '../go/coords'
import type { Board as Grid } from '../go/coords'
import type { MistakeRecord, SessionResult } from '../session/controller'
import type { Side } from '../session/sides'

export interface SessionReport {
  result: SessionResult
  /** Whether saveProgress said the progress was stored. */
  saved: boolean
  title: string
  family: FamilyId
  side: Side
  mode: 'drill' | 'free'
  patternId?: string
  /** The final position, to draw. */
  board: Grid
  region: Region
  lastMove?: Pt
  /** The note on the last book move, oriented to the board. */
  note: string | null
  noteLow: boolean
  /** Why the session stopped early, if it did. */
  message: string | null
  right: number
  unchecked: number
  /**
   * R51: each position the owner went wrong in, for "Your mistakes". Missing in a report stored before
   * R51; the screen then just has no review.
   */
  mistakes?: MistakeRecord[]
  /** The session's seed, so a practice run from a mistake plays the same way (R51). */
  seed?: number
  /** A practice run from one move (R51): nothing was saved, by design. */
  practice?: boolean
}

/** Whether `m` looks like a MistakeRecord well enough to draw: a stored one may be from another version. */
function isRecord(m: unknown): m is MistakeRecord {
  if (!m || typeof m !== 'object') return false
  const r = m as Partial<MistakeRecord>
  return (
    typeof r.moveNumber === 'number' &&
    Array.isArray(r.before) &&
    r.before.length === 19 &&
    !!r.region &&
    typeof r.region === 'object' &&
    (r.pointsLost === null || typeof r.pointsLost === 'number')
  )
}

/**
 * The review list (R51): biggest loss first, a loss the engine couldn't put a number on last, and
 * otherwise in the order played. Records that can't be drawn are left out.
 */
export function reviewList(r: Pick<SessionReport, 'mistakes'>): MistakeRecord[] {
  const list = Array.isArray(r.mistakes) ? r.mistakes.filter(isRecord) : []
  return list.sort((a, b) => {
    if (a.pointsLost === null || b.pointsLost === null) {
      if (a.pointsLost !== b.pointsLost) return a.pointsLost === null ? 1 : -1
    } else if (a.pointsLost !== b.pointsLost) return b.pointsLost - a.pointsLost
    return a.moveNumber - b.moveNumber
  })
}

const KEY = 'go-to-d:last-report'
let last: SessionReport | null = null

export function setLastReport(r: SessionReport): void {
  last = r
  try {
    sessionStorage.setItem(KEY, JSON.stringify(r))
  } catch {
    // Only this tab's memory then.
  }
}

export function getLastReport(): SessionReport | null {
  if (last) return last
  try {
    const raw = sessionStorage.getItem(KEY)
    const r = raw ? (JSON.parse(raw) as SessionReport) : null
    if (r && typeof r === 'object' && r.result && Array.isArray(r.board)) last = r
  } catch {
    // Nothing readable: no report.
  }
  return last
}
