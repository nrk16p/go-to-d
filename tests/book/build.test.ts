import { describe, expect, it } from 'vitest'
import { CORNER_REGION, parseGtp, transform, transformRegion, type Pt, type Sym } from '../../src/go/coords'
import { buildBook, nodeKey } from '../../src/book/build'
import { SETUPS, startPosition } from '../../src/book/setups'
import type { BookNode, FamilyDef, MoveSpec, PatternDef } from '../../src/book/types'
import { FIXTURE_FAMILY } from './fixture'

const SYMS: Sym[] = [0, 1, 2, 3, 4, 5, 6, 7]

function mv(c: 'B' | 'W', at: string, note = 'a note', extra: Partial<MoveSpec> = {}): MoveSpec {
  return { c, at, note, ...extra }
}

function pattern(id: string, line: MoveSpec[], extra: Partial<PatternDef> = {}): PatternDef {
  return { id, name: id, difficulty: 1, order: 1, line, ...extra }
}

function family(patterns: PatternDef[], extra: Partial<FamilyDef> = {}): FamilyDef {
  return {
    id: 'star44',
    name: 'test family',
    setup: 'handicap4',
    start: [mv('B', 'Q16', 'corner')],
    patterns,
    ...extra,
  }
}

function find(root: BookNode, key: string): BookNode {
  let node = root
  const parts = key === '' ? [] : key.split('/')
  let prefix = ''
  for (const part of parts) {
    prefix = prefix === '' ? part : `${prefix}/${part}`
    const next = node.children.find((c) => c.key === prefix)
    if (!next) throw new Error(`no node ${prefix}`)
    node = next
  }
  return node
}

describe('nodeKey', () => {
  it('joins colour letter and GTP point with slashes', () => {
    expect(
      nodeKey([
        { color: 'white', at: parseGtp('R14') },
        { color: 'black', at: parseGtp('O17') },
      ]),
    ).toBe('W:R14/B:O17')
  })

  it('writes tenuki by name and the root as an empty string', () => {
    expect(nodeKey([{ color: 'black', at: 'tenuki' }])).toBe('B:tenuki')
    expect(nodeKey([])).toBe('')
  })
})

describe('buildBook: tree', () => {
  const book = buildBook([FIXTURE_FAMILY])
  const root = book.families.star44.root

  it('starts from a root with no move', () => {
    expect(root.move).toBeNull()
    expect(root.key).toBe('')
    expect(root.parent).toBeNull()
    expect(root.children).toHaveLength(1)
  })

  it('merges the shared two-move prefix into single nodes carrying all three pattern ids', () => {
    const ids = ['fixture-hane', 'fixture-crawl', 'fixture-tenuki']
    const first = find(root, 'W:R14')
    const second = find(root, 'W:R14/B:Q14')
    expect([...first.patternIds].sort()).toEqual([...ids].sort())
    expect([...second.patternIds].sort()).toEqual([...ids].sort())
    expect(first.children).toHaveLength(1)
    // hane, crawl, the poke branch and tenuki all fork from the second node
    expect(second.children.map((c) => c.key)).toEqual([
      'W:R14/B:Q14/W:Q13',
      'W:R14/B:Q14/W:R13',
      'W:R14/B:Q14/W:T19',
      'W:R14/B:Q14/W:tenuki',
    ])
  })

  it('gives each pattern a path without the root, ending on its last line move', () => {
    for (const pat of FIXTURE_FAMILY.patterns) {
      const entry = book.patterns[pat.id]
      expect(entry.family).toBe('star44')
      expect(entry.def).toBe(pat)
      expect(entry.path).toHaveLength(pat.line.length)
      expect(entry.path[0].parent).toBe(root)
      const last = entry.path[entry.path.length - 1]
      expect(last.move).toEqual({
        color: pat.line[pat.line.length - 1].c === 'B' ? 'black' : 'white',
        at: parseGtp(pat.line[pat.line.length - 1].at),
      })
      expect(last.patternIds).toContain(pat.id)
    }
    expect(book.patterns['fixture-hane'].path[4].key).toBe('W:R14/B:Q14/W:Q13/B:P13/W:R13')
  })

  it('links parents and gives every node the key of its path', () => {
    const check = (node: BookNode, trail: Array<{ color: 'black' | 'white'; at: Pt | 'tenuki' }>) => {
      expect(node.key).toBe(nodeKey(trail))
      for (const child of node.children) {
        expect(child.parent).toBe(node)
        check(child, [...trail, child.move!])
      }
    }
    check(root, [])
  })

  it('turns a tenuki into a node with at === "tenuki"', () => {
    const node = find(root, 'W:R14/B:Q14/W:tenuki')
    expect(node.move).toEqual({ color: 'white', at: 'tenuki' })
  })

  it('hangs branches off the node they follow, with their own kind', () => {
    const cut = find(root, 'W:R14/B:Q14/W:Q13/B:R13')
    expect(cut.kind).toBe('mistake')
    expect(cut.parent).toBe(book.patterns['fixture-hane'].path[2])
    expect(cut.patternIds).toEqual(['fixture-hane'])
    // the punishment line is part of the tree but not of the pattern's path
    expect(cut.children.map((c) => c.key)).toEqual(['W:R14/B:Q14/W:Q13/B:R13/W:R12'])
    expect(book.patterns['fixture-hane'].path).not.toContain(cut)
    expect(find(root, 'W:R14/B:Q14/W:Q13/B:R13/W:R12/B:S13').kind).toBe('joseki')
  })

  it('defaults kind to joseki and weight to 1, and leaves confidence unset', () => {
    const node = find(root, 'W:R14')
    expect(node.kind).toBe('joseki')
    expect(node.weight).toBe(1)
    expect(node.confidence).toBeUndefined()
  })

  it('reports a clean merge for the fixture', () => {
    expect(book.issues).toEqual([])
  })
})

