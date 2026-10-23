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
import { pass, play, type Position } from '../../src/go/rules'
import { buildBook } from '../../src/book/build'
import { startPosition } from '../../src/book/setups'
import { validateBook } from '../../src/book/validate'
import type { Book, BookNode, FamilyDef, MoveSpec, PatternDef } from '../../src/book/types'
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

function errorsFor(defs: FamilyDef[]): string[] {
  return validateBook(buildBook(defs))
}

describe('validateBook: the fixture', () => {
  it('is valid', () => {
    expect(validateBook(buildBook([FIXTURE_FAMILY]))).toEqual([])
  })

  it('is valid next to an empty second family', () => {
    const empty: FamilyDef = { id: 'invade33', name: 'empty', setup: 'handicap4', start: [mv('B', 'Q16')], patterns: [] }
    expect(validateBook(buildBook([FIXTURE_FAMILY, empty]))).toEqual([])
  })
})

describe('validateBook: notes', () => {
  it('reports a node that still has no note after merging, with pattern and node key', () => {
    const errors = errorsFor([family([pattern('p', [mv('W', 'R14', 'ok'), mv('B', 'Q14', '')])])])
    expect(errors).toHaveLength(1)
    expect(errors[0]).toContain('"W:R14/B:Q14"')
    expect(errors[0]).toContain('"p"')
    expect(errors[0]).toMatch(/no note/)
  })

  it('treats a note of only spaces as missing', () => {
    expect(errorsFor([family([pattern('p', [mv('W', 'R14', '   ')])])])).toHaveLength(1)
  })

  it('accepts an empty note that a shared node gets from an earlier pattern', () => {
    const a = pattern('a', [mv('W', 'R14', 'first'), mv('B', 'Q14', 'second'), mv('W', 'Q13')])
    const b = pattern('b', [mv('W', 'R14', ''), mv('B', 'Q14', ''), mv('W', 'R13')])
    expect(errorsFor([family([a, b])])).toEqual([])
  })

  it('reports two different non-empty notes on one node, mentioning the node key', () => {
    const a = pattern('a', [mv('W', 'R14', 'one'), mv('B', 'Q14')])
    const b = pattern('b', [mv('W', 'R14', 'two'), mv('B', 'Q15')])
    const errors = errorsFor([family([a, b])])
    expect(errors).toHaveLength(1)
    expect(errors[0]).toContain('"W:R14"')
  })

  it('reports a weight that is not a positive number', () => {
    const errors = errorsFor([family([pattern('p', [mv('W', 'R14', 'n', { weight: 0 })])])])
    expect(errors).toHaveLength(1)
    expect(errors[0]).toMatch(/weight/)
    expect(errors[0]).toContain('"W:R14"')
  })
})

