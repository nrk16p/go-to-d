// Hands the finished session from the Spar screen to the Report screen. Kept in memory, with a copy
// in sessionStorage so a reload of #/report still shows it (best effort: storage may be blocked).

import type { FamilyId } from '../book/types'
import type { Pt, Region } from '../go/coords'
import type { Board as Grid } from '../go/coords'
import type { SessionResult } from '../session/controller'
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
  /** The local day it was saved on (YYYY-MM-DD). */
  day: string
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
