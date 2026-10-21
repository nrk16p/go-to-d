import { describe, expect, it } from 'vitest'
import {
  CORNER_REGION,
  inRegion,
  inverse,
  parseGtp,
  toGtp,
  transform,
  transformRegion,
  type Pt,
  type Sym,
} from '../../src/go/coords'

const SYMS: Sym[] = [0, 1, 2, 3, 4, 5, 6, 7]

function allPoints(): Pt[] {
  const pts: Pt[] = []
  for (let y = 0; y < 19; y++) for (let x = 0; x < 19; x++) pts.push({ x, y })
  return pts
}

describe('GTP coordinates', () => {
  it('parses known points', () => {
    expect(parseGtp('Q16')).toEqual({ x: 15, y: 3 })
    expect(parseGtp('A19')).toEqual({ x: 0, y: 0 })
    expect(parseGtp('T1')).toEqual({ x: 18, y: 18 })
    expect(parseGtp('D4')).toEqual({ x: 3, y: 15 })
  })

  it('skips the letter I', () => {
    expect(parseGtp('H10')).toEqual({ x: 7, y: 9 })
    expect(parseGtp('J10')).toEqual({ x: 8, y: 9 })
    expect(() => parseGtp('I5')).toThrow()
  })

  it('rejects malformed input', () => {
    for (const bad of ['', 'Q', '16', 'Q0', 'Q20', 'U5', 'Q-1', 'Q1.5', 'Q16x', 'tenuki']) {
      expect(() => parseGtp(bad), bad).toThrow()
    }
  })

  it('toGtp round-trips all 361 points', () => {
    const pts = allPoints()
    expect(pts).toHaveLength(361)
    const names = new Set<string>()
    for (const p of pts) {
      const s = toGtp(p)
      names.add(s)
      expect(parseGtp(s)).toEqual(p)
    }
    expect(names.size).toBe(361)
    expect(toGtp({ x: 15, y: 3 })).toBe('Q16')
  })

  it('toGtp rejects points off the board', () => {
    expect(() => toGtp({ x: 19, y: 0 })).toThrow()
    expect(() => toGtp({ x: 0, y: -1 })).toThrow()
  })
})

describe('symmetries', () => {
  it('sym 0 is the identity', () => {
    for (const p of allPoints()) expect(transform(p, 0)).toEqual(p)
  })

  it('every sym is a bijection on the board', () => {
    for (const s of SYMS) {
      const seen = new Set<string>()
      for (const p of allPoints()) {
        const q = transform(p, s)
        expect(q.x).toBeGreaterThanOrEqual(0)
        expect(q.x).toBeLessThanOrEqual(18)
        expect(q.y).toBeGreaterThanOrEqual(0)
        expect(q.y).toBeLessThanOrEqual(18)
        seen.add(`${q.x},${q.y}`)
      }
      expect(seen.size, `sym ${s}`).toBe(361)
    }
  })

  it('the 8 syms are all different maps', () => {
    const probe = { x: 3, y: 5 }
    const images = new Set(SYMS.map((s) => JSON.stringify(transform(probe, s))))
    expect(images.size).toBe(8)
  })

  it('syms 1-3 are rotations and 4-7 are reflections (orientation check)', () => {
    // Orientation = sign of the cross product of the images of the x and y unit steps.
    const orientation = (s: Sym) => {
      const o = transform({ x: 5, y: 5 }, s)
      const dx = transform({ x: 6, y: 5 }, s)
      const dy = transform({ x: 5, y: 6 }, s)
      return Math.sign((dx.x - o.x) * (dy.y - o.y) - (dx.y - o.y) * (dy.x - o.x))
    }
    for (const s of [0, 1, 2, 3] as Sym[]) expect(orientation(s), `sym ${s}`).toBe(1)
    for (const s of [4, 5, 6, 7] as Sym[]) expect(orientation(s), `sym ${s}`).toBe(-1)
  })

  it('inverse undoes transform', () => {
    for (const s of SYMS) {
      for (const p of allPoints()) {
        expect(transform(transform(p, s), inverse(s))).toEqual(p)
        expect(transform(transform(p, inverse(s)), s)).toEqual(p)
      }
    }
  })

  it('Q16 lands on each of the four star points across syms', () => {
    const q16 = parseGtp('Q16')
    const hits = SYMS.map((s) => toGtp(transform(q16, s)))
    expect(new Set(hits)).toEqual(new Set(['Q16', 'D16', 'D4', 'Q4']))
    for (const star of ['Q16', 'D16', 'D4', 'Q4']) {
      expect(hits.filter((h) => h === star), star).toHaveLength(2)
    }
  })
})

describe('regions', () => {
  it('CORNER_REGION is the upper-right 11x11 block', () => {
    expect(CORNER_REGION).toEqual({ xMin: 8, xMax: 18, yMin: 0, yMax: 10 })
  })

  it('inRegion is inclusive on every edge', () => {
    expect(inRegion({ x: 8, y: 0 }, CORNER_REGION)).toBe(true)
    expect(inRegion({ x: 18, y: 10 }, CORNER_REGION)).toBe(true)
    expect(inRegion({ x: 7, y: 5 }, CORNER_REGION)).toBe(false)
    expect(inRegion({ x: 12, y: 11 }, CORNER_REGION)).toBe(false)
  })

  it('transformRegion(CORNER_REGION, s) contains transform(Q16, s) for every s', () => {
    const q16 = parseGtp('Q16')
    for (const s of SYMS) {
      expect(inRegion(transform(q16, s), transformRegion(CORNER_REGION, s)), `sym ${s}`).toBe(true)
    }
  })

  it('transformRegion agrees with transforming every point of the region', () => {
    for (const s of SYMS) {
      const r = transformRegion(CORNER_REGION, s)
      expect(r.xMax - r.xMin).toBe(10)
      expect(r.yMax - r.yMin).toBe(10)
      for (const p of allPoints()) {
        expect(inRegion(transform(p, s), r), `sym ${s} ${toGtp(p)}`).toBe(inRegion(p, CORNER_REGION))
      }
    }
  })

  it('the four rotations cover all four corners', () => {
    const corners = new Set(
      ([0, 1, 2, 3] as Sym[]).map((s) => {
        const r = transformRegion(CORNER_REGION, s)
        return `${r.xMin},${r.xMax},${r.yMin},${r.yMax}`
      }),
    )
    expect(corners).toEqual(new Set(['8,18,0,10', '8,18,8,18', '0,10,8,18', '0,10,0,10']))
  })
})
