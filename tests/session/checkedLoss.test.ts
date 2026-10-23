// R29: an in-book mistake reports the native book check's points lost, not the browser engine's.

import { describe, expect, it } from 'vitest'
import { buildBook } from '../../src/book/build'
import { checkedLoss, type CheckedLoss } from '../../src/book/checkedLoss'
import { BOOK as REAL_BOOK } from '../../src/book/data'
import type { BookNode } from '../../src/book/types'
import { parseGtp } from '../../src/go/coords'
import { SparController } from '../../src/session/controller'
import { DEFAULT_THRESHOLDS, judgeMove } from '../../src/session/judge'
import { FIXTURE_FAMILY } from '../book/fixture'
import { analysisOf, FakeEngine } from './fakeEngine'

const BOOK = buildBook([FIXTURE_FAMILY])
const MISTAKE_KEY = 'W:R14/B:Q14/W:Q13/B:R13' // fixture-hane: B R13 cuts too early

function make(engine: FakeEngine, bookLoss?: CheckedLoss) {
  return new SparController(
    BOOK,
    engine,
    {
      mode: 'drill',
      family: 'star44',
      patternId: 'fixture-hane',
      side: 'defend',
      sym: 0,
      seed: 1,
      thresholds: DEFAULT_THRESHOLDS,
      missed: new Set(),
    },
    { bookLoss },
  )
}

async function toTheMistake(c: SparController) {
  await c.start()
  await c.ownerPlay(parseGtp('Q14'))
  await c.ownerPlay(parseGtp('R13'))
}

function nodeAt(root: BookNode, key: string): BookNode {
  let n = root
  for (const part of key.split('/')) {
    const next = n.children.find((c) => c.key.split('/').pop() === part)
    if (!next) throw new Error(`no ${part} under ${n.key}`)
    n = next
  }
  return n
}

describe('judgeMove with a checked loss', () => {
  const afterHane = nodeAt(BOOK.families.star44.root, 'W:R14/B:Q14/W:Q13')
  const base = {
    node: afterHane,
    played: parseGtp('R13'),
    mode: 'drill' as const,
    drillPatternId: 'fixture-hane',
    thresholds: DEFAULT_THRESHOLDS,
  }

  it('reports the checked loss over the engine’s, and keeps the book’s better move', () => {
    const v = judgeMove({ ...base, before: analysisOf('black', [['P13', 1.2]], null), scoreAfter: 0.8, checkedLoss: 5.12 })
    expect(v).toMatchObject({ type: 'mistake', inBook: true, pointsLost: 5.1, big: true, better: parseGtp('P13') })
  })

  it('works without the engine, and falls back to it when the check has no number', () => {
    expect(judgeMove({ ...base, before: null, scoreAfter: null, checkedLoss: 2.34 })).toMatchObject({ pointsLost: 2.3, big: false })
    expect(judgeMove({ ...base, before: analysisOf('black', [['P13', 1.2]], null), scoreAfter: 0.8, checkedLoss: null })).toMatchObject({
      pointsLost: 0.4,
    })
  })
})

describe('SparController with a book-loss lookup', () => {
  it('a book mistake shows the checked loss and asks the engine nothing', async () => {
    const asked: Array<[string, string]> = []
    const engine = new FakeEngine({ score: () => -0.4 })
    const c = make(engine, (family, key) => {
      asked.push([family, key])
      return key === MISTAKE_KEY ? 2.4 : null
    })
    await toTheMistake(c)
    expect(c.state.lastVerdict).toMatchObject({ type: 'mistake', inBook: true, pointsLost: 2.4, better: parseGtp('P13') })
    expect(asked).toContainEqual(['star44', MISTAKE_KEY])
    expect(engine.scoreCalls).toHaveLength(0)
    await c.playOn()
    await c.ownerPlay(parseGtp('S13'))
    expect(c.state.result).toMatchObject({ mistakes: 1, pointsLost: 2.4, clean: false })
  })

  it('falls back to the engine when the lookup has nothing for the node', async () => {
    const c = make(new FakeEngine({ score: () => -3 }), () => null)
    await toTheMistake(c)
    expect(c.state.lastVerdict).toMatchObject({ type: 'mistake', pointsLost: 3 })
  })

  it('works with the engine still loading', async () => {
    const c = make(new FakeEngine({ status: 'loading' }), (_f, key) => (key === MISTAKE_KEY ? 1.8 : null))
    await toTheMistake(c)
    expect(c.state.lastVerdict).toMatchObject({ type: 'mistake', pointsLost: 1.8 })
  })
})

describe('checkedLoss (the real verify files)', () => {
  it('has the knight drill’s second-line block at more than 1.5 points', () => {
    const key = 'W:R14/B:O17/W:S16/B:S17'
    expect(REAL_BOOK.patterns['star44-low-knight-slide']).toBeDefined()
    expect(checkedLoss('star44', key)).toBeGreaterThan(1.5)
  })

  it('has a number for every mistake node in the book', () => {
    for (const [family, fb] of Object.entries(REAL_BOOK.families)) {
      const stack = [fb.root]
      while (stack.length > 0) {
        const n = stack.pop()!
        if (n.kind === 'mistake') expect(checkedLoss(family as 'star44', n.key), `${family}:${n.key}`).not.toBeNull()
        stack.push(...n.children)
      }
    }
  })

  it('is null for anything it doesn’t know', () => {
    expect(checkedLoss('star44', 'W:A1')).toBeNull()
    expect(checkedLoss('__proto__' as 'star44', 'W:R14')).toBeNull()
    expect(checkedLoss('star44', '__proto__')).toBeNull()
  })
})
