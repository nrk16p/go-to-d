import { describe, expect, it } from 'vitest'
import { buildBook } from '../../src/book/build'
import type { BookNode, FamilyDef } from '../../src/book/types'
import { mulberry32, pickTeacherMove } from '../../src/session/pick'
import { FIXTURE_FAMILY } from '../book/fixture'

// The root of this family has four White children:
//   R14 joseki (weight 3), R17 alternative (weight 1), O17 trick (weight 2), T19 mistake (weight 10).
const WEIGHTED: FamilyDef = {
  id: 'star44',
  name: 'pick test',
  setup: 'handicap4',
  start: [{ c: 'B', at: 'Q16', note: 'corner' }],
  patterns: [
    {
      id: 'main',
      name: 'main',
      difficulty: 1,
      order: 1,
      line: [
        { c: 'W', at: 'R14', note: 'n', weight: 3 },
        { c: 'B', at: 'Q14', note: 'n' },
      ],
      branches: [{ after: 0, move: { c: 'W', at: 'T19', note: 'n', kind: 'mistake', weight: 10 } }],
    },
    {
      id: 'side',
      name: 'side',
      difficulty: 1,
      order: 2,
      line: [
        { c: 'W', at: 'R17', note: 'n', kind: 'alternative', weight: 1 },
        { c: 'B', at: 'R16', note: 'n' },
        { c: 'W', at: 'S16', note: 'n' },
      ],
    },
    {
      id: 'trick',
      name: 'trick',
      difficulty: 1,
      order: 3,
      line: [
        { c: 'W', at: 'O17', note: 'n', kind: 'trick', weight: 2 },
        { c: 'B', at: 'P17', note: 'n' },
      ],
    },
  ],
}

const book = buildBook([WEIGHTED])
const root = book.families.star44.root
const byKey = (key: string) => root.children.find((c) => c.key === key)!

function share(picks: Array<BookNode | null>, key: string): number {
  return picks.filter((p) => p?.key === key).length / picks.length
}

describe('mulberry32', () => {
  it('is deterministic per seed and stays in [0, 1)', () => {
    const a = mulberry32(42)
    const b = mulberry32(42)
    const xs = Array.from({ length: 1000 }, () => a())
    expect(Array.from({ length: 1000 }, () => b())).toEqual(xs)
    expect(xs.every((x) => x >= 0 && x < 1)).toBe(true)
    expect(mulberry32(43)()).not.toBe(xs[0])
  })
})

describe('pickTeacherMove: drill', () => {
  it('always follows the drilled path, whatever the rng says', () => {
    const path = book.patterns.side.path
    for (let seed = 1; seed <= 50; seed++) {
      const rng = mulberry32(seed)
      expect(pickTeacherMove(root, { mode: 'drill', drillPath: path, missed: new Set(), rng })).toBe(path[0])
      expect(pickTeacherMove(path[0], { mode: 'drill', drillPath: path, missed: new Set(), rng })).toBe(path[1])
    }
  })

  it('returns null at a leaf, and when no child is on the path', () => {
    const path = book.patterns.side.path
    const rng = mulberry32(1)
    expect(pickTeacherMove(path[2], { mode: 'drill', drillPath: path, missed: new Set(), rng })).toBeNull()
    const other = book.patterns.main.path[0]
    expect(pickTeacherMove(other, { mode: 'drill', drillPath: path, missed: new Set(), rng })).toBeNull()
  })
})

describe('pickTeacherMove: free', () => {
  const pick1000 = (missed: Set<string>, seed = 7) => {
    const rng = mulberry32(seed)
    return Array.from({ length: 1000 }, () => pickTeacherMove(root, { mode: 'free', missed, rng }))
  }

  it('follows the weights over joseki, alternative and trick children (±5%)', () => {
    const picks = pick1000(new Set())
    expect(Math.abs(share(picks, 'W:R14') - 3 / 6)).toBeLessThanOrEqual(0.05)
    expect(Math.abs(share(picks, 'W:R17') - 1 / 6)).toBeLessThanOrEqual(0.05)
    expect(Math.abs(share(picks, 'W:O17') - 2 / 6)).toBeLessThanOrEqual(0.05)
  })

  it('never returns a mistake child, however heavy', () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      expect(pick1000(new Set(), seed).some((p) => p?.key === 'W:T19')).toBe(false)
    }
  })

  it('doubles the weight of a child whose subtree holds a missed key (the child itself counts)', () => {
    const deep = pick1000(new Set(['W:R17/B:R16/W:S16']))
    expect(Math.abs(share(deep, 'W:R17') - 2 / 7)).toBeLessThanOrEqual(0.05)
    expect(Math.abs(share(deep, 'W:R14') - 3 / 7)).toBeLessThanOrEqual(0.05)
    const self = pick1000(new Set(['W:R17']))
    expect(Math.abs(share(self, 'W:R17') - 2 / 7)).toBeLessThanOrEqual(0.05)
  })

  it('returns null at a leaf and when only mistakes are left', () => {
    const rng = mulberry32(1)
    const leaf = book.patterns.side.path[2]
    expect(pickTeacherMove(leaf, { mode: 'free', missed: new Set(), rng })).toBeNull()
    // T19 is a mistake with no children; a node whose only child is a mistake gives null.
    const onlyMistake: BookNode = { ...root, children: [byKey('W:T19')] }
    expect(pickTeacherMove(onlyMistake, { mode: 'free', missed: new Set(), rng })).toBeNull()
  })

  it('picks the same way for the same seed', () => {
    const fixture = buildBook([FIXTURE_FAMILY])
    const node = fixture.patterns['fixture-hane'].path[1]
    const run = () => {
      const rng = mulberry32(99)
      return Array.from({ length: 20 }, () => pickTeacherMove(node, { mode: 'free', missed: new Set(), rng })!.key)
    }
    expect(run()).toEqual(run())
    expect(new Set(run()).has('W:R14/B:Q14/W:T19')).toBe(false)
  })
})
