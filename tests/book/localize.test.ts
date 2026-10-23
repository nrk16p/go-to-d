// localizeBook swaps the words and nothing else: names and notes come from the Thai maps, anything
// missing stays English, and every move, key, kind, weight and pattern list is the same as before.

import { describe, expect, it } from 'vitest'
import { buildBook, familyHash } from '../../src/book/build'
import { BOOK } from '../../src/book/data'
import { localizeBook, localizeBookWith, type BookTexts } from '../../src/book/localize'
import type { Book, BookNode, FamilyId } from '../../src/book/types'
import { validateBook } from '../../src/book/validate'
import { FIXTURE_FAMILY } from './fixture'

function nodes(root: BookNode): BookNode[] {
  const out: BookNode[] = []
  const walk = (n: BookNode) => {
    out.push(n)
    n.children.forEach(walk)
  }
  walk(root)
  return out
}

/** Everything but the words, for comparing two books. */
function skeleton(book: Book) {
  return {
    families: Object.fromEntries(
      Object.entries(book.families).map(([id, fam]) => [
        id,
        {
          setup: fam.def.setup,
          start: fam.def.start.map((s) => `${s.c}${s.at}`),
          patterns: fam.def.patterns.map((p) => p.id),
          nodes: nodes(fam.root).map((n) => ({
            key: n.key,
            move: n.move,
            kind: n.kind,
            weight: n.weight,
            confidence: n.confidence,
            patternIds: n.patternIds,
            children: n.children.map((c) => c.key),
            parent: n.parent?.key ?? null,
          })),
        },
      ]),
    ),
    patterns: Object.fromEntries(
      Object.entries(book.patterns).map(([id, p]) => [
        id,
        { family: p.family, order: p.def.order, difficulty: p.def.difficulty, setup: p.def.setup, path: p.path.map((n) => n.key) },
      ]),
    ),
    issues: book.issues,
  }
}

/** Every word in a book, to show the original is never changed. */
function words(book: Book) {
  return JSON.stringify({
    families: Object.values(book.families).map((f) => [f.def.name, f.def.start.map((s) => s.note), nodes(f.root).map((n) => n.note)]),
    patterns: Object.values(book.patterns).map((p) => p.def.name),
  })
}

const FIXTURE = () => buildBook([FIXTURE_FAMILY])

const TEXTS: BookTexts = {
  text: {
    star44: {
      complete: false,
      names: { 'fixture-hane': 'ฮาเนะ แล้วกัน', 'fixture-crawl': '   ' },
      notes: {
        'W:R14': 'ประชิดต่ำ ห่างจาก Q16 แบบม้าเล็ก',
        'W:R14/B:Q14/W:Q13/B:P13': 'ดำกัน R13 เลยกลายเป็นจุดตัด',
        'W:R14/B:Q14/W:R13': '',
      },
    },
  },
  family: { star44: { name: 'จุดดาว 4-4', start: ['หมากมุมอยู่ที่จุดดาว'] } },
}

describe('localizeBookWith', () => {
  it('takes names and notes from the maps and keeps English for anything missing or blank', () => {
    const book = FIXTURE()
    const th = localizeBookWith(book, TEXTS)
    expect(th.patterns['fixture-hane'].def.name).toBe('ฮาเนะ แล้วกัน')
    expect(th.patterns['fixture-crawl'].def.name).toBe('Crawl down the side')
    expect(th.patterns['fixture-tenuki'].def.name).toBe('Leave it alone')

    const root = th.families.star44.root
    const at = (key: string) => nodes(root).find((n) => n.key === key)!
    expect(at('W:R14').note).toBe('ประชิดต่ำ ห่างจาก Q16 แบบม้าเล็ก')
    expect(at('W:R14/B:Q14/W:Q13/B:P13').note).toBe('ดำกัน R13 เลยกลายเป็นจุดตัด')
    expect(at('W:R14/B:Q14').note).toBe('Attach on the inside so White cannot settle for free.')
    // A blank Thai note is no note: English stays.
    expect(at('W:R14/B:Q14/W:R13').note).toBe('Extend down the side and keep the stones together.')

    expect(th.families.star44.def.name).toBe('จุดดาว 4-4')
    expect(th.families.star44.def.start[0].note).toBe('หมากมุมอยู่ที่จุดดาว')
  })

  it('names a pattern the same way in the pattern list and in its family', () => {
    const th = localizeBookWith(FIXTURE(), TEXTS)
    for (const p of th.families.star44.def.patterns) {
      expect(p).toBe(th.patterns[p.id].def)
    }
  })

  it('keeps moves, keys, kinds, weights, pattern lists and paths exactly as they were', () => {
    const book = FIXTURE()
    const th = localizeBookWith(book, TEXTS)
    expect(skeleton(th)).toEqual(skeleton(book))
    // The paths are made of the new tree's own nodes, with parents that point back into it.
    for (const entry of Object.values(th.patterns)) {
      const tree = new Set(nodes(th.families[entry.family].root))
      for (const n of entry.path) {
        expect(tree.has(n)).toBe(true)
        expect(n.parent === null || tree.has(n.parent)).toBe(true)
      }
    }
  })

  it('never changes the book it was given', () => {
    const book = FIXTURE()
    const before = words(book)
    const th = localizeBookWith(book, TEXTS)
    expect(words(book)).toBe(before)
    expect(words(th)).not.toBe(before)
    const original = new Set(nodes(book.families.star44.root))
    expect(nodes(th.families.star44.root).some((n) => original.has(n))).toBe(false)
  })

  it('ignores names and notes for patterns and nodes the book does not have', () => {
    const book = FIXTURE()
    const th = localizeBookWith(book, {
      text: { star44: { complete: false, names: { nope: 'ไม่มี' }, notes: { 'W:A1': 'ไม่มี' } } },
      family: {},
    })
    expect(skeleton(th)).toEqual(skeleton(book))
    expect(words(th)).toBe(words(book))
  })
})

describe('localizeBook', () => {
  it('gives the English book back as it is', () => {
    expect(localizeBook(BOOK, 'en')).toBe(BOOK)
  })

  it('makes the Thai book once', () => {
    expect(localizeBook(BOOK, 'th')).toBe(localizeBook(BOOK, 'th'))
  })

  it('leaves the real book valid and the book check unchanged', () => {
    const th = localizeBook(BOOK, 'th')
    expect(skeleton(th)).toEqual(skeleton(BOOK))
    expect(validateBook(th)).toEqual(validateBook(BOOK))
    for (const id of Object.keys(BOOK.families) as FamilyId[]) {
      expect(familyHash(th, id)).toBe(familyHash(BOOK, id))
    }
  })
})