describe('buildBook: merging notes, kinds and weights', () => {
  const first = pattern('a', [mv('W', 'R14', 'first note'), mv('B', 'Q14', 'second note'), mv('W', 'Q13')])

  it('lets a later pattern with an empty note inherit the first note', () => {
    const later = pattern('b', [mv('W', 'R14', ''), mv('B', 'Q14', ''), mv('W', 'R13')])
    const book = buildBook([family([first, later])])
    const root = book.families.star44.root
    expect(find(root, 'W:R14').note).toBe('first note')
    expect(find(root, 'W:R14/B:Q14').note).toBe('second note')
    expect(book.issues).toEqual([])
  })

  it('takes the first non-empty note when the first pattern left it empty', () => {
    const empty = pattern('a', [mv('W', 'R14', '  '), mv('B', 'Q14')])
    const noted = pattern('b', [mv('W', 'R14', 'finally a note'), mv('B', 'Q14')])
    const book = buildBook([family([empty, noted])])
    expect(find(book.families.star44.root, 'W:R14').note).toBe('finally a note')
    expect(book.issues).toEqual([])
  })

  it('records two different non-empty notes on one node, naming the node key and both patterns', () => {
    const other = pattern('b', [mv('W', 'R14', 'a different note'), mv('B', 'Q14', ''), mv('W', 'R13')])
    const book = buildBook([family([first, other])])
    expect(book.issues).toHaveLength(1)
    expect(book.issues[0]).toContain('"W:R14"')
    expect(book.issues[0]).toContain('"a"')
    expect(book.issues[0]).toContain('"b"')
    expect(book.issues[0]).toContain('line[0]')
    // the first note stays
    expect(find(book.families.star44.root, 'W:R14').note).toBe('first note')
  })

  it('does not report the same prefix twice when a pattern has several branches', () => {
    const clash = pattern(
      'b',
      [mv('W', 'R14', 'a different note'), mv('B', 'Q14', ''), mv('W', 'R13')],
      {
        branches: [
          { after: 2, move: mv('W', 'S13', 'x', { kind: 'alternative' }) },
          { after: 2, move: mv('W', 'S14', 'y', { kind: 'alternative' }) },
        ],
      },
    )
    const book = buildBook([family([first, clash])])
    expect(book.issues).toHaveLength(1)
  })

  it('records two different explicit kinds on one node', () => {
    const a = pattern('a', [mv('W', 'R14', 'n', { kind: 'joseki' }), mv('B', 'Q14')])
    const b = pattern('b', [mv('W', 'R14', 'n', { kind: 'trick' }), mv('B', 'Q14')])
    const book = buildBook([family([a, b])])
    expect(book.issues).toHaveLength(1)
    expect(book.issues[0]).toContain('"W:R14"')
    expect(book.issues[0]).toContain('kind')
  })

  it('lets an explicit kind win over an unspecified one, in either order', () => {
    const plain = pattern('a', [mv('W', 'R14'), mv('B', 'Q14', 'n')])
    const marked = pattern('b', [mv('W', 'R14'), mv('B', 'Q14', 'n', { kind: 'alternative' })])
    for (const order of [[plain, marked], [marked, plain]]) {
      const book = buildBook([family(order)])
      expect(find(book.families.star44.root, 'W:R14/B:Q14').kind).toBe('alternative')
      expect(book.issues).toEqual([])
    }
  })

  it('records two different explicit weights, and keeps the first', () => {
    const a = pattern('a', [mv('W', 'R14', 'n', { weight: 3 })])
    const b = pattern('b', [mv('W', 'R14', 'n', { weight: 5 })])
    const book = buildBook([family([a, b])])
    expect(find(book.families.star44.root, 'W:R14').weight).toBe(3)
    expect(book.issues).toHaveLength(1)
    expect(book.issues[0]).toContain('weight')
  })

  it('marks a node low-confidence when any pattern says so', () => {
    const a = pattern('a', [mv('W', 'R14')])
    const b = pattern('b', [mv('W', 'R14', 'n', { confidence: 'low' })])
    const book = buildBook([family([a, b])])
    expect(find(book.families.star44.root, 'W:R14').confidence).toBe('low')
  })

  it('keeps one pattern id per node even if a branch lands on a line node again', () => {
    const p = pattern('a', [mv('W', 'R14'), mv('B', 'Q14')], {
      branches: [{ after: 1, move: mv('B', 'Q14') }],
    })
    const book = buildBook([family([p])])
    const node = find(book.families.star44.root, 'W:R14/B:Q14')
    expect(node.patternIds).toEqual(['a'])
    expect(node.parent!.children).toHaveLength(1)
  })
})

