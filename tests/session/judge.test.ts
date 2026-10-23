import { describe, expect, it } from 'vitest'
import { buildBook } from '../../src/book/build'
import type { BookNode, FamilyDef } from '../../src/book/types'
import type { CornerAnalysis } from '../../src/engine/teacher'
import { parseGtp } from '../../src/go/coords'
import { DEFAULT_THRESHOLDS, judgeMove } from '../../src/session/judge'
import { FIXTURE_FAMILY } from '../book/fixture'
import { analysisOf } from './fakeEngine'

// judgeMove works in the canonical frame (studied corner upper right), so plain GTP points are fine here.

const book = buildBook([FIXTURE_FAMILY])
const T = DEFAULT_THRESHOLDS
const P = parseGtp

function find(root: BookNode, key: string): BookNode {
  const hit = (function walk(n: BookNode): BookNode | null {
    if (n.key === key) return n
    for (const c of n.children) {
      const f = walk(c)
      if (f) return f
    }
    return null
  })(root)
  if (!hit) throw new Error(`no node ${key}`)
  return hit
}

const root = book.families.star44.root
/** White to play: Q13 (hane), R13 (crawl), T19 (crawl's mistake branch), tenuki (tenuki pattern). */
const afterAttach = find(root, 'W:R14/B:Q14')
/** Black to play: P13 (hane line) or R13 (hane's mistake branch). */
const afterHane = find(root, 'W:R14/B:Q14/W:Q13')

const drill = (id: string) => ({ mode: 'drill' as const, drillPatternId: id, drillPath: book.patterns[id].path })
const free = { mode: 'free' as const }
const noEngine = { before: null, scoreAfter: null, thresholds: T }

function engine(cornerAt: string, corner: number, tenuki: [string, number] | null = ['D10', -20]): CornerAnalysis {
  return analysisOf('black', [[cornerAt, corner]], tenuki)
}

describe('DEFAULT_THRESHOLDS', () => {
  it('is fine ≤ 1.5, big > 4.0', () => {
    expect(DEFAULT_THRESHOLDS).toEqual({ fine: 1.5, big: 4.0 })
  })
})

describe('judgeMove: in book', () => {
  it('a joseki move on the drilled path is good, with its note and kind', () => {
    const v = judgeMove({ node: afterAttach, played: P('Q13'), ...drill('fixture-hane'), ...noEngine })
    expect(v).toEqual({ type: 'good', kind: 'joseki', note: 'Hane underneath. White gets room on the side.' })
  })

  it('a joseki move of another pattern is other-joseki in a drill', () => {
    const v = judgeMove({ node: afterAttach, played: P('R13'), ...drill('fixture-hane'), ...noEngine })
    expect(v).toEqual({
      type: 'other-joseki',
      note: 'Extend down the side and keep the stones together.',
      patternIds: ['fixture-crawl'],
    })
  })

  it('the same move is simply good in free sparring', () => {
    const v = judgeMove({ node: afterAttach, played: P('R13'), ...free, ...noEngine })
    expect(v).toEqual({ type: 'good', kind: 'joseki', note: 'Extend down the side and keep the stones together.' })
  })

  it('a book tenuki matches a tenuki node', () => {
    expect(judgeMove({ node: afterAttach, played: 'tenuki', ...drill('fixture-tenuki'), ...noEngine }).type).toBe('good')
    const other = judgeMove({ node: afterAttach, played: 'tenuki', ...drill('fixture-hane'), ...noEngine })
    expect(other).toMatchObject({ type: 'other-joseki', patternIds: ['fixture-tenuki'] })
  })

  it('a book mistake in a drill points at the drilled path’s move; points lost are null without the engine', () => {
    const v = judgeMove({ node: afterHane, played: P('R13'), ...drill('fixture-hane'), ...noEngine })
    expect(v).toEqual({
      type: 'mistake',
      inBook: true,
      better: P('P13'),
      pointsLost: null,
      big: false,
      note: 'Cutting too early. The stone has two liberties and White can chase it.',
    })
  })

  it('a book mistake in free sparring points at the highest-weight joseki child', () => {
    const v = judgeMove({ node: afterAttach, played: P('T19'), ...free, ...noEngine })
    // Q13, R13 and tenuki all weigh 1: the first one wins.
    expect(v).toMatchObject({ type: 'mistake', inBook: true, better: P('Q13') })
    const d = judgeMove({ node: afterAttach, played: P('T19'), ...drill('fixture-crawl'), ...noEngine })
    expect(d).toMatchObject({ type: 'mistake', inBook: true, better: P('R13') })
  })

  it('a book mistake takes its points lost from the engine when it has them', () => {
    const v = judgeMove({
      node: afterHane,
      played: P('R13'),
      ...drill('fixture-hane'),
      before: engine('P13', 1.2),
      scoreAfter: -3.8,
      thresholds: T,
    })
    expect(v).toMatchObject({ type: 'mistake', inBook: true, pointsLost: 5, big: true, better: P('P13') })
  })
})

