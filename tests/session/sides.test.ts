import { describe, expect, it } from 'vitest'
import { buildBook } from '../../src/book/build'
import type { FamilyDef } from '../../src/book/types'
import { drillableSides, ownerColor } from '../../src/session/sides'
import { FIXTURE_FAMILY } from '../book/fixture'

/** Corner stone Black. 'white-trick' has White's trick on its main line, 'black-trick' Black's. */
const TRICK_FAMILY: FamilyDef = {
  id: 'star44',
  name: 'trick sides',
  setup: 'handicap4',
  start: [{ c: 'B', at: 'Q16', note: 'corner' }],
  patterns: [
    {
      id: 'plain',
      name: 'plain',
      difficulty: 1,
      order: 1,
      line: [
        { c: 'W', at: 'R14', note: 'Approach.' },
        { c: 'B', at: 'Q14', note: 'Attach.' },
      ],
    },
    {
      id: 'white-trick',
      name: 'white trick',
      difficulty: 2,
      order: 2,
      line: [
        { c: 'W', at: 'R14', note: '' },
        { c: 'B', at: 'Q14', note: '' },
        { c: 'W', at: 'R13', kind: 'trick', note: 'White tries a trick.' },
        { c: 'B', at: 'Q13', note: 'Black stays calm.' },
      ],
    },
    {
      id: 'black-trick',
      name: 'black trick',
      difficulty: 2,
      order: 3,
      line: [
        { c: 'W', at: 'R17', note: 'Approach from above.' },
        { c: 'B', at: 'R16', kind: 'trick', note: 'Black tries a trick.' },
        { c: 'W', at: 'S16', note: 'White stays calm.' },
      ],
    },
  ],
}

describe('ownerColor', () => {
  it('defend plays the corner stone’s colour, attack the other', () => {
    expect(ownerColor(FIXTURE_FAMILY, 'defend')).toBe('black')
    expect(ownerColor(FIXTURE_FAMILY, 'attack')).toBe('white')
    const whiteCorner: FamilyDef = { ...FIXTURE_FAMILY, start: [{ c: 'W', at: 'Q16', note: 'corner' }] }
    expect(ownerColor(whiteCorner, 'defend')).toBe('white')
    expect(ownerColor(whiteCorner, 'attack')).toBe('black')
  })
})

describe('drillableSides', () => {
  it('gives both sides for a pattern without a trick on its main line', () => {
    const book = buildBook([FIXTURE_FAMILY])
    for (const id of ['fixture-hane', 'fixture-crawl', 'fixture-tenuki']) {
      expect([...drillableSides(book, id)].sort()).toEqual(['attack', 'defend'])
    }
  })

  it('leaves out the side that plays the trick', () => {
    const book = buildBook([TRICK_FAMILY])
    expect([...drillableSides(book, 'plain')].sort()).toEqual(['attack', 'defend'])
    // White (the attacker here) plays the trick: only Black's side is drilled.
    expect(drillableSides(book, 'white-trick')).toEqual(['defend'])
    expect(drillableSides(book, 'black-trick')).toEqual(['attack'])
  })

  it('throws on an unknown pattern', () => {
    expect(() => drillableSides(buildBook([FIXTURE_FAMILY]), 'nope')).toThrow(/nope/)
  })
})