describe('validateBook: move checks', () => {
  it('reports a move on an occupied point, with pattern, array position and node key', () => {
    const errors = errorsFor([
      family([pattern('p', [mv('W', 'R14'), mv('B', 'Q14'), mv('W', 'R14')])]),
    ])
    expect(errors).toHaveLength(1)
    expect(errors[0]).toContain('"p"')
    expect(errors[0]).toContain('line[2]')
    expect(errors[0]).toContain('"W:R14/B:Q14/W:R14"')
    expect(errors[0]).toMatch(/occupied/)
  })

  it('reports a move on a setup or corner stone as occupied', () => {
    const errors = errorsFor([family([pattern('p', [mv('W', 'Q16')])])])
    expect(errors).toHaveLength(1)
    expect(errors[0]).toMatch(/occupied/)
  })

  it('reports suicide', () => {
    // Black T19 with White on S19 and T18 has no liberty and takes nothing
    const line = [mv('W', 'S19'), mv('B', 'R17'), mv('W', 'T18'), mv('B', 'T19')]
    const errors = errorsFor([family([pattern('p', line)])])
    expect(errors).toHaveLength(1)
    expect(errors[0]).toMatch(/suicide/)
    expect(errors[0]).toContain('line[3]')
  })

  it('reports colours that do not alternate', () => {
    const errors = errorsFor([family([pattern('p', [mv('W', 'R14'), mv('W', 'R13')])])])
    expect(errors).toHaveLength(1)
    expect(errors[0]).toContain('line[1]')
    expect(errors[0]).toMatch(/alternat/)
  })

  it('reports a first move by the wrong colour, since White moves first from the setup', () => {
    const errors = errorsFor([family([pattern('p', [mv('B', 'R14')])])])
    expect(errors).toHaveLength(1)
    expect(errors[0]).toContain('line[0]')
  })

  it('accepts a tenuki as a move by the side to move; the other side answers next', () => {
    const ok = pattern('ok', [mv('W', 'R14'), mv('B', 'tenuki'), mv('W', 'R13')])
    expect(errorsFor([family([ok])])).toEqual([])
  })

  it('reports the same colour moving again after a tenuki', () => {
    const bad = pattern('p', [mv('W', 'R14'), mv('B', 'tenuki'), mv('B', 'R13')])
    const errors = errorsFor([family([bad])])
    expect(errors).toHaveLength(1)
    expect(errors[0]).toContain('line[2]')
    expect(errors[0]).toMatch(/alternat/)
  })

  it('accepts tenuki by both sides in a row', () => {
    const p = pattern('p', [mv('W', 'R14'), mv('B', 'tenuki'), mv('W', 'tenuki'), mv('B', 'Q14')])
    expect(errorsFor([family([p])])).toEqual([])
  })

  it('reports a move outside the corner region', () => {
    const errors = errorsFor([family([pattern('p', [mv('W', 'R14'), mv('B', 'Q14'), mv('W', 'F10')])])])
    expect(errors).toHaveLength(1)
    expect(errors[0]).toContain('line[2]')
    expect(errors[0]).toMatch(/region/)
  })

  it('accepts moves on the region edge', () => {
    // x 8 = J, y 10 = row 9
    const p = pattern('p', [mv('W', 'J9'), mv('B', 'T19')])
    expect(errorsFor([family([p])])).toEqual([])
  })

  it('reports a point that is not written canonically', () => {
    for (const [bad, canonical] of [['r14', 'R14'], ['S09', 'S9']]) {
      const errors = errorsFor([family([pattern('p', [mv('W', bad)])])])
      expect(errors).toHaveLength(1)
      expect(errors[0]).toContain('line[0]')
      expect(errors[0]).toContain(`"${canonical}"`)
    }
  })

  it('names the branch location for an error inside a branch, once, even if the line is shared', () => {
    const p = pattern('p', [mv('W', 'R14'), mv('B', 'Q14'), mv('W', 'R13')], {
      branches: [
        { after: 1, move: mv('B', 'R14', 'bad', { kind: 'mistake' }), then: [mv('W', 'Q13')] },
      ],
    })
    const errors = errorsFor([family([p])])
    expect(errors).toHaveLength(1)
    expect(errors[0]).toContain('branches[0].move')
    expect(errors[0]).toMatch(/occupied/)
  })

  it('names the then[] index for an error later in a branch', () => {
    const p = pattern('p', [mv('W', 'R14'), mv('B', 'Q14')], {
      branches: [
        {
          after: 1,
          move: mv('B', 'Q13', 'x', { kind: 'alternative' }),
          then: [mv('W', 'R13'), mv('B', 'R14')],
        },
      ],
    })
    const errors = errorsFor([family([p])])
    expect(errors).toHaveLength(1)
    expect(errors[0]).toContain('branches[0].then[1]')
  })

  it('checks a branch after a line that breaks later, but not past the break', () => {
    const p = pattern('p', [mv('W', 'R14'), mv('B', 'Q14'), mv('W', 'R14')], {
      branches: [
        { after: 1, move: mv('B', 'R13', 'x', { kind: 'alternative' }) },
        { after: 3, move: mv('B', 'Q13', 'x', { kind: 'alternative' }) },
      ],
    })
    const errors = errorsFor([family([p])])
    expect(errors).toHaveLength(1)
    expect(errors[0]).toContain('line[2]')
  })

  it('reports an empty line', () => {
    const errors = errorsFor([family([pattern('p', [])])])
    expect(errors).toHaveLength(1)
    expect(errors[0]).toMatch(/empty/)
  })
})