describe('buildBook: bad input', () => {
  it('throws for a point that is not on the board, naming the pattern and the move', () => {
    const p = pattern('bad', [mv('W', 'R14'), mv('B', 'Z99')])
    expect(() => buildBook([family([p])])).toThrow(/bad.*line\[1\].*Z99/)
  })

  it('throws for a tenuki that is not written in lower case', () => {
    expect(() => buildBook([family([pattern('bad', [mv('W', 'Tenuki')])])])).toThrow(/bad.*line\[0\]/)
  })

  it('throws for a branch that follows more line moves than exist', () => {
    const p = pattern('bad', [mv('W', 'R14')], { branches: [{ after: 2, move: mv('B', 'Q14') }] })
    expect(() => buildBook([family([p])])).toThrow(/bad.*branches\[0\].*after/)
  })

  it('throws for two families with the same id', () => {
    expect(() => buildBook([family([]), family([])])).toThrow(/star44/)
  })

  it('keeps the first pattern for a duplicate id and records the clash', () => {
    const a = pattern('same', [mv('W', 'R14')])
    const b = pattern('same', [mv('W', 'S14')])
    const book = buildBook([family([a, b])])
    expect(book.patterns.same.def).toBe(a)
    expect(book.issues).toHaveLength(1)
    expect(book.issues[0]).toContain('"same"')
  })

  it('builds only the families it is given', () => {
    const book = buildBook([family([])])
    expect(Object.keys(book.families)).toEqual(['star44'])
    expect(book.patterns).toEqual({})
  })
})

describe('SETUPS', () => {
  const corner = [{ ...parseGtp('Q16'), player: 'black' as const }]
  const names = (stones: Array<{ x: number; y: number; player: string }>) =>
    stones.map((s) => `${s.player[0]}${s.x},${s.y}`).sort()

  it('handicap4: corner stones plus Black D4, D16, Q4; White to move; komi 0.5', () => {
    const r = SETUPS.handicap4(corner)
    expect(r.toMove).toBe('white')
    expect(r.komi).toBe(0.5)
    expect(names(r.stones)).toEqual(
      names([
        ...corner,
        { ...parseGtp('D4'), player: 'black' },
        { ...parseGtp('D16'), player: 'black' },
        { ...parseGtp('Q4'), player: 'black' },
      ]),
    )
  })

  it('even: corner stones plus Black D4, White D16, White Q4; White to move; komi 7.5', () => {
    const r = SETUPS.even(corner)
    expect(r.toMove).toBe('white')
    expect(r.komi).toBe(7.5)
    expect(names(r.stones)).toEqual(
      names([
        ...corner,
        { ...parseGtp('D4'), player: 'black' },
        { ...parseGtp('D16'), player: 'white' },
        { ...parseGtp('Q4'), player: 'white' },
      ]),
    )
  })

  it('does not change the corner stones it is given', () => {
    const before = JSON.stringify(corner)
    SETUPS.handicap4(corner)
    expect(JSON.stringify(corner)).toBe(before)
  })
})

