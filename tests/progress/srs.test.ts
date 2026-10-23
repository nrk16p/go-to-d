import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  addDays,
  applyResult,
  BOX_DAYS,
  dueKeys,
  isMastered,
  reviewKey,
  type Progress,
  type ReviewState,
} from '../../src/progress/srs'
import { defaultProgress } from '../../src/progress/store'

function review(over: Partial<ReviewState> = {}): ReviewState {
  return { box: 1, due: '2026-03-10', runs: 1, cleanRuns: 1, missedKeys: [], ...over }
}

function progressWith(reviews: Record<string, ReviewState>): Progress {
  return { ...defaultProgress(), reviews }
}

describe('reviewKey', () => {
  it('is "id:side"', () => {
    expect(reviewKey('star44-3-3', 'defend')).toBe('star44-3-3:defend')
    expect(reviewKey('star44-3-3', 'attack')).toBe('star44-3-3:attack')
  })
})

describe('BOX_DAYS', () => {
  it('is the Leitner ladder', () => {
    expect(BOX_DAYS).toEqual([0, 1, 3, 7, 14, 30])
  })
})

describe('addDays', () => {
  it('adds days inside a month', () => {
    expect(addDays('2026-03-10', 3)).toBe('2026-03-13')
    expect(addDays('2026-03-10', 0)).toBe('2026-03-10')
  })

  it('crosses month ends, including February in leap and common years', () => {
    expect(addDays('2026-01-31', 1)).toBe('2026-02-01')
    expect(addDays('2026-02-28', 1)).toBe('2026-03-01')
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29')
    expect(addDays('2028-02-28', 2)).toBe('2028-03-01')
    expect(addDays('2026-04-30', 30)).toBe('2026-05-30')
    expect(addDays('2026-05-31', 30)).toBe('2026-06-30')
  })

  it('crosses year ends', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(addDays('2026-12-15', 30)).toBe('2027-01-14')
  })

  it('goes backwards', () => {
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28')
    expect(addDays('2027-01-01', -1)).toBe('2026-12-31')
  })

  it('rejects text that is not a calendar day', () => {
    expect(() => addDays('tomorrow', 1)).toThrow()
    expect(() => addDays('2026-02-30', 1)).toThrow()
    expect(() => addDays('2026-2-3', 1)).toThrow()
  })

  describe('across daylight saving changes', () => {
    afterEach(() => {
      vi.unstubAllEnvs()
    })

    // One step per calendar day for a whole year, checked against UTC arithmetic (which has no DST).
    function nextDayUtc(day: string): string {
      const [y, m, d] = day.split('-').map(Number)
      return new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10)
    }

    for (const tz of [
      'America/New_York',
      'Europe/London',
      'America/Sao_Paulo',
      'Australia/Lord_Howe',
      'Pacific/Auckland',
      'Asia/Bangkok',
    ]) {
      it(`steps exactly one day at a time in ${tz}`, () => {
        vi.stubEnv('TZ', tz)
        expect(Intl.DateTimeFormat().resolvedOptions().timeZone).toBe(tz)
        let day = '2026-01-01'
        for (let i = 0; i < 400; i++) {
          const next = addDays(day, 1)
          expect(next).toBe(nextDayUtc(day))
          expect(addDays(next, -1)).toBe(day)
          day = next
        }
        expect(addDays('2026-03-01', 30)).toBe('2026-03-31')
        expect(addDays('2026-10-01', 30)).toBe('2026-10-31')
      })
    }
  })
})