describe('judgeMove: tricks', () => {
  // Black's trick R13 (instead of Q14) and an alternative P17 that weighs more than the joseki Q14.
  const TRICKY: FamilyDef = {
    id: 'star44',
    name: 'trick test',
    setup: 'handicap4',
    start: [{ c: 'B', at: 'Q16', note: 'corner' }],
    patterns: [
      {
        id: 'calm',
        name: 'calm',
        difficulty: 1,
        order: 1,
        line: [
          { c: 'W', at: 'R14', note: 'Approach.' },
          { c: 'B', at: 'Q14', note: 'Attach.' },
        ],
        branches: [
          { after: 1, move: { c: 'B', at: 'R13', kind: 'trick', note: 'A trick. It fails if White stays calm.' } },
          { after: 1, move: { c: 'B', at: 'P17', kind: 'alternative', weight: 2, note: 'Also fine.' } },
        ],
      },
    ],
  }
  const tb = buildBook([TRICKY])
  const node = find(tb.families.star44.root, 'W:R14')

  it('an owner move on a trick child is a mistake with the trick’s note; drill: the path move is better', () => {
    const v = judgeMove({
      node,
      played: P('R13'),
      mode: 'drill',
      drillPatternId: 'calm',
      drillPath: tb.patterns.calm.path,
      ...noEngine,
    })
    expect(v).toEqual({
      type: 'mistake',
      inBook: true,
      better: P('Q14'),
      pointsLost: null,
      big: false,
      note: 'A trick. It fails if White stays calm.',
    })
  })

  it('free: the highest-weight joseki/alternative child is better', () => {
    const v = judgeMove({ node, played: P('R13'), ...free, ...noEngine })
    expect(v).toMatchObject({ type: 'mistake', inBook: true, better: P('P17') })
  })

  it('names no better move when neither the book nor the engine has one', () => {
    // After W R14 this book has only Black's trick: nothing sound to point at.
    const only = buildBook([
      { ...TRICKY, patterns: [{ ...TRICKY.patterns[0], line: TRICKY.patterns[0].line.slice(0, 1), branches: [TRICKY.patterns[0].branches![0]] }] },
    ])
    const n = find(only.families.star44.root, 'W:R14')
    expect(n.children.map((c) => c.kind)).toEqual(['trick'])
    const v = judgeMove({ node: n, played: P('R13'), ...free, ...noEngine })
    expect(v).toEqual({ type: 'mistake', inBook: true, better: null, pointsLost: null, big: false, note: 'A trick. It fails if White stays calm.' })
    // With the engine it points at the engine's corner move.
    const e = judgeMove({ node: n, played: P('R13'), ...free, before: engine('Q14', 1), scoreAfter: -2, thresholds: T })
    expect(e).toMatchObject({ better: P('Q14'), pointsLost: 3 })
  })
})

