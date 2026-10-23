// The course (R32): which pattern and side comes next, what is due, and how much is mastered.

import { describe, expect, it } from 'vitest'
import { BOOK } from '../../src/book/data'
import {
  courseOrder,
  currentStreak,
  dueItems,
  masteredCount,
  newItems,
  newOpeningsToday,
  newToday,
  openingOrder,
  startedToday,
  trackOf,
} from '../../src/progress/course'
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
// Joseki (corner families) and whole-board openings (R46) are two lists, and each has its mastered count (R49).
const ALL_BY_ORDER = Object.keys(BOOK.patterns).sort((a, b) => BOOK.patterns[a].def.order - BOOK.patterns[b].def.order)
const isOpening = (id: string) => ['open-h4', 'open-even'].includes(BOOK.patterns[id].family)
const BY_ORDER = ALL_BY_ORDER.filter((id) => !isOpening(id))
const OPENINGS = ALL_BY_ORDER.filter(isOpening)
const sides = (ids: string[]) => ids.reduce((n, id) => n + drillableSides(BOOK, id).length, 0)
const JOSEKI_TOTAL = sides(BY_ORDER)
const OPENINGS_TOTAL = sides(OPENINGS)

describe('courseOrder', () => {
  const order = keys(courseOrder(BOOK))

  // The handicap-game families lead: the defend side of every 4-4 point and 3-3 invasion pattern.
  const LEAD = BY_ORDER.filter(
    (id) => ['star44', 'invade33'].includes(BOOK.patterns[id].family) && drillableSides(BOOK, id).includes('defend'),
  ).map((id) => `${id}:defend`)
  const rank = (k: string) => {
    const [id, side] = k.split(':')
    return BOOK.patterns[id].def.order * 2 + (side === 'attack' ? 1 : 0)
  }

  it('starts with the defend side of every 4-4 point and 3-3 invasion pattern, by order', () => {
    expect(order[0]).toBe('star44-low-knight-slide:defend')
    expect(order.slice(0, LEAD.length)).toEqual(LEAD)
    expect(LEAD).toContain('invade33-cut-trick:defend')
  })

  it('then every other pattern and side by order, defend before attack', () => {
    const rest = order.slice(LEAD.length)
    expect(rest[0]).toBe('star44-low-knight-slide:attack')
    expect(rest.map(rank)).toEqual(rest.map(rank).sort((a, b) => a - b))
    // The last pattern comes last, with every side it can be drilled from.
    const last = BY_ORDER[BY_ORDER.length - 1]
    const lastSides = drillableSides(BOOK, last).map((s) => `${last}:${s}`)
    expect(rest.slice(-lastSides.length)).toEqual(lastSides)
  })

  it('holds each drillable side once and leaves out the trick side', () => {
    expect(order).toHaveLength(JOSEKI_TOTAL)
    expect(new Set(order).size).toBe(JOSEKI_TOTAL)
    // A pattern with a trick in its main line has one side, not two.
    const oneSided = BY_ORDER.filter((id) => drillableSides(BOOK, id).length === 1)
    expect(oneSided).toContain('invade33-cut-trick')
    expect(JOSEKI_TOTAL).toBe(2 * BY_ORDER.length - oneSided.length)
    for (const id of oneSided) {
      const other = drillableSides(BOOK, id)[0] === 'defend' ? 'attack' : 'defend'
      expect(order).not.toContain(`${id}:${other}`)
    }
    expect(order).not.toContain('invade33-cut-trick:attack')
    const k = order.indexOf('komoku34-attach-drawback:defend')
    expect(order[k + 1]).toBe('komoku34-attach-drawback:attack')
  })

  it('has no openings: they are a list of their own (R46)', () => {
    expect(OPENINGS.length).toBeGreaterThan(0)
    expect(order.filter((k) => isOpening(k.slice(0, k.lastIndexOf(':'))))).toEqual([])
  })
})