describe('validateBook: ids and setup', () => {
  it('reports a duplicate pattern id', () => {
    const a = pattern('same', [mv('W', 'R14')])
    const b = pattern('same', [mv('W', 'S14')])
    const errors = errorsFor([family([a, b])])
    expect(errors.some((e) => e.includes('"same"') && /duplicate/i.test(e))).toBe(true)
  })

  it('reports a duplicate id across two families', () => {
    const a = pattern('same', [mv('W', 'R14')])
    const b = pattern('same', [mv('W', 'S14')])
    const errors = errorsFor([family([a]), family([b], { id: 'invade33' })])
    expect(errors.some((e) => /duplicate/i.test(e))).toBe(true)
  })

  it('reports a corner stone outside the region', () => {
    const errors = errorsFor([family([], { start: [mv('B', 'D4')] })])
    expect(errors.some((e) => /start/.test(e) && /region/.test(e))).toBe(true)
  })

  it('reports a corner stone that is not a point', () => {
    const errors = errorsFor([family([], { start: [mv('B', 'tenuki')] })])
    expect(errors.some((e) => /start/.test(e))).toBe(true)
  })

  it('reports a corner stone that cannot be placed, naming the setup', () => {
    const errors = errorsFor([family([], { start: [mv('B', 'Q16'), mv('W', 'Q16')] })])
    expect(errors).toHaveLength(1)
    expect(errors[0]).toMatch(/setup/)
  })

  it('reports a bad setup once for the family, not once per pattern', () => {
    const bad = family(
      [pattern('a', [mv('W', 'R14')]), pattern('b', [mv('W', 'S14')])],
      { start: [mv('B', 'Q16'), mv('W', 'Q16')] },
    )
    expect(errorsFor([bad])).toHaveLength(1)
  })

  it('checks a pattern’s own setup too', () => {
    const p = pattern('p', [mv('W', 'R14')], { setup: 'even' })
    expect(errorsFor([family([p])])).toEqual([])
  })
})

describe('validateBook: whole-board families and the empty board (R46)', () => {
  const empty = (patterns: PatternDef[], extra: Partial<FamilyDef> = {}) =>
    family(patterns, { id: 'open-even', region: 'board', setup: 'empty', start: [], ...extra })

  it('accepts an empty-board opening: no start stones, Black first, moves anywhere', () => {
    const p = pattern('p', [mv('B', 'Q16'), mv('W', 'D4'), mv('B', 'K10'), mv('W', 'C3')])
    expect(errorsFor([empty([p])])).toEqual([])
  })

  it('accepts a 4-stone opening: the handicap setup, White first, moves far from Q16', () => {
    const p = pattern('p', [mv('W', 'C6'), mv('B', 'K4')])
    expect(errorsFor([family([p], { id: 'open-h4', region: 'board' })])).toEqual([])
  })

  it('allows start [] only with setup "empty"', () => {
    const errors = errorsFor([family([pattern('p', [mv('W', 'R14')])], { start: [] })])
    expect(errors).toHaveLength(1)
    expect(errors[0]).toMatch(/start is \[\]/)
    expect(errors[0]).toMatch(/"empty"/)

    const board = errorsFor([empty([pattern('p', [mv('B', 'Q16')])], { setup: 'even' })])
    expect(board).toHaveLength(1)
    expect(board[0]).toMatch(/start is \[\]/)
  })

  it('keeps start stones out of the empty board', () => {
    const errors = errorsFor([family([pattern('p', [mv('B', 'R14')])], { setup: 'empty' })])
    expect(errors).toHaveLength(1)
    expect(errors[0]).toMatch(/start must be \[\]/)
  })

  it('checks a pattern’s own setup against the start stones too', () => {
    const toEmpty = errorsFor([family([pattern('p', [mv('B', 'R14')], { setup: 'empty' })])])
    expect(toEmpty).toHaveLength(1)
    expect(toEmpty[0]).toContain('"p"')
    expect(toEmpty[0]).toMatch(/start must be \[\]/)
    const fromEmpty = errorsFor([empty([pattern('p', [mv('W', 'R14')], { setup: 'even' })])])
    expect(fromEmpty).toHaveLength(1)
    expect(fromEmpty[0]).toContain('"p"')
  })

  it('rejects a tenuki in a whole-board family, naming the pattern and node', () => {
    const p = pattern('p', [mv('B', 'Q16'), mv('W', 'tenuki'), mv('B', 'D4')])
    const errors = errorsFor([empty([p])])
    expect(errors).toHaveLength(1)
    expect(errors[0]).toContain('"p"')
    expect(errors[0]).toContain('line[1]')
    expect(errors[0]).toContain('"B:Q16/W:tenuki"')
    expect(errors[0]).toMatch(/tenuki/)
    // In a branch too.
    const branch = pattern('b', [mv('B', 'Q16'), mv('W', 'D4')], { branches: [{ after: 1, move: mv('W', 'tenuki', 'x') }] })
    expect(errorsFor([empty([branch])]).some((e) => e.includes('branches[0].move'))).toBe(true)
  })

  it('still allows a tenuki in a corner family, said or defaulted', () => {
    const p = pattern('p', [mv('W', 'R14'), mv('B', 'tenuki')])
    expect(errorsFor([family([p], { region: 'corner' })])).toEqual([])
    expect(errorsFor([family([p])])).toEqual([])
  })

  it('reports a region that is neither corner nor board', () => {
    const errors = errorsFor([family([], { region: 'side' as unknown as 'board' })])
    expect(errors).toHaveLength(1)
    expect(errors[0]).toMatch(/region/)
  })

  it('allows start stones away from the corner region in a whole-board family only', () => {
    const corner = errorsFor([family([], { setup: 'even', start: [mv('B', 'D10')] })])
    expect(corner.some((e) => /outside the corner region/.test(e))).toBe(true)
    expect(errorsFor([family([], { setup: 'even', region: 'board', start: [mv('B', 'D10')] })])).toEqual([])
  })
})

