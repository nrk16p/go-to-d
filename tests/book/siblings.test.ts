// Families that start from the same position are siblings (R42): the same setup and the same corner
// stones, and the same region (R46: a whole-board opening is not a corner's sibling). Found from the
// definitions, not from a list of names.

import { describe, expect, it } from 'vitest'
import { buildBook } from '../../src/book/build'
import { BOOK } from '../../src/book/data'
import { familyRegion } from '../../src/book/setups'
import { bookIndex } from '../../src/book/siblings'
import type { FamilyDef, FamilyId } from '../../src/book/types'
import { FIXTURE_FAMILY } from './fixture'

const ids = Object.keys(BOOK.families) as FamilyId[]
const sameStart = (a: FamilyId, b: FamilyId) => {
  const da = BOOK.families[a].def
  const db = BOOK.families[b].def
  const stones = (d: FamilyDef) => d.start.map((s) => `${s.c}${s.at}`).sort().join(' ')
  return familyRegion(da) === familyRegion(db) && da.setup === db.setup && stones(da) === stones(db)
}

describe('bookIndex', () => {
  it('groups every family with the families that share its region, setup and corner stones, itself first', () => {
    const index = bookIndex(BOOK)
    for (const f of ids) {
      const group = index.group(f)
      expect(group[0]).toBe(f)
      expect(group.slice().sort()).toEqual(ids.filter((g) => sameStart(f, g)).sort())
    }
    // Today that makes the 4-4 point and the 3-3 invasion under it one pair.
    expect(index.group('star44')).toEqual(['star44', 'invade33'])
    expect(index.group('invade33')).toEqual(['invade33', 'star44'])
    // The 4-stone opening starts from the same stones, but over the whole board: no sibling of theirs.
    expect(index.group('open-h4')).toEqual(['open-h4'])
  })

  it('keeps a whole-board family apart from a corner family with the same start (R46)', () => {
    const board: FamilyDef = { ...FIXTURE_FAMILY, id: 'open-h4', region: 'board', patterns: [] }
    const corner: FamilyDef = { ...FIXTURE_FAMILY, id: 'invade33', region: 'corner', patterns: [] }
    const index = bookIndex(buildBook([FIXTURE_FAMILY, board, corner]))
    expect(index.group('star44')).toEqual(['star44', 'invade33'])
    expect(index.group('open-h4')).toEqual(['open-h4'])
  })

  it('a family with other corner stones or another setup is on its own', () => {
    const moved: FamilyDef = { ...FIXTURE_FAMILY, id: 'invade33', start: [{ c: 'B', at: 'R16', note: '' }], patterns: [] }
    const even: FamilyDef = { ...FIXTURE_FAMILY, id: 'komoku34', setup: 'even', patterns: [] }
    const index = bookIndex(buildBook([FIXTURE_FAMILY, moved, even]))
    expect(index.group('star44')).toEqual(['star44'])
    expect(index.group('invade33')).toEqual(['invade33'])
  })

  it('finds a node by family and key, and the family a node belongs to', () => {
    const index = bookIndex(BOOK)
    for (const f of ids) {
      const root = BOOK.families[f].root
      expect(index.node(f, '')).toBe(root)
      for (const child of root.children) {
        expect(index.node(f, child.key)).toBe(child)
        expect(index.familyOf(child)).toBe(f)
      }
    }
    expect(index.node('star44', 'W:A1')).toBeUndefined()
    // Built once per book.
    expect(bookIndex(BOOK)).toBe(index)
  })
})