describe('applyResult', () => {
  const today = '2026-03-10'

  it('a clean first run lands in box 1, due tomorrow, and remembers the day it was first played', () => {
    const r = applyResult(undefined, true, [], today)
    expect(r).toEqual({ box: 1, due: '2026-03-11', runs: 1, cleanRuns: 1, missedKeys: [], firstDay: today })
  })

  it('a first run with mistakes lands in box 1, due tomorrow, with the missed keys', () => {
    const r = applyResult(undefined, false, ['k1', 'k2'], today)
    expect(r).toEqual({ box: 1, due: '2026-03-11', runs: 1, cleanRuns: 0, missedKeys: ['k1', 'k2'], firstDay: today })
  })

  it('keeps the first day through later runs, and leaves it unknown on a review saved before it existed (R44)', () => {
    let r = applyResult(undefined, true, [], today)
    r = applyResult(r, false, ['k'], '2026-03-11')
    r = applyResult(r, true, [], '2026-03-12')
    expect(r.firstDay).toBe(today)
    const old = applyResult(review({ box: 2, due: '2026-03-10' }), true, [], today)
    expect(old).not.toHaveProperty('firstDay')
    const oldMiss = applyResult(review({ box: 2, due: '2026-03-10' }), false, ['k'], today)
    expect(oldMiss).not.toHaveProperty('firstDay')
  })

  it('clean runs on their due days climb the ladder: due is the run day plus the new box’s days', () => {
    let r = applyResult(undefined, true, [], today)
    const seen: Array<[number, string]> = [[r.box, r.due]]
    for (let i = 0; i < 5; i++) {
      r = applyResult(r, true, [], r.due)
      seen.push([r.box, r.due])
    }
    expect(seen).toEqual([
      [1, '2026-03-11'],
      [2, '2026-03-14'],
      [3, '2026-03-21'],
      [4, '2026-04-04'],
      [5, '2026-05-04'],
      [5, '2026-06-03'], // box 5 is the top: it stays there
    ])
  })

  it('a clean run after the due day promotes from the day it was done', () => {
    const r = applyResult(review({ box: 2, due: '2026-03-01' }), true, [], today)
    expect(r.box).toBe(3)
    expect(r.due).toBe('2026-03-17')
  })

  describe('a clean run before the due day', () => {
    const early = review({ box: 3, due: '2026-03-17', runs: 4, cleanRuns: 3, missedKeys: ['a'] })

    it('keeps the box and the due day', () => {
      const r = applyResult(early, true, [], today)
      expect(r.box).toBe(3)
      expect(r.due).toBe('2026-03-17')
    })

    it('still counts the run and leaves the missed keys', () => {
      const r = applyResult(early, true, ['ignored'], today)
      expect(r.runs).toBe(5)
      expect(r.cleanRuns).toBe(4)
      expect(r.missedKeys).toEqual(['a'])
      expect(r.missedKeys).not.toBe(early.missedKeys)
    })

    it('holds at the top box too', () => {
      const r = applyResult(review({ box: 5, due: '2026-04-09' }), true, [], today)
      expect(r.box).toBe(5)
      expect(r.due).toBe('2026-04-09')
    })

    it('does not change what it was given', () => {
      const snapshot = structuredClone(early)
      applyResult(early, true, [], today)
      expect(early).toEqual(snapshot)
    })

    it('promotes once the due day comes', () => {
      expect(applyResult(early, true, [], '2026-03-16').box).toBe(3)
      const r = applyResult(early, true, [], '2026-03-17')
      expect(r.box).toBe(4)
      expect(r.due).toBe('2026-03-31')
    })

    it('does not save a miss: a miss is always box 1, due tomorrow', () => {
      const r = applyResult(early, false, ['k'], today)
      expect(r.box).toBe(1)
      expect(r.due).toBe('2026-03-11')
    })
  })

  it('due dates cross month and year ends', () => {
    expect(applyResult(review({ box: 4, due: '2026-03-10' }), true, [], '2026-03-10').due).toBe('2026-04-09')
    expect(applyResult(review({ box: 3, due: '2026-12-25' }), true, [], '2026-12-25').due).toBe('2027-01-08')
    expect(applyResult(review({ box: 1, due: '2026-02-27' }), true, [], '2026-02-27').due).toBe('2026-03-02')
    expect(applyResult(undefined, true, [], '2026-12-31').due).toBe('2027-01-01')
    expect(applyResult(undefined, false, ['k'], '2028-02-28').due).toBe('2028-02-29')
  })

  it('a miss drops any box back to box 1, due tomorrow', () => {
    for (const box of [1, 2, 3, 4, 5] as const) {
      const r = applyResult(review({ box }), false, ['k'], today)
      expect(r.box).toBe(1)
      expect(r.due).toBe('2026-03-11')
    }
  })

  it('counts runs and clean runs', () => {
    let r = applyResult(undefined, true, [], today)
    r = applyResult(r, false, ['a'], today)
    r = applyResult(r, true, [], today)
    expect(r.runs).toBe(3)
    expect(r.cleanRuns).toBe(2)
  })

  it('merges missed keys without repeats, newest last', () => {
    let r = applyResult(undefined, false, ['a', 'b'], today)
    r = applyResult(r, false, ['b', 'c'], today)
    expect(r.missedKeys).toEqual(['a', 'b', 'c'])
    r = applyResult(r, false, ['a'], today)
    expect(r.missedKeys).toEqual(['b', 'c', 'a'])
  })

  it('keeps only the last 20 missed keys', () => {
    const first = Array.from({ length: 15 }, (_, i) => `a${i}`)
    const second = Array.from({ length: 15 }, (_, i) => `b${i}`)
    let r = applyResult(undefined, false, first, today)
    r = applyResult(r, false, second, today)
    expect(r.missedKeys).toHaveLength(20)
    expect(r.missedKeys.slice(0, 5)).toEqual(['a10', 'a11', 'a12', 'a13', 'a14'])
    expect(r.missedKeys.slice(5)).toEqual(second)
    const many = Array.from({ length: 30 }, (_, i) => `m${i}`)
    expect(applyResult(undefined, false, many, today).missedKeys).toEqual(many.slice(10))
  })

  it('a clean run leaves the missed keys as they were', () => {
    const r = applyResult(review({ missedKeys: ['a', 'b'] }), true, ['ignored'], today)
    expect(r.missedKeys).toEqual(['a', 'b'])
  })

  it('does not change what it was given', () => {
    const prev = review({ box: 2, missedKeys: ['a'] })
    const snapshot = structuredClone(prev)
    const missed = ['b']
    applyResult(prev, false, missed, today)
    applyResult(prev, true, missed, today)
    expect(prev).toEqual(snapshot)
    expect(missed).toEqual(['b'])
    const out = applyResult(prev, true, [], today)
    expect(out.missedKeys).not.toBe(prev.missedKeys)
  })
})