// ---------------------------------------------------------------------------------------
// Replay under symmetry: written independently of the validator.

type Replayed = { key: string; captured: Pt[]; point: Pt | 'tenuki' }

/** Replays every node of a family's tree under `sym`, calling `visit` for each. */
function replayTree(book: Book, familyId: 'star44', sym: Sym, visit: (node: BookNode, r: Replayed) => void) {
  const region = transformRegion(CORNER_REGION, sym)
  const start = startPosition(book, familyId, null, sym).pos
  const walk = (node: BookNode, pos: Position) => {
    for (const child of node.children) {
      const move = child.move!
      let next: Position
      let captured: Pt[] = []
      let point: Pt | 'tenuki'
      if (move.at === 'tenuki') {
        expect(pos.toMove).toBe(move.color)
        next = pass(pos)
        point = 'tenuki'
      } else {
        point = transform(move.at, sym)
        expect(inRegion(point, region), `${child.key} under sym ${sym} left the region`).toBe(true)
        expect(pos.toMove, `${child.key} under sym ${sym}: wrong colour to move`).toBe(move.color)
        const r = play(pos, point, move.color)
        if ('illegal' in r) throw new Error(`${child.key} under sym ${sym} is illegal: ${r.illegal}`)
        next = r.pos
        captured = r.captured
      }
      visit(child, { key: child.key, captured, point })
      walk(child, next)
    }
  }
  walk(book.families[familyId].root, start)
}

describe('replay under all 8 symmetries', () => {
  const book = buildBook([FIXTURE_FAMILY])

  it('replays every pattern path legally, inside the transformed region', () => {
    for (const sym of SYMS) {
      const region = transformRegion(CORNER_REGION, sym)
      for (const id of Object.keys(book.patterns)) {
        let pos = startPosition(book, 'star44', id, sym).pos
        for (const node of book.patterns[id].path) {
          const move = node.move!
          expect(pos.toMove).toBe(move.color)
          if (move.at === 'tenuki') {
            pos = pass(pos)
            continue
          }
          const p = transform(move.at, sym)
          expect(inRegion(p, region)).toBe(true)
          const r = play(pos, p, move.color)
          if ('illegal' in r) throw new Error(`${id} ${node.key} sym ${sym}: ${r.illegal}`)
          pos = r.pos
        }
      }
    }
  })

  it('replays every branch and punishment line too (the whole tree)', () => {
    for (const sym of SYMS) {
      let nodes = 0
      replayTree(book, 'star44', sym, () => nodes++)
      expect(nodes).toBe(countNodes(book.families.star44.root) - 1)
    }
  })

  it('gives the same captures under all 8 symmetries for the branch that takes a stone', () => {
    const KEY = 'W:R14/B:Q14/W:T19/B:S19/W:R13/B:T18'
    const canonical = new Map<string, string[]>()
    replayTree(book, 'star44', 0, (_n, r) => canonical.set(r.key, r.captured.map(toGtp).sort()))
    // the fixture really captures something, and exactly the poked stone
    expect(canonical.get(KEY)).toEqual(['T19'])
    const capturing = [...canonical.entries()].filter(([, c]) => c.length > 0)
    expect(capturing).toHaveLength(1)

    for (const sym of SYMS) {
      const seen = new Map<string, string[]>()
      replayTree(book, 'star44', sym, (_n, r) =>
        seen.set(r.key, r.captured.map((p) => toGtp(transform(p, inverse(sym)))).sort()),
      )
      expect(seen).toEqual(canonical)
    }
  })

  it('moves the captured stone into the transformed corner', () => {
    for (const sym of SYMS) {
      const region = transformRegion(CORNER_REGION, sym)
      replayTree(book, 'star44', sym, (_n, r) => {
        for (const p of r.captured) expect(inRegion(p, region)).toBe(true)
      })
      // the expected captured point is T19 transformed
      let got: Pt[] = []
      replayTree(book, 'star44', sym, (_n, r) => {
        if (r.captured.length) got = r.captured
      })
      expect(got).toEqual([transform(parseGtp('T19'), sym)])
    }
  })
})

function countNodes(node: BookNode): number {
  return 1 + node.children.reduce((n, c) => n + countNodes(c), 0)
}
