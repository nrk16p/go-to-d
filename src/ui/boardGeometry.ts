// Where things go on the drawn board: which points are shown, the SVG coordinate system, labels.
// One SVG unit is the distance between two lines; point (x, y) sits at (x - view.xMin, y - view.yMin).

import { BOARD_SIZE, toGtp, type Pt, type Region } from '../go/coords'

const LAST = BOARD_SIZE - 1

export const FULL_BOARD: Region = { xMin: 0, xMax: LAST, yMin: 0, yMax: LAST }

/** The points the board shows: the session region plus one line of margin, clamped to the board. No region = all 361. */
export function shownRegion(region?: Region): Region {
  if (!region) return FULL_BOARD
  return {
    xMin: Math.max(0, region.xMin - 1),
    xMax: Math.min(LAST, region.xMax + 1),
    yMin: Math.max(0, region.yMin - 1),
    yMax: Math.min(LAST, region.yMax + 1),
  }
}

export const STAR_POINTS: Pt[] = [3, 9, 15].flatMap((x) => [3, 9, 15].map((y) => ({ x, y })))

/** The column letter (GTP, no I) and the row number of a point. */
export function columnLabel(x: number): string {
  return toGtp({ x, y: 0 }).replace(/\d+$/, '')
}

export function rowLabel(y: number): string {
  return String(BOARD_SIZE - y)
}

export interface BoardLayout {
  view: Region
  cols: number
  rows: number
  /** The SVG viewBox. */
  box: { x: number; y: number; w: number; h: number }
  /** Edge of the board surface around the outer points. */
  pad: number
  /** Font size of the coordinate labels, in line spacings. */
  label: number
  /** Centre of the number column (left) and of the letter row (bottom). */
  numbersX: number
  lettersY: number
}

/**
 * Labels sit on the left (row numbers) and along the bottom (column letters). They are bigger on
 * the full board, where the lines are closer together, so they stay about 10 px or more on a phone.
 */
export function layoutFor(view: Region): BoardLayout {
  const cols = view.xMax - view.xMin + 1
  const rows = view.yMax - view.yMin + 1
  const full = cols === BOARD_SIZE && rows === BOARD_SIZE
  const pad = 0.55
  const label = full ? 0.6 : 0.44
  const left = label * 1.45
  const bottom = label * 1.35
  return {
    view,
    cols,
    rows,
    box: { x: -pad - left, y: -pad, w: cols - 1 + 2 * pad + left, h: rows - 1 + 2 * pad + bottom },
    pad,
    label,
    numbersX: -pad - left / 2,
    lettersY: rows - 1 + pad + bottom / 2,
  }
}

/** A slightly uneven loop, a bit more than one turn: how a teacher circles a point with a pen. */
function penLoop(): string {
  const turns = 1.08
  const steps = 44
  const start = (-150 * Math.PI) / 180
  const parts: string[] = []
  for (let i = 0; i <= steps; i++) {
    const t = i / steps
    const a = start + t * turns * 2 * Math.PI
    const r = 0.6 + 0.035 * Math.sin(3 * a + 0.7) + 0.05 * t
    parts.push(`${i === 0 ? 'M' : 'L'}${(r * Math.cos(a)).toFixed(3)} ${(r * Math.sin(a)).toFixed(3)}`)
  }
  return parts.join(' ')
}

export const PEN_LOOP = penLoop()
export const PEN_CROSS = 'M-0.23 -0.23 L0.23 0.23 M0.23 -0.23 L-0.23 0.23'
