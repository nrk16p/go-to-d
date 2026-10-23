// Checks on the Thai book text (src/book/th). The English book stays the source of truth: every Thai
// name and note must belong to a real pattern or node, name the same board points as the English note
// (so orientNote turns them with the board), keep coordinates out of names (R36), and a family marked
// complete must have Thai for everything.

import { describe, expect, it } from 'vitest'
import { BOOK } from '../../src/book/data'
import { TH } from '../../src/book/th'
import { TH_FAMILIES } from '../../src/book/th/families'
import type { BookNode, FamilyId } from '../../src/book/types'
import { GTP_TOKEN } from '../../src/session/orient'

/** The board points a text names, as a sorted list without repeats. */
function points(text: string): string[] {
  return [...new Set(text.match(GTP_TOKEN) ?? [])].sort()
}

function treeNodes(root: BookNode): BookNode[] {
  const out: BookNode[] = []
  const walk = (n: BookNode) => {
    if (n.move) out.push(n)
    n.children.forEach(walk)
  }
  walk(root)
  return out
}

const blank = (s: unknown) => typeof s !== 'string' || s.trim() === ''

describe('the Thai maps', () => {
  it('cover exactly the families of the book', () => {
    expect(Object.keys(TH).sort()).toEqual(Object.keys(BOOK.families).sort())
    expect(Object.keys(TH_FAMILIES).sort()).toEqual(Object.keys(BOOK.families).sort())
  })
})

describe('Thai family names and corner notes', () => {
  for (const family of Object.keys(BOOK.families) as FamilyId[]) {
    it(`${family}: a name, one note per corner stone, the same board points`, () => {
      const def = BOOK.families[family].def
      const th = TH_FAMILIES[family]
      expect(blank(th.name)).toBe(false)
      expect(points(th.name)).toEqual([])
      expect(th.start).toHaveLength(def.start.length)
      th.start.forEach((note, i) => {
        expect(blank(note)).toBe(false)
        expect(points(note)).toEqual(points(def.start[i].note))
      })
    })
  }
})

for (const family of Object.keys(TH) as FamilyId[]) {
  describe(`Thai book text for ${family}`, () => {
    const th = TH[family]
    const fam = BOOK.families[family]
    const patternIds = Object.keys(BOOK.patterns).filter((id) => BOOK.patterns[id].family === family)
    const byKey = new Map(treeNodes(fam.root).map((n) => [n.key, n]))

    it('names only patterns of this family', () => {
      const stray = Object.keys(th.names).filter((id) => !patternIds.includes(id))
      expect(stray, 'Thai names for patterns this family does not have').toEqual([])
    })

    it('notes only nodes of this family', () => {
      const stray = Object.keys(th.notes).filter((key) => !byKey.has(key))
      expect(stray, 'Thai notes for node keys this family does not have').toEqual([])
    })

    it('has no blank names or notes', () => {
      const blanks = [
        ...Object.entries(th.names).filter(([, v]) => blank(v)).map(([k]) => `name ${k}`),
        ...Object.entries(th.notes).filter(([, v]) => blank(v)).map(([k]) => `note ${k}`),
      ]
      expect(blanks).toEqual([])
    })

    it('keeps exactly the board points of each English note', () => {
      const wrong: string[] = []
      for (const [key, note] of Object.entries(th.notes)) {
        const node = byKey.get(key)
        if (!node) continue
        const want = points(node.note)
        const got = points(note)
        if (want.join(' ') !== got.join(' ')) wrong.push(`${key}: English names [${want.join(' ')}], Thai names [${got.join(' ')}]`)
      }
      expect(wrong).toEqual([])
    })

    it('has no board points in pattern names (R36)', () => {
      const withPoints = Object.entries(th.names)
        .filter(([, name]) => points(name).length > 0)
        .map(([id, name]) => `${id}: ${name}`)
      expect(withPoints).toEqual([])
    })

    it.skipIf(!th.complete)('has Thai for every name and note, as it says it is complete', () => {
      const missing = [
        ...patternIds.filter((id) => blank(th.names[id])).map((id) => `name ${id}`),
        ...[...byKey.values()]
          .filter((n) => n.note.trim() !== '' && blank(th.notes[n.key]))
          .map((n) => `note ${n.key}`),
      ]
      expect(missing).toEqual([])
    })
  })
}
