import { describe, expect, it } from 'vitest'
import { buildBook } from '../../src/book/build'
import type { BookNode, FamilyDef, MoveSpec } from '../../src/book/types'
import type { Verdict } from '../../src/session/judge'
import { countOwnerMove, newTally, reachedPattern, sessionResult, switchablePatterns } from '../../src/session/result'

const mv = (c: 'B' | 'W', at: string, extra: Partial<MoveSpec> = {}): MoveSpec => ({ c, at, note: `${c} ${at}.`, ...extra })

// main:    W R14, B Q14, W Q13, B P13        (+ alternative branch B P12, W R13 after W Q13)
// crawl:   W R14, B Q14, W R13, B Q13
// tricky:  W R14, B Q14, W R13, B Q13, W R12 (White's trick on the main line: defend only)
// aside:   W R14, B Q14, W tenuki            (+ branch W R13 after B Q14)
const FAMILY: FamilyDef = {
  id: 'star44',
  name: 'result test',
  setup: 'handicap4',
  start: [mv('B', 'Q16')],
  patterns: [
    {
      id: 'main',
      name: 'main',
      difficulty: 1,
      order: 1,
      line: [mv('W', 'R14'), mv('B', 'Q14'), mv('W', 'Q13'), mv('B', 'P13')],
      branches: [{ after: 3, move: mv('B', 'P12', { kind: 'alternative' }), then: [mv('W', 'R13')] }],
    },
    { id: 'crawl', name: 'crawl', difficulty: 1, order: 3, line: [mv('W', 'R14'), mv('B', 'Q14'), mv('W', 'R13'), mv('B', 'Q13')] },
    {
      id: 'tricky',
      name: 'tricky',
      difficulty: 1,
      order: 4,
      line: [mv('W', 'R14'), mv('B', 'Q14'), mv('W', 'R13'), mv('B', 'Q13'), mv('W', 'R12', { kind: 'trick' })],
    },
    {
      id: 'aside',
      name: 'aside',
      difficulty: 1,
      order: 2,
      line: [mv('W', 'R14'), mv('B', 'Q14'), mv('W', 'tenuki')],
      branches: [{ after: 2, move: mv('W', 'R13') }],
    },
  ],
}
const book = buildBook([FAMILY])

function node(key: string): BookNode {
  const walk = (n: BookNode): BookNode | null => (n.key === key ? n : n.children.map(walk).find((x) => x) ?? null)
  const hit = walk(book.families.star44.root)
  if (!hit) throw new Error(`no node ${key}`)
  return hit
}

const root = book.families.star44.root
const mistake = (pointsLost: number | null): Verdict => ({ type: 'mistake', better: null, pointsLost, big: false, inBook: false })
const good: Verdict = { type: 'good', note: '', kind: 'joseki' }
const drill = { mode: 'drill' as const, patternId: 'main', side: 'defend' as const }
const free = { mode: 'free' as const, side: 'defend' as const }

describe('countOwnerMove', () => {
  it('counts a mistake once per position, keeping the first points lost', () => {
    const t = newTally()
    const at = node('W:R14/B:Q14/W:Q13')
    countOwnerMove(t, { verdict: mistake(3), node: at, child: null, where: 'book:x', drill: false })
    countOwnerMove(t, { verdict: mistake(6), node: at, child: null, where: 'book:x', drill: false })
    countOwnerMove(t, { verdict: mistake(null), node: null, child: null, where: 'off:y', drill: false })
    expect([...t.mistakes]).toEqual([
      ['book:x', 3],
      ['off:y', null],
    ])
    expect([...t.missed]).toEqual(['W:R14/B:Q14/W:Q13'])
    expect(t.ownerMoves).toBe(3)
  })

  it('remembers where a drill left the book, but not in free sparring, and never the root', () => {
    const fine: Verdict = { type: 'fine-offbook', pointsLost: 0.5, bookMove: null }
    const t = newTally()
    countOwnerMove(t, { verdict: fine, node: node('W:R14'), child: null, where: 'a', drill: true })
    countOwnerMove(t, { verdict: fine, node: root, child: null, where: 'b', drill: true })
    expect([...t.missed]).toEqual(['W:R14'])
    expect(t.fineLost).toBe(1)
    const f = newTally()
    countOwnerMove(f, { verdict: fine, node: node('W:R14'), child: null, where: 'a', drill: false })
    expect([...f.missed]).toEqual([])
  })

  it('counts owner moves that matched the book', () => {
    const t = newTally()
    const child = node('W:R14/B:Q14')
    countOwnerMove(t, { verdict: good, node: node('W:R14'), child, where: 'a', drill: true })
    countOwnerMove(t, { verdict: mistake(1), node: node('W:R14/B:Q14/W:Q13'), child: node('W:R14/B:Q14/W:Q13/B:P13'), where: 'b', drill: true })
    expect(t.ownerBookMoves).toBe(2)
    expect(t.missed.size).toBe(1)
  })
})