describe('startPosition', () => {
  const book = buildBook([
    family([
      pattern('plain', [mv('W', 'R14')]),
      pattern('even-one', [mv('W', 'R14')], { setup: 'even' }),
    ]),
  ])

  it('places the corner stone and the handicap stones, White to move, komi 0.5', () => {
    const { pos, komi, region } = startPosition(book, 'star44', null, 0)
    expect(komi).toBe(0.5)
    expect(pos.toMove).toBe('white')
    expect(pos.history).toEqual([])
    const stones: string[] = []
    pos.board.forEach((row, y) => row.forEach((c, x) => c && stones.push(`${c}:${x},${y}`)))
    expect(stones.sort()).toEqual(
      ['black:15,3', 'black:3,15', 'black:3,3', 'black:15,15'].sort(),
    )
    expect(region).toEqual(CORNER_REGION)
  })

  it('uses the family setup for a pattern without its own', () => {
    expect(startPosition(book, 'star44', 'plain', 0).komi).toBe(0.5)
  })

  it('uses a pattern’s own setup when it has one, and the family setup in free sparring', () => {
    const own = startPosition(book, 'star44', 'even-one', 0)
    expect(own.komi).toBe(7.5)
    expect(own.pos.board[3][3]).toBe('white') // D16
    expect(own.pos.board[15][15]).toBe('white') // Q4
    expect(own.pos.board[15][3]).toBe('black') // D4
    expect(startPosition(book, 'star44', null, 0).komi).toBe(0.5)
  })

  it('transforms corner and setup stones and the region together under every symmetry', () => {
    // The even setup and a lone White corner stone are not symmetric, so a stone that is
    // left untransformed (or transformed twice) shows up as a wrong colour on some point.
    const lopsided = buildBook([
      family([pattern('p', [mv('W', 'R14')])], {
        setup: 'even',
        start: [mv('B', 'Q16', 'corner'), mv('W', 'R13', 'corner')],
      }),
    ])
    const base = startPosition(lopsided, 'star44', null, 0).pos
    const baseStones: Array<{ x: number; y: number; color: string }> = []
    base.board.forEach((row, y) => row.forEach((color, x) => color && baseStones.push({ x, y, color })))
    expect(baseStones).toHaveLength(5)

    for (const sym of SYMS) {
      const { pos, region } = startPosition(lopsided, 'star44', null, sym)
      expect(region).toEqual(transformRegion(CORNER_REGION, sym))
      const expected = Array.from({ length: 19 }, () => Array<string | null>(19).fill(null))
      for (const s of baseStones) {
        const t = transform(s, sym)
        expected[t.y][t.x] = s.color
      }
      expect(pos.board).toEqual(expected)
      expect(pos.toMove).toBe('white')
      // the studied corner stone lands inside the transformed region
      const q16 = transform(parseGtp('Q16'), sym)
      expect(pos.board[q16.y][q16.x]).toBe('black')
      expect(q16.x >= region.xMin && q16.x <= region.xMax && q16.y >= region.yMin && q16.y <= region.yMax).toBe(true)
    }
  })

  it('throws for an unknown family, an unknown pattern, or a pattern from another family', () => {
    expect(() => startPosition(book, 'invade33', null, 0)).toThrow(/invade33/)
    expect(() => startPosition(book, 'star44', 'nope', 0)).toThrow(/nope/)
    const two = buildBook([
      family([pattern('p1', [mv('W', 'R14')])]),
      family([pattern('p2', [mv('W', 'R14')])], { id: 'invade33' }),
    ])
    expect(() => startPosition(two, 'star44', 'p2', 0)).toThrow(/p2/)
  })
})