describe('isMastered', () => {
  it('is box 4 and up', () => {
    expect(isMastered(review({ box: 0 }))).toBe(false)
    expect(isMastered(review({ box: 1 }))).toBe(false)
    expect(isMastered(review({ box: 2 }))).toBe(false)
    expect(isMastered(review({ box: 3 }))).toBe(false)
    expect(isMastered(review({ box: 4 }))).toBe(true)
    expect(isMastered(review({ box: 5 }))).toBe(true)
  })

  it('is reached after four clean runs, each on its due day, and lost on a miss', () => {
    let r = applyResult(undefined, true, [], '2026-03-10')
    for (let i = 0; i < 3; i++) r = applyResult(r, true, [], r.due)
    expect(r.box).toBe(4)
    expect(isMastered(r)).toBe(true)
    expect(isMastered(applyResult(r, false, ['k'], r.due))).toBe(false)
  })

  it('is not reached by four clean runs in one day', () => {
    let r = applyResult(undefined, true, [], '2026-03-10')
    for (let i = 0; i < 3; i++) r = applyResult(r, true, [], '2026-03-10')
    expect(r.runs).toBe(4)
    expect(r.cleanRuns).toBe(4)
    expect(r.box).toBe(1)
    expect(r.due).toBe('2026-03-11')
    expect(isMastered(r)).toBe(false)
  })
})

describe('dueKeys', () => {
  it('lists the keys due today or earlier, most overdue first, then by key', () => {
    const p = progressWith({
      'late:defend': review({ due: '2026-03-12' }),
      'b:defend': review({ due: '2026-03-10' }),
      'a:defend': review({ due: '2026-03-10' }),
      'old:attack': review({ due: '2026-02-27' }),
      'older:attack': review({ due: '2025-12-31' }),
      'now:attack': review({ due: '2026-03-11' }),
    })
    expect(dueKeys(p, '2026-03-11')).toEqual(['older:attack', 'old:attack', 'a:defend', 'b:defend', 'now:attack'])
  })

  it('is empty when nothing is due', () => {
    expect(dueKeys(defaultProgress(), '2026-03-11')).toEqual([])
    expect(dueKeys(progressWith({ 'x:defend': review({ due: '2026-03-12' }) }), '2026-03-11')).toEqual([])
  })

  it('compares days across month and year ends', () => {
    const p = progressWith({ 'x:defend': review({ due: '2027-01-01' }) })
    expect(dueKeys(p, '2026-12-31')).toEqual([])
    expect(dueKeys(p, '2027-01-01')).toEqual(['x:defend'])
  })

  it('does not change the progress it was given', () => {
    const p = progressWith({ 'b:defend': review(), 'a:defend': review() })
    const snapshot = structuredClone(p)
    dueKeys(p, '2030-01-01')
    expect(p).toEqual(snapshot)
  })
})
