import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { SessionResult } from '../../src/session/controller'
import { DEFAULT_THRESHOLDS } from '../../src/session/judge'
import { DEFAULT_VISITS } from '../../src/engine/model'
import { reviewKey, type Progress } from '../../src/progress/srs'
import {
  defaultProgress,
  exportProgress,
  importProgress,
  loadProgress,
  recordSession,
  saveProgress,
  STORAGE_KEY,
  todayLocal,
} from '../../src/progress/store'

class MemoryStorage {
  data = new Map<string, string>()
  getItem = vi.fn((k: string) => this.data.get(k) ?? null)
  setItem = vi.fn((k: string, v: string) => void this.data.set(k, v))
  removeItem = vi.fn((k: string) => void this.data.delete(k))
}

let storage: MemoryStorage

beforeEach(() => {
  storage = new MemoryStorage()
  vi.stubGlobal('localStorage', storage)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

function result(over: Partial<SessionResult> = {}): SessionResult {
  return { patternIds: ['p1'], side: 'defend', clean: true, mistakes: 0, pointsLost: 0, missedKeys: [], ...over }
}

describe('defaultProgress', () => {
  it('is empty, with the agreed settings', () => {
    expect(defaultProgress()).toEqual({
      version: 1,
      reviews: {},
      streak: { count: 0, lastDay: null },
      settings: { thresholds: DEFAULT_THRESHOLDS, visits: DEFAULT_VISITS, newPerDay: 2, iosHintDismissed: false },
    })
  })

  it('hands out a fresh object every time', () => {
    const a = defaultProgress()
    a.settings.thresholds.fine = 99
    a.reviews.x = { box: 1, due: '2026-01-01', runs: 1, cleanRuns: 1, missedKeys: [] }
    const b = defaultProgress()
    expect(b.settings.thresholds.fine).toBe(DEFAULT_THRESHOLDS.fine)
    expect(DEFAULT_THRESHOLDS.fine).toBe(1.5)
    expect(b.reviews).toEqual({})
  })
})

describe('todayLocal', () => {
  it('formats the local calendar day with zero padding', () => {
    expect(todayLocal(new Date(2026, 0, 5, 12))).toBe('2026-01-05')
    expect(todayLocal(new Date(2026, 11, 31, 23, 59, 59))).toBe('2026-12-31')
    expect(todayLocal(new Date(2026, 2, 1, 0, 0, 1))).toBe('2026-03-01')
  })

  it('defaults to now', () => {
    expect(todayLocal()).toBe(todayLocal(new Date()))
    expect(todayLocal()).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})

describe('loadProgress', () => {
  it('returns defaults when nothing is stored', () => {
    expect(loadProgress()).toEqual(defaultProgress())
  })

  it('returns what saveProgress stored', () => {
    const p = recordSession(defaultProgress(), result({ clean: false, missedKeys: ['k1'] }), '2026-03-10')
    saveProgress(p)
    expect(storage.setItem).toHaveBeenCalledWith(STORAGE_KEY, expect.any(String))
    expect(STORAGE_KEY).toBe('go-to-d:progress')
    expect(loadProgress()).toEqual(p)
  })

  it('returns defaults when localStorage getItem throws', () => {
    storage.getItem.mockImplementation(() => {
      throw new Error('SecurityError')
    })
    expect(loadProgress()).toEqual(defaultProgress())
  })

  it('returns defaults when there is no localStorage', () => {
    vi.stubGlobal('localStorage', undefined)
    expect(loadProgress()).toEqual(defaultProgress())
  })

  it('returns defaults when even reading the localStorage property throws', () => {
    const before = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')!
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      get() {
        throw new Error('SecurityError')
      },
    })
    try {
      expect(loadProgress()).toEqual(defaultProgress())
      expect(() => saveProgress(defaultProgress())).not.toThrow()
    } finally {
      Object.defineProperty(globalThis, 'localStorage', before)
    }
  })

  it('returns defaults for corrupt JSON and leaves the stored text alone', () => {
    storage.data.set(STORAGE_KEY, '{not json')
    expect(loadProgress()).toEqual(defaultProgress())
    expect(storage.data.get(STORAGE_KEY)).toBe('{not json')
    expect(storage.setItem).not.toHaveBeenCalled()
  })

  it.each([
    ['null', 'null'],
    ['a number', '7'],
    ['an array', '[]'],
    ['an empty object', '{}'],
    ['another version', JSON.stringify({ ...defaultProgress(), version: 2 })],
    ['no version', JSON.stringify({ reviews: {}, streak: { count: 0, lastDay: null }, settings: defaultProgress().settings })],
    ['no reviews', JSON.stringify({ version: 1, streak: { count: 0, lastDay: null }, settings: defaultProgress().settings })],
    ['no streak', JSON.stringify({ version: 1, reviews: {}, settings: defaultProgress().settings })],
    ['no settings', JSON.stringify({ version: 1, reviews: {}, streak: { count: 0, lastDay: null } })],
    ['reviews as an array', JSON.stringify({ ...defaultProgress(), reviews: [] })],
    ['a review of the wrong shape', JSON.stringify({ ...defaultProgress(), reviews: { 'a:defend': { box: 9 } } })],
    ['a streak of the wrong shape', JSON.stringify({ ...defaultProgress(), streak: { count: 'x', lastDay: 3 } })],
  ])('returns defaults for valid JSON of the wrong shape (%s)', (_name, text) => {
    storage.data.set(STORAGE_KEY, text)
    expect(loadProgress()).toEqual(defaultProgress())
  })

  it('fills settings fields an old save does not have', () => {
    const p = recordSession(defaultProgress(), result(), '2026-03-10')
    const old = JSON.parse(JSON.stringify(p))
    old.settings = { visits: 250 }
    storage.data.set(STORAGE_KEY, JSON.stringify(old))
    const loaded = loadProgress()
    expect(loaded.settings).toEqual({ ...defaultProgress().settings, visits: 250 })
    expect(loaded.reviews).toEqual(p.reviews)
    expect(loaded.streak).toEqual(p.streak)
  })

  it('fills the fields of a half-written thresholds object and ignores bad setting values', () => {
    const raw = {
      ...defaultProgress(),
      settings: { thresholds: { fine: 2 }, visits: 'lots', newPerDay: -3, iosHintDismissed: 'yes', extra: 1 },
    }
    storage.data.set(STORAGE_KEY, JSON.stringify(raw))
    const s = loadProgress().settings
    expect(s).toEqual({
      thresholds: { fine: 2, big: DEFAULT_THRESHOLDS.big },
      visits: DEFAULT_VISITS,
      newPerDay: 2,
      iosHintDismissed: false,
    })
  })

  it('does not touch the stored text', () => {
    saveProgress(defaultProgress())
    storage.setItem.mockClear()
    loadProgress()
    expect(storage.setItem).not.toHaveBeenCalled()
  })
})

describe('saveProgress', () => {
  it('does not throw when setItem throws (quota, private window)', () => {
    storage.setItem.mockImplementation(() => {
      throw new Error('QuotaExceededError')
    })
    expect(() => saveProgress(defaultProgress())).not.toThrow()
  })

  it('does not throw without localStorage', () => {
    vi.stubGlobal('localStorage', undefined)
    expect(() => saveProgress(defaultProgress())).not.toThrow()
  })

  it('writes JSON under the storage key', () => {
    const p = defaultProgress()
    saveProgress(p)
    expect(JSON.parse(storage.data.get(STORAGE_KEY)!)).toEqual(p)
  })
})

describe('recordSession', () => {
  const day1 = '2026-03-10'

  it('updates the review of every pattern in the result, on the result’s side', () => {
    const p = recordSession(defaultProgress(), result({ patternIds: ['p1', 'p2'], side: 'attack' }), day1)
    expect(Object.keys(p.reviews).sort()).toEqual([reviewKey('p1', 'attack'), reviewKey('p2', 'attack')])
    expect(p.reviews[reviewKey('p1', 'attack')]).toEqual({
      box: 1,
      due: '2026-03-11',
      runs: 1,
      cleanRuns: 1,
      missedKeys: [],
    })
  })

  it('keeps the two sides of a pattern apart', () => {
    let p = recordSession(defaultProgress(), result({ side: 'defend' }), day1)
    p = recordSession(p, result({ side: 'attack', clean: false, missedKeys: ['k'] }), day1)
    expect(p.reviews[reviewKey('p1', 'defend')].cleanRuns).toBe(1)
    expect(p.reviews[reviewKey('p1', 'attack')].cleanRuns).toBe(0)
    expect(p.reviews[reviewKey('p1', 'attack')].missedKeys).toEqual(['k'])
  })

  it('uses clean and missedKeys from the result', () => {
    let p = recordSession(defaultProgress(), result(), day1)
    p = recordSession(p, result(), '2026-03-11')
    expect(p.reviews[reviewKey('p1', 'defend')].box).toBe(2)
    p = recordSession(p, result({ clean: false, mistakes: 1, pointsLost: 3, missedKeys: ['m1'] }), '2026-03-13')
    expect(p.reviews[reviewKey('p1', 'defend')]).toMatchObject({ box: 1, due: '2026-03-14', runs: 3, cleanRuns: 2, missedKeys: ['m1'] })
  })

  it('counts a pattern once even if the result lists it twice', () => {
    const p = recordSession(defaultProgress(), result({ patternIds: ['p1', 'p1'] }), day1)
    expect(p.reviews[reviewKey('p1', 'defend')].runs).toBe(1)
  })

  it('leaves other patterns’ reviews and the settings alone', () => {
    let p = recordSession(defaultProgress(), result({ patternIds: ['other'] }), day1)
    p = { ...p, settings: { ...p.settings, visits: 300 } }
    const next = recordSession(p, result(), day1)
    expect(next.reviews[reviewKey('other', 'defend')]).toEqual(p.reviews[reviewKey('other', 'defend')])
    expect(next.settings).toEqual(p.settings)
  })

  it('returns a new object and does not mutate its input', () => {
    const start = recordSession(defaultProgress(), result({ patternIds: ['p1'] }), day1)
    const snapshot = structuredClone(start)
    const next = recordSession(start, result({ patternIds: ['p1', 'p2'], clean: false, missedKeys: ['k'] }), '2026-03-11')
    expect(start).toEqual(snapshot)
    expect(next).not.toBe(start)
    expect(next.reviews).not.toBe(start.reviews)
    expect(next.streak).not.toBe(start.streak)
  })

  describe('streak', () => {
    it('starts at 1 on the first session', () => {
      const p = recordSession(defaultProgress(), result(), day1)
      expect(p.streak).toEqual({ count: 1, lastDay: day1 })
    })

    it('stays the same for more sessions on the same day', () => {
      let p = recordSession(defaultProgress(), result(), day1)
      p = recordSession(p, result(), day1)
      p = recordSession(p, result({ clean: false, missedKeys: ['k'] }), day1)
      expect(p.streak).toEqual({ count: 1, lastDay: day1 })
    })

    it('adds 1 on the next day', () => {
      let p = recordSession(defaultProgress(), result(), day1)
      p = recordSession(p, result(), '2026-03-11')
      expect(p.streak).toEqual({ count: 2, lastDay: '2026-03-11' })
      p = recordSession(p, result(), '2026-03-12')
      expect(p.streak).toEqual({ count: 3, lastDay: '2026-03-12' })
    })

    it('adds 1 across a month end and a year end', () => {
      let p = recordSession(defaultProgress(), result(), '2026-02-28')
      p = recordSession(p, result(), '2026-03-01')
      expect(p.streak.count).toBe(2)
      p = recordSession(defaultProgress(), result(), '2026-12-31')
      p = recordSession(p, result(), '2027-01-01')
      expect(p.streak).toEqual({ count: 2, lastDay: '2027-01-01' })
    })

    it('resets to 1 after a gap', () => {
      let p = recordSession(defaultProgress(), result(), day1)
      p = recordSession(p, result(), '2026-03-11')
      p = recordSession(p, result(), '2026-03-13')
      expect(p.streak).toEqual({ count: 1, lastDay: '2026-03-13' })
    })

    it('is left alone when the clock says a day before the last one', () => {
      let p = recordSession(defaultProgress(), result(), day1)
      p = recordSession(p, result(), '2026-03-11')
      p = recordSession(p, result(), day1)
      expect(p.streak).toEqual({ count: 2, lastDay: '2026-03-11' })
    })
  })

  describe('a session that never reached a named pattern', () => {
    it('counts toward the streak and changes no review', () => {
      const start = recordSession(defaultProgress(), result(), day1)
      const next = recordSession(start, result({ patternIds: [], clean: false, missedKeys: ['k'] }), '2026-03-11')
      expect(next.streak).toEqual({ count: 2, lastDay: '2026-03-11' })
      expect(next.reviews).toEqual(start.reviews)
    })

    it('starts a streak from nothing', () => {
      const p = recordSession(defaultProgress(), result({ patternIds: [] }), day1)
      expect(p.streak).toEqual({ count: 1, lastDay: day1 })
      expect(p.reviews).toEqual({})
    })
  })
})

describe('exportProgress and importProgress', () => {
  function busy(): Progress {
    let p = defaultProgress()
    p = recordSession(p, result({ patternIds: ['p1', 'p2'] }), '2026-03-10')
    p = recordSession(p, result({ patternIds: ['p1'], side: 'attack', clean: false, missedKeys: ['a', 'b'] }), '2026-03-11')
    return { ...p, settings: { thresholds: { fine: 2, big: 5 }, visits: 200, newPerDay: 3, iosHintDismissed: true } }
  }

  it('round-trips', () => {
    const p = busy()
    expect(importProgress(exportProgress(p))).toEqual(p)
    expect(importProgress(exportProgress(defaultProgress()))).toEqual(defaultProgress())
  })

  it('exports readable JSON text', () => {
    const text = exportProgress(busy())
    expect(typeof text).toBe('string')
    expect(JSON.parse(text).version).toBe(1)
    expect(text).toContain('\n')
  })

  it('round-trips through storage too', () => {
    const p = busy()
    saveProgress(importProgress(exportProgress(p)))
    expect(loadProgress()).toEqual(p)
  })

  it('throws the agreed message for a file that is not a progress file, and leaves storage alone', () => {
    const p = busy()
    saveProgress(p)
    const stored = storage.data.get(STORAGE_KEY)
    storage.setItem.mockClear()
    storage.removeItem.mockClear()
    storage.getItem.mockClear()

    expect(() => importProgress('{"foo":1}')).toThrow(new Error('Not a Go-to-D progress file'))
    expect(() => importProgress('{"foo":1}')).toThrow('Not a Go-to-D progress file')

    expect(storage.data.get(STORAGE_KEY)).toBe(stored)
    expect(storage.setItem).not.toHaveBeenCalled()
    expect(storage.removeItem).not.toHaveBeenCalled()
    expect(loadProgress()).toEqual(p)
  })

  it.each([
    ['empty text', ''],
    ['not JSON', 'hello'],
    ['null', 'null'],
    ['a number', '3'],
    ['a string', '"progress"'],
    ['an array', '[]'],
    ['an empty object', '{}'],
    ['version 2', JSON.stringify({ ...defaultProgress(), version: 2 })],
    ['version as text', JSON.stringify({ ...defaultProgress(), version: '1' })],
    ['no reviews', JSON.stringify({ version: 1, streak: { count: 0, lastDay: null }, settings: defaultProgress().settings })],
    ['reviews as an array', JSON.stringify({ ...defaultProgress(), reviews: [] })],
    ['reviews as null', JSON.stringify({ ...defaultProgress(), reviews: null })],
    ['no streak', JSON.stringify({ version: 1, reviews: {}, settings: defaultProgress().settings })],
    ['no settings', JSON.stringify({ version: 1, reviews: {}, streak: { count: 0, lastDay: null } })],
    ['settings as null', JSON.stringify({ ...defaultProgress(), settings: null })],
    ['streak count as text', JSON.stringify({ ...defaultProgress(), streak: { count: '3', lastDay: null } })],
    ['a bad streak day', JSON.stringify({ ...defaultProgress(), streak: { count: 3, lastDay: 'yesterday' } })],
    ['a review that is not an object', JSON.stringify({ ...defaultProgress(), reviews: { 'a:defend': 5 } })],
    ['a box out of range', JSON.stringify({ ...defaultProgress(), reviews: { 'a:defend': { box: 6, due: '2026-03-10', runs: 1, cleanRuns: 1, missedKeys: [] } } })],
    ['a half box', JSON.stringify({ ...defaultProgress(), reviews: { 'a:defend': { box: 1.5, due: '2026-03-10', runs: 1, cleanRuns: 1, missedKeys: [] } } })],
    ['a bad due day', JSON.stringify({ ...defaultProgress(), reviews: { 'a:defend': { box: 1, due: '2026-02-31', runs: 1, cleanRuns: 1, missedKeys: [] } } })],
    ['negative runs', JSON.stringify({ ...defaultProgress(), reviews: { 'a:defend': { box: 1, due: '2026-03-10', runs: -1, cleanRuns: 1, missedKeys: [] } } })],
    ['missed keys that are not text', JSON.stringify({ ...defaultProgress(), reviews: { 'a:defend': { box: 1, due: '2026-03-10', runs: 1, cleanRuns: 1, missedKeys: [1] } } })],
    ['no missed keys', JSON.stringify({ ...defaultProgress(), reviews: { 'a:defend': { box: 1, due: '2026-03-10', runs: 1, cleanRuns: 1 } } })],
  ])('rejects %s', (_name, text) => {
    expect(() => importProgress(text)).toThrow(new Error('Not a Go-to-D progress file'))
  })

  it('fills settings fields a file does not have', () => {
    const raw = { ...busy(), settings: { newPerDay: 5 } }
    const p = importProgress(JSON.stringify(raw))
    expect(p.settings).toEqual({ ...defaultProgress().settings, newPerDay: 5 })
  })

  it('drops fields it does not know and keeps a review key called __proto__ as plain data', () => {
    const text =
      '{"version":1,"junk":true,"streak":{"count":0,"lastDay":null},"settings":{},' +
      '"reviews":{"__proto__":{"box":2,"due":"2026-03-10","runs":1,"cleanRuns":1,"missedKeys":[],"x":1}}}'
    const p = importProgress(text)
    expect(Object.keys(p).sort()).toEqual(['reviews', 'settings', 'streak', 'version'])
    expect(Object.getPrototypeOf(p.reviews)).toBe(Object.prototype)
    expect(({} as Record<string, unknown>).box).toBeUndefined()
    expect(Object.keys(p.reviews)).toEqual(['__proto__'])
    expect(Object.keys(p.reviews['__proto__'] ?? {}).sort()).toEqual(['box', 'cleanRuns', 'due', 'missedKeys', 'runs'])
  })
})