describe('sessionResult', () => {
  const leaf = node('W:R14/B:Q14/W:Q13/B:P13')

  it('a drill is clean only at a leaf of the drilled pattern with no mistakes', () => {
    const t = newTally()
    expect(sessionResult(book, drill, t, { lastBook: leaf, node: leaf })).toEqual({
      patternIds: ['main'],
      side: 'defend',
      clean: true,
      mistakes: 0,
      pointsLost: 0,
      missedKeys: [],
    })
    // Its own alternative's end counts too.
    const alt = node('W:R14/B:Q14/W:Q13/B:P12/W:R13')
    expect(sessionResult(book, drill, t, { lastBook: alt, node: alt }).clean).toBe(true)
    // Ending off book, or anywhere short of a leaf, does not.
    expect(sessionResult(book, drill, t, { lastBook: node('W:R14'), node: null }).clean).toBe(false)
    expect(sessionResult(book, drill, t, { lastBook: node('W:R14'), node: node('W:R14') }).clean).toBe(false)
    // Another pattern's leaf does not.
    const crawlLeaf = node('W:R14/B:Q14/W:R13/B:Q13')
    expect(sessionResult(book, drill, t, { lastBook: crawlLeaf, node: crawlLeaf }).clean).toBe(false)
    // A mistake spoils it.
    countOwnerMove(t, { verdict: mistake(2), node: leaf.parent, child: null, where: 'x', drill: true })
    expect(sessionResult(book, drill, t, { lastBook: leaf, node: leaf })).toMatchObject({ clean: false, mistakes: 1, pointsLost: 2 })
  })

  it('sums points at one decimal, a mistake without engine points counting 0', () => {
    const t = newTally()
    countOwnerMove(t, { verdict: mistake(0.1), node: null, child: null, where: 'a', drill: false })
    countOwnerMove(t, { verdict: mistake(0.2), node: null, child: null, where: 'b', drill: false })
    countOwnerMove(t, { verdict: mistake(null), node: null, child: null, where: 'c', drill: false })
    expect(sessionResult(book, free, t, { lastBook: null, node: null })).toMatchObject({ mistakes: 3, pointsLost: 0.3 })
  })

  it('free sparring credits the pattern reached only after an owner book move', () => {
    const t = newTally()
    const crawlLeaf = node('W:R14/B:Q14/W:R13/B:Q13')
    expect(sessionResult(book, free, t, { lastBook: crawlLeaf, node: null }).patternIds).toEqual([])
    countOwnerMove(t, { verdict: good, node: node('W:R14'), child: node('W:R14/B:Q14'), where: 'a', drill: false })
    expect(sessionResult(book, free, t, { lastBook: crawlLeaf, node: null })).toMatchObject({ patternIds: ['crawl'], clean: true })
  })
})

describe('reachedPattern', () => {
  it('picks the lowest-order pattern whose main line holds the node', () => {
    expect(reachedPattern(book, node('W:R14/B:Q14'))).toEqual(['main'])
    expect(reachedPattern(book, node('W:R14/B:Q14/W:R13'))).toEqual(['crawl'])
  })

  it('falls back to the patterns of a branch, and gives nothing without a node', () => {
    expect(reachedPattern(book, node('W:R14/B:Q14/W:Q13/B:P12'))).toEqual(['main'])
    expect(reachedPattern(book, null)).toEqual([])
    expect(reachedPattern(book, root)).toEqual([])
  })
})

describe('switchablePatterns', () => {
  const r13 = node('W:R14/B:Q14/W:R13')

  it('offers main-line holders that drill from this side; never a pattern that only branches through', () => {
    expect([...r13.patternIds].sort()).toEqual(['aside', 'crawl', 'tricky'])
    expect(switchablePatterns(book, r13, 'defend')).toEqual(['crawl', 'tricky'])
    // 'tricky' has White's trick: White's side can't drill it.
    expect(switchablePatterns(book, r13, 'attack')).toEqual(['crawl'])
  })

  it('is empty when nothing qualifies', () => {
    const only = buildBook([{ ...FAMILY, patterns: FAMILY.patterns.filter((p) => p.id === 'tricky' || p.id === 'aside') }])
    const n = only.families.star44.root.children[0].children[0].children.find((c) => c.key.endsWith('W:R13'))!
    expect(switchablePatterns(only, n, 'attack')).toEqual([])
  })
})
