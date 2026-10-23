// The course (R32): which pattern and side comes next, what is due, and how much is mastered.

import { describe, expect, it } from 'vitest'
import { BOOK } from '../../src/book/data'
import { courseOrder, currentStreak, dueItems, masteredCount, newItems } from '../../src/progress/course'
import type { Progress, ReviewState } from '../../src/progress/srs'
import { defaultProgress } from '../../src/progress/store'
import { drillableSides } from '../../src/session/sides'

const TODAY = '2026-10-22'

function review(box: ReviewState['box'], due: string): ReviewState {
  return { box, due, runs: 1, cleanRuns: 1, missedKeys: [] }
}

function progressWith(reviews: Record<string, ReviewState>, patch: Partial<Progress> = {}): Progress {
  return { ...defaultProgress(), reviews, ...patch }
}

const keys = (items: { key: string }[]) => items.map((i) => i.key)

// The book grows, so totals come from the book itself: every pattern × the sides it can be drilled from.
const BY_ORDER = Object.keys(BOOK.patterns).sort((a, b) => BOOK.patterns[a].def.order - BOOK.patterns[b].def.order)
const TOTAL = BY_ORDER.reduce((n, id) => n + drillableSides(BOOK, id).length, 0)

describe('courseOrder', () => {
  const order = keys(courseOrder(BOOK))

  it('starts with the defend side of every 4-4 point and 3-3 invasion pattern, by order', () => {
    expect(order.slice(0, 14)).toEqual([
      'star44-low-knight-slide:defend',
      'star44-low-attach-extend:defend',
      'star44-low-jump:defend',
      'star44-low-pincer:defend',
      'star44-high-attach:defend',
      'star44-high-knight:defend',
      'star44-double-approach:defend',
      'star44-low-tenuki:defend',
      'invade33-hane-hane:defend',
      'invade33-other-side-jump:defend',
      'invade33-stand:defend',
      'invade33-after-knight:defend',
      'invade33-wrong-side:defend',
      'invade33-cut-trick:defend',
    ])
  })

  it('then every other pattern and side by order, defend before attack', () => {
    expect(order.slice(14, 21)).toEqual([
      'star44-low-knight-slide:attack',
      'star44-low-attach-extend:attack',
      'star44-low-jump:attack',
      'star44-low-pincer:attack',
      'star44-high-attach:attack',
      'star44-high-knight:attack',
      'star44-double-approach:attack',
    ])
    // From there on: pattern by pattern in order, defend before attack, the last pattern last.
    const last = BY_ORDER[BY_ORDER.length - 1]
    expect(order.slice(-2)).toEqual([`${last}:defend`, `${last}:attack`])
    const rest = order.slice(14).map((k) => {
      const [id, side] = k.split(':')
      return BOOK.patterns[id].def.order * 2 + (side === 'attack' ? 1 : 0)
    })
    expect(rest).toEqual([...rest].sort((a, b) => a - b))
  })

  it('holds each drillable side once and leaves out the trick side', () => {
    expect(order).toHaveLength(TOTAL)
    expect(new Set(order).size).toBe(TOTAL)
    // One pattern has a trick in its main line, so it has one side, not two.
    expect(TOTAL).toBe(2 * BY_ORDER.length - 1)
    expect(order).not.toContain('invade33-cut-trick:attack')
    const k = order.indexOf('komoku34-attach-drawback:defend')
    expect(order[k + 1]).toBe('komoku34-attach-drawback:attack')
  })
})

describe('newItems', () => {
  it('skips anything with a review and returns exactly n', () => {
    const p = progressWith({
      'star44-low-knight-slide:defend': review(1, '2026-10-23'),
      'star44-low-jump:defend': review(2, '2026-10-30'),
    })
    expect(keys(newItems(BOOK, p, 3))).toEqual([
      'star44-low-attach-extend:defend',
      'star44-low-pincer:defend',
      'star44-high-attach:defend',
    ])
    expect(newItems(BOOK, p, 0)).toEqual([])
  })

  it('returns fewer when the course runs out', () => {
    const all = Object.fromEntries(keys(courseOrder(BOOK)).map((k) => [k, review(1, '2026-12-01')]))
    delete all['sansan33-fourth-line-approach:attack']
    expect(keys(newItems(BOOK, progressWith(all), 2))).toEqual(['sansan33-fourth-line-approach:attack'])
  })
})

describe('dueItems', () => {
  it('keeps the most overdue first and drops keys the book no longer drills', () => {
    const p = progressWith({
      'invade33-hane-hane:attack': review(2, TODAY),
      'star44-low-jump:defend': review(1, '2026-10-20'),
      'star44-high-knight:defend': review(3, '2026-10-29'),
      'invade33-cut-trick:attack': review(1, '2026-10-01'),
      'gone-pattern:defend': review(1, '2026-10-01'),
    })
    const due = dueItems(BOOK, p, TODAY)
    expect(keys(due)).toEqual(['star44-low-jump:defend', 'invade33-hane-hane:attack'])
    expect(due[0]).toMatchObject({ patternId: 'star44-low-jump', family: 'star44', side: 'defend' })
  })
})

describe('masteredCount', () => {
  it('counts box 4 and up over every drillable side (a trick pattern has one side, not two)', () => {
    const p = progressWith({
      'star44-low-knight-slide:defend': review(4, '2026-11-01'),
      'komoku34-tenuki:defend': review(5, '2026-11-20'),
      'invade33-cut-trick:defend': review(4, '2026-11-02'),
      'invade33-cut-trick:attack': review(5, '2026-11-02'),
      'star44-low-jump:defend': review(3, '2026-11-02'),
      'gone-pattern:defend': review(5, '2026-11-02'),
    })
    expect(masteredCount(BOOK, p)).toEqual({ mastered: 3, total: TOTAL })
    expect(masteredCount(BOOK, defaultProgress())).toEqual({ mastered: 0, total: TOTAL })
  })
})

describe('currentStreak', () => {
  it('counts while the last session was today or yesterday, else it is broken', () => {
    const at = (lastDay: string | null, count = 5) => currentStreak(progressWith({}, { streak: { count, lastDay } }), TODAY)
    expect(at(TODAY)).toBe(5)
    expect(at('2026-10-21')).toBe(5)
    expect(at('2026-10-20')).toBe(0)
    expect(at(null, 0)).toBe(0)
    expect(at('2026-10-25')).toBe(5)
  })
})