describe('openingOrder (R46)', () => {
  const order = keys(openingOrder(BOOK))

  it('holds every opening × drillable side once: Black first by order, then White by order', () => {
    expect(order).toHaveLength(sides(OPENINGS))
    const black = OPENINGS.filter((id) => drillableSides(BOOK, id).includes('defend')).map((id) => `${id}:defend`)
    const white = OPENINGS.filter((id) => drillableSides(BOOK, id).includes('attack')).map((id) => `${id}:attack`)
    expect(order).toEqual([...black, ...white])
  })

  it('drills the 4-stone opening as Black only, the even game from both colours', () => {
    const h4 = OPENINGS.filter((id) => BOOK.patterns[id].family === 'open-h4')
    const even = OPENINGS.filter((id) => BOOK.patterns[id].family === 'open-even')
    expect(h4.length).toBeGreaterThan(0)
    expect(even.length).toBeGreaterThan(0)
    for (const id of h4) expect(order).not.toContain(`${id}:attack`)
    for (const id of even) expect(order).toContain(`${id}:attack`)
  })

  it('knows which list a pattern is on', () => {
    expect(trackOf(BOOK, 'star44-low-knight-slide')).toBe('joseki')
    for (const id of OPENINGS) expect(trackOf(BOOK, id)).toBe('openings')
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

describe('new patterns for today (R44)', () => {
  const COURSE = keys(courseOrder(BOOK))
  const started = (day: string | undefined): ReviewState => ({ ...review(1, '2026-10-23'), ...(day ? { firstDay: day } : {}) })

  it('counts the patterns first played today; an old review with no first day is unknown and doesn’t count', () => {
    const p = progressWith({
      [COURSE[0]]: started(TODAY),
      [COURSE[1]]: started('2026-10-21'),
      [COURSE[2]]: started(undefined),
      [COURSE[3]]: started(TODAY),
    })
    expect(startedToday(p, TODAY)).toBe(2)
    expect(startedToday(p, '2026-10-21')).toBe(1)
  })

  it('offers newPerDay less what was started today, then nothing until tomorrow', () => {
    const newPerDay = defaultProgress().settings.newPerDay
    const none = progressWith({})
    expect(keys(newToday(BOOK, none, TODAY))).toEqual(COURSE.slice(0, newPerDay))

    const one = progressWith({ [COURSE[0]]: started(TODAY) })
    expect(keys(newToday(BOOK, one, TODAY))).toEqual(COURSE.slice(1, newPerDay))

    const all = progressWith(Object.fromEntries(COURSE.slice(0, newPerDay).map((k) => [k, started(TODAY)])))
    expect(newToday(BOOK, all, TODAY)).toEqual([])
    // Past the day's share the next one is still there for whoever wants it.
    expect(keys(newItems(BOOK, all, 1))).toEqual([COURSE[newPerDay]])
    // Tomorrow the share is back.
    expect(keys(newToday(BOOK, all, '2026-10-23'))).toEqual(COURSE.slice(newPerDay, 2 * newPerDay))
  })

  it('never goes below none, when more than the day’s share was started', () => {
    const many = progressWith(Object.fromEntries(COURSE.slice(0, 5).map((k) => [k, started(TODAY)])))
    expect(newToday(BOOK, many, TODAY)).toEqual([])
  })
})

describe('new openings for today (R46)', () => {
  const COURSE = keys(courseOrder(BOOK))
  const OPEN = keys(openingOrder(BOOK))
  const started = (day: string): ReviewState => ({ ...review(1, '2026-10-23'), firstDay: day })

  it('offers one new opening a day by default, the first in opening order', () => {
    expect(defaultProgress().settings.newOpeningsPerDay).toBe(1)
    expect(keys(newOpeningsToday(BOOK, progressWith({}), TODAY))).toEqual([OPEN[0]])
  })

  it('counts openings and joseki started today apart, so neither uses up the other’s share', () => {
    // Every joseki of the day started: the opening is still on offer.
    const joseki = progressWith(Object.fromEntries(COURSE.slice(0, 5).map((k) => [k, started(TODAY)])))
    expect(keys(newOpeningsToday(BOOK, joseki, TODAY))).toEqual([OPEN[0]])
    expect(startedToday(joseki, TODAY, { book: BOOK, track: 'openings' })).toBe(0)

    // The day's opening started: none more today, the joseki share untouched, the next opening a tap away.
    const opening = progressWith({ [OPEN[0]]: started(TODAY) })
    expect(newOpeningsToday(BOOK, opening, TODAY)).toEqual([])
    expect(keys(newToday(BOOK, opening, TODAY))).toEqual(COURSE.slice(0, defaultProgress().settings.newPerDay))
    expect(startedToday(opening, TODAY, { book: BOOK, track: 'joseki' })).toBe(0)
    if (OPEN.length > 1) expect(keys(newItems(BOOK, opening, 1, 'openings'))).toEqual([OPEN[1]])
    // Tomorrow it is back.
    expect(newOpeningsToday(BOOK, opening, '2026-10-23')).toHaveLength(Math.min(1, OPEN.length - 1))
  })

  it('offers none when the setting is 0, and up to the setting otherwise', () => {
    const settings = defaultProgress().settings
    expect(newOpeningsToday(BOOK, progressWith({}, { settings: { ...settings, newOpeningsPerDay: 0 } }), TODAY)).toEqual([])
    const three = newOpeningsToday(BOOK, progressWith({}, { settings: { ...settings, newOpeningsPerDay: 3 } }), TODAY)
    expect(keys(three)).toEqual(OPEN.slice(0, 3))
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
  it('counts box 4 and up over every drillable joseki side (a trick pattern has one side, not two)', () => {
    const p = progressWith({
      'star44-low-knight-slide:defend': review(4, '2026-11-01'),
      'komoku34-tenuki:defend': review(5, '2026-11-20'),
      'invade33-cut-trick:defend': review(4, '2026-11-02'),
      'invade33-cut-trick:attack': review(5, '2026-11-02'),
      'star44-low-jump:defend': review(3, '2026-11-02'),
      'gone-pattern:defend': review(5, '2026-11-02'),
    })
    expect(masteredCount(BOOK, p)).toEqual({ mastered: 3, total: JOSEKI_TOTAL })
    expect(masteredCount(BOOK, defaultProgress())).toEqual({ mastered: 0, total: JOSEKI_TOTAL })
  })

  it('counts openings on their own (R49), and leaves them out of the joseki count', () => {
    const opening = keys(openingOrder(BOOK))[0]
    const p = progressWith({ [opening]: review(4, '2026-11-01'), 'star44-low-jump:defend': review(5, '2026-11-02') })
    expect(masteredCount(BOOK, p, 'openings')).toEqual({ mastered: 1, total: OPENINGS_TOTAL })
    expect(masteredCount(BOOK, p)).toEqual({ mastered: 1, total: JOSEKI_TOTAL })
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
