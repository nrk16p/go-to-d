// Board geometry: points, GTP names, the 8 board symmetries and rectangular regions.
// Pure TypeScript, no DOM. Shapes match web-katrain's engine types (board[y][x]).

/** A point on the 19x19 board: x 0..18 left to right, y 0..18 top to bottom. */
export type Pt = { x: number; y: number }

export type Color = 'black' | 'white'

/** board[y][x]; null = empty. */
export type Board = (Color | null)[][]

export type Move = { x: number; y: number; player: Color }

export const BOARD_SIZE = 19

// GTP columns skip the letter I.
const GTP_COLUMNS = 'ABCDEFGHJKLMNOPQRST'

/** 'Q16' -> {x: 15, y: 3}. Throws on anything that is not a point on the board. */
export function parseGtp(s: string): Pt {
  const m = /^([A-Za-z])(\d{1,2})$/.exec(s)
  if (!m) throw new Error(`Bad GTP point: "${s}"`)
  const x = GTP_COLUMNS.indexOf(m[1].toUpperCase())
  const row = Number(m[2])
  if (x < 0) throw new Error(`Bad GTP column in "${s}"`)
  if (row < 1 || row > BOARD_SIZE) throw new Error(`Bad GTP row in "${s}"`)
  return { x, y: BOARD_SIZE - row }
}

/** {x: 15, y: 3} -> 'Q16'. */
export function toGtp(p: Pt): string {
  if (!Number.isInteger(p.x) || !Number.isInteger(p.y) || p.x < 0 || p.x >= BOARD_SIZE || p.y < 0 || p.y >= BOARD_SIZE) {
    throw new Error(`Point off the board: ${p.x},${p.y}`)
  }
  return `${GTP_COLUMNS[p.x]}${BOARD_SIZE - p.y}`
}

/**
 * The 8 symmetries of the square board.
 * 0 = identity, 1-3 = rotate 90/180/270 degrees clockwise,
 * 4-7 = mirror left-right first, then rotate by (sym - 4) * 90 degrees.
 */
export type Sym = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7

const LAST = BOARD_SIZE - 1

export function transform(p: Pt, sym: Sym): Pt {
  let { x, y } = p
  if (sym >= 4) x = LAST - x
  for (let i = sym % 4; i > 0; i--) {
    // 90 degrees clockwise with y pointing down
    const nx = LAST - y
    y = x
    x = nx
  }
  return { x, y }
}

/** The sym that undoes `sym`: rotations invert, reflections are their own inverse. */
export function inverse(sym: Sym): Sym {
  return (sym >= 4 ? sym : (4 - sym) % 4) as Sym
}

/** An inclusive rectangle of points. */
export type Region = { xMin: number; xMax: number; yMin: number; yMax: number }

/** The studied corner in the canonical frame: upper right, 11x11 points. */
export const CORNER_REGION: Region = { xMin: 8, xMax: 18, yMin: 0, yMax: 10 }

export function transformRegion(r: Region, sym: Sym): Region {
  const a = transform({ x: r.xMin, y: r.yMin }, sym)
  const b = transform({ x: r.xMax, y: r.yMax }, sym)
  return {
    xMin: Math.min(a.x, b.x),
    xMax: Math.max(a.x, b.x),
    yMin: Math.min(a.y, b.y),
    yMax: Math.max(a.y, b.y),
  }
}

export function inRegion(p: Pt, r: Region): boolean {
  return p.x >= r.xMin && p.x <= r.xMax && p.y >= r.yMin && p.y <= r.yMax
}
