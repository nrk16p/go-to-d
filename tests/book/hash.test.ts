import { describe, expect, it } from 'vitest'
import { buildBook, familyHash, nodeSetups } from '../../src/book/build'
import { SETUPS } from '../../src/book/setups'
import type { Book, FamilyDef, PatternDef } from '../../src/book/types'
import { FIXTURE_FAMILY } from './fixture'

function clone<T>(x: T): T {
  return JSON.parse(JSON.stringify(x)) as T
}

function hashOf(def: FamilyDef): string {
  return familyHash(buildBook([def]), def.id)
}

function pattern(def: FamilyDef, id: string): PatternDef {
  const p = def.patterns.find((x) => x.id === id)
  if (!p) throw new Error(`no pattern ${id}`)
  return p
}

describe('familyHash', () => {
  const base = hashOf(FIXTURE_FAMILY)

  it('is a short stable string', () => {
    expect(base).toMatch(/^[0-9a-f]{14}$/)
    expect(hashOf(clone(FIXTURE_FAMILY))).toBe(base)
  })

  it('ignores everything the engine cannot see: notes, confidence, weights, names, ids, order', () => {
    const def = clone(FIXTURE_FAMILY)
    def.name = 'renamed'
    for (const p of def.patterns) {
      p.name = `${p.name} (edited)`
      p.difficulty = 3
      p.order = 9
      for (const m of p.line) {
        m.note = `${m.note} Edited.`
        m.confidence = 'low'
        m.weight = 5
      }
      for (const b of p.branches ?? []) {
        b.move.note = 'something else'
        for (const m of b.then ?? []) m.note = ''
      }
    }
    for (const s of def.start) s.note = 'new words'
    pattern(def, 'fixture-hane').id = 'fixture-renamed'
    def.patterns.reverse()
    expect(hashOf(def)).toBe(base)
  })

  it('changes when a move changes: point, colour, or an extra move', () => {
    const point = clone(FIXTURE_FAMILY)
    pattern(point, 'fixture-hane').line[4].at = 'R12'
    expect(hashOf(point)).not.toBe(base)

    const colour = clone(FIXTURE_FAMILY)
    pattern(colour, 'fixture-hane').line[0].c = 'B'
    expect(hashOf(colour)).not.toBe(base)

    const longer = clone(FIXTURE_FAMILY)
    pattern(longer, 'fixture-hane').line.push({ c: 'B', at: 'S13', note: 'one more' })
    expect(hashOf(longer)).not.toBe(base)
  })

  it('changes when a branch is added or removed', () => {
    const noBranch = clone(FIXTURE_FAMILY)
    delete pattern(noBranch, 'fixture-hane').branches
    expect(hashOf(noBranch)).not.toBe(base)
  })

  it('changes when a node kind changes', () => {
    const def = clone(FIXTURE_FAMILY)
    pattern(def, 'fixture-hane').line[2].kind = 'alternative'
    expect(hashOf(def)).not.toBe(base)
  })

  it('changes with the family setup, a pattern setup override and the corner stones', () => {
    const familySetup = clone(FIXTURE_FAMILY)
    familySetup.setup = 'even'
    expect(hashOf(familySetup)).not.toBe(base)

    const override = clone(FIXTURE_FAMILY)
    pattern(override, 'fixture-crawl').setup = 'even'
    expect(hashOf(override)).not.toBe(base)

    const start = clone(FIXTURE_FAMILY)
    start.start[0].at = 'R16'
    expect(hashOf(start)).not.toBe(base)
  })

  it('changes when the setup itself is redefined (komi, stones)', () => {
    const original = SETUPS.handicap4
    try {
      SETUPS.handicap4 = (corner) => ({ ...original(corner), komi: 6.5 })
      expect(hashOf(FIXTURE_FAMILY)).not.toBe(base)
      SETUPS.handicap4 = (corner) => ({ ...original(corner), stones: original(corner).stones.slice(0, -1) })
      expect(hashOf(FIXTURE_FAMILY)).not.toBe(base)
    } finally {
      SETUPS.handicap4 = original
    }
    expect(hashOf(FIXTURE_FAMILY)).toBe(base)
  })

  it('only depends on its own family', () => {
    const other: FamilyDef = { ...clone(FIXTURE_FAMILY), id: 'komoku34', patterns: clone(FIXTURE_FAMILY.patterns).slice(0, 1) }
    other.patterns[0].id = 'other-one'
    const book = buildBook([FIXTURE_FAMILY, other])
    expect(familyHash(book, 'star44')).toBe(base)
    expect(familyHash(book, 'komoku34')).not.toBe(base)
  })

  it('throws for a family that is not in the book', () => {
    const book = buildBook([FIXTURE_FAMILY])
    expect(() => familyHash(book, 'sansan33')).toThrow(/sansan33/)
  })
})

describe('nodeSetups', () => {
  it('lists each setup a node is played under once, with the first pattern that uses it', () => {
    const def = clone(FIXTURE_FAMILY)
    pattern(def, 'fixture-crawl').setup = 'even'
    const book: Book = buildBook([def])
    const shared = book.families.star44.root.children[0] // W:R14, shared by all three patterns
    expect(nodeSetups(book, 'star44', shared)).toEqual([
      { setup: 'handicap4', patternId: 'fixture-hane' },
      { setup: 'even', patternId: 'fixture-crawl' },
    ])
    const hane = book.patterns['fixture-hane'].path[2]
    expect(nodeSetups(book, 'star44', hane)).toEqual([{ setup: 'handicap4', patternId: 'fixture-hane' }])
  })
})