describe('judgeMove: off book', () => {
  it('is unjudged without engine data', () => {
    const offBook = { node: afterHane, played: P('S12'), ...drill('fixture-hane'), thresholds: T }
    expect(judgeMove({ ...offBook, before: null, scoreAfter: null })).toEqual({ type: 'unjudged', reason: 'engine-failed' })
    expect(judgeMove({ ...offBook, before: engine('P13', 0), scoreAfter: null }).type).toBe('unjudged')
    expect(judgeMove({ ...offBook, before: null, scoreAfter: 0 }).type).toBe('unjudged')
  })

  it('a small loss is fine, with the book move for reference', () => {
    const v = judgeMove({ node: afterHane, played: P('S12'), ...drill('fixture-hane'), before: engine('P13', 2), scoreAfter: 1, thresholds: T })
    expect(v).toEqual({ type: 'fine-offbook', pointsLost: 1, bookMove: P('P13') })
    const edge = judgeMove({ node: afterHane, played: P('S12'), ...free, before: engine('P13', 2), scoreAfter: 0.5, thresholds: T })
    expect(edge).toEqual({ type: 'fine-offbook', pointsLost: 1.5, bookMove: P('P13') })
  })

  it('never reports a negative loss', () => {
    const v = judgeMove({ node: afterHane, played: P('S12'), ...free, before: engine('P13', 0), scoreAfter: 3, thresholds: T })
    expect(v).toEqual({ type: 'fine-offbook', pointsLost: 0, bookMove: P('P13') })
  })

  it('has no book move once the session is off book', () => {
    const v = judgeMove({ node: null, played: P('S12'), ...free, before: engine('P13', 0), scoreAfter: 0, thresholds: T })
    expect(v).toEqual({ type: 'fine-offbook', pointsLost: 0, bookMove: null })
  })

  it('a bigger loss is a mistake with the engine’s corner move as better; big only above the big threshold', () => {
    const v = judgeMove({ node: afterHane, played: P('S12'), ...free, before: engine('P13', 1), scoreAfter: -1, thresholds: T })
    expect(v).toEqual({ type: 'mistake', inBook: false, better: P('P13'), pointsLost: 2, big: false })
    const four = judgeMove({ node: afterHane, played: P('S12'), ...free, before: engine('O14', 1), scoreAfter: -3, thresholds: T })
    expect(four).toMatchObject({ type: 'mistake', pointsLost: 4, big: false, better: P('O14') })
    const big = judgeMove({ node: null, played: P('S12'), ...free, before: engine('O14', 1), scoreAfter: -3.5, thresholds: T })
    expect(big).toMatchObject({ type: 'mistake', pointsLost: 4.5, big: true })
  })

  it('uses the given thresholds', () => {
    const v = judgeMove({ node: null, played: P('S12'), ...free, before: engine('O14', 1), scoreAfter: 0, thresholds: { fine: 0.5, big: 0.8 } })
    expect(v).toMatchObject({ type: 'mistake', pointsLost: 1, big: true })
  })

  it('a tenuki is measured against the best move elsewhere when that is the bigger option', () => {
    // Corner best +0, elsewhere best +2: the owner's tenuki scored +1.5 → lost 0.5.
    const before = analysisOf('black', [['P13', 0]], ['D10', 2])
    const fine = judgeMove({ node: afterHane, played: 'tenuki', ...free, before, scoreAfter: 1.5, thresholds: T })
    expect(fine).toEqual({ type: 'fine-offbook', pointsLost: 0.5, bookMove: P('P13') })
    const bad = judgeMove({ node: afterHane, played: 'tenuki', ...free, before, scoreAfter: -1, thresholds: T })
    expect(bad).toEqual({ type: 'mistake', inBook: false, better: P('D10'), pointsLost: 3, big: false })
  })

  it('a tenuki when the corner is urgent is still measured against the corner move', () => {
    // Corner best +6, best elsewhere −2: even the best tenuki point loses 8.
    const before = analysisOf('black', [['P13', 6]], ['D10', -2])
    const v = judgeMove({ node: afterHane, played: 'tenuki', ...free, before, scoreAfter: -2, thresholds: T })
    expect(v).toEqual({ type: 'mistake', inBook: false, better: P('P13'), pointsLost: 8, big: true })
  })

  it('a tenuki with no move elsewhere known is measured against the corner move', () => {
    const before = analysisOf('black', [['P13', 1]], null)
    const v = judgeMove({ node: null, played: 'tenuki', ...free, before, scoreAfter: 0, thresholds: T })
    expect(v).toEqual({ type: 'fine-offbook', pointsLost: 1, bookMove: null })
  })

  describe('one search when the move was looked at (R40)', () => {
    // Before the move, the search saw S12 at 1.6 and P13 at 2. The fresh search after the move comes back
    // 2 points lower than the search's own value (a short, noisy search), which used to read as a mistake.
    const before = analysisOf('black', [['P13', 2], ['S12', 1.6], ['O14', -1]], ['D10', -20])

    it('playing the engine’s own best move is fine with loss 0, however low the search after it says', () => {
      const v = judgeMove({ node: afterHane, played: P('P13'), ...free, before, scoreAfter: 0, thresholds: T })
      // P13 is a book move here, so leave the book for this one: same position, no book node.
      expect(v.type).toBe('good')
      const off = judgeMove({ node: null, played: P('P13'), ...free, before, scoreAfter: -3, thresholds: T })
      expect(off).toEqual({ type: 'fine-offbook', pointsLost: 0, bookMove: null })
      const noAfter = judgeMove({ node: null, played: P('P13'), ...free, before, scoreAfter: null, thresholds: T })
      expect(noAfter).toEqual({ type: 'fine-offbook', pointsLost: 0, bookMove: null })
    })

    it('a move the search looked at loses the difference inside that one search', () => {
      const close = judgeMove({ node: afterHane, played: P('S12'), ...free, before, scoreAfter: -5, thresholds: T })
      expect(close).toEqual({ type: 'fine-offbook', pointsLost: 0.4, bookMove: P('P13') })
      const far = judgeMove({ node: afterHane, played: P('O14'), ...free, before, scoreAfter: 5, thresholds: T })
      expect(far).toEqual({ type: 'mistake', inBook: false, better: P('P13'), pointsLost: 3, big: false })
    })

    it('a move the search didn’t look at falls back to the search after it', () => {
      const v = judgeMove({ node: afterHane, played: P('Q12'), ...free, before, scoreAfter: -1, thresholds: T })
      expect(v).toEqual({ type: 'mistake', inBook: false, better: P('P13'), pointsLost: 3, big: false })
      expect(judgeMove({ node: afterHane, played: P('Q12'), ...free, before, scoreAfter: null, thresholds: T }).type).toBe('unjudged')
    })

    it('a candidate scored above the best one loses nothing', () => {
      const odd = analysisOf('black', [['P13', 1], ['S12', 1.8]], null)
      const v = judgeMove({ node: null, played: P('S12'), ...free, before: odd, scoreAfter: -4, thresholds: T })
      expect(v).toEqual({ type: 'fine-offbook', pointsLost: 0, bookMove: null })
    })

    it('a tenuki on the engine’s best point elsewhere is judged inside the same analysis (R19 still picks the reference)', () => {
      // Elsewhere is bigger than the corner and the owner played exactly there: loss 0, nothing named.
      const big = analysisOf('black', [['P13', 0]], ['D10', 2])
      const v = judgeMove({ node: afterHane, played: 'tenuki', tenukiAt: P('D10'), ...free, before: big, scoreAfter: -2, thresholds: T })
      expect(v).toEqual({ type: 'fine-offbook', pointsLost: 0, bookMove: P('P13') })
      // The corner is urgent: the best point elsewhere still loses the corner's lead over it.
      const urgent = analysisOf('black', [['P13', 6]], ['D10', -2])
      const u = judgeMove({ node: afterHane, played: 'tenuki', tenukiAt: P('D10'), ...free, before: urgent, scoreAfter: 3, thresholds: T })
      expect(u).toEqual({ type: 'mistake', inBook: false, better: P('P13'), pointsLost: 8, big: true })
      // A tenuki somewhere else is measured with the search after it, as before.
      const other = judgeMove({ node: afterHane, played: 'tenuki', tenukiAt: P('K4'), ...free, before: big, scoreAfter: -1, thresholds: T })
      expect(other).toEqual({ type: 'mistake', inBook: false, better: P('D10'), pointsLost: 3, big: false })
    })

    it('never names the move played as the better one', () => {
      for (const scoreAfter of [-10, -2, 0, null]) {
        for (const played of [P('P13'), P('S12'), P('O14')]) {
          const v = judgeMove({ node: null, played, ...free, before, scoreAfter, thresholds: T })
          if (v.type === 'mistake') expect(v.better).not.toEqual(played)
        }
      }
    })

    it('an in-book mistake without a checked loss takes its points from the one search too', () => {
      const withMistake = analysisOf('black', [['P13', 1.2], ['R13', -1.3]], ['D10', -20])
      const v = judgeMove({ node: afterHane, played: P('R13'), ...drill('fixture-hane'), before: withMistake, scoreAfter: 4, thresholds: T })
      expect(v).toMatchObject({ type: 'mistake', inBook: true, pointsLost: 2.5, better: P('P13') })
    })
  })

  it('rounds points lost to one decimal and judges the rounded value', () => {
    const v = judgeMove({ node: null, played: P('S12'), ...free, before: engine('P13', 1.54), scoreAfter: 0, thresholds: T })
    expect(v).toEqual({ type: 'fine-offbook', pointsLost: 1.5, bookMove: null })
  })
})
