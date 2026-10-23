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
  UNREADABLE_BACKUP_KEY,
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
      settings: {
        thresholds: DEFAULT_THRESHOLDS,
        visits: DEFAULT_VISITS,
        newPerDay: 2,
        newOpeningsPerDay: 1,
        iosHintDismissed: false,
      },
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
    expect(storage.setItem).not.toHaveBeenCalledWith(STORAGE_KEY, expect.anything())
  })

  it.each([
    ['null', 'null'],
    ['a number', '7'],
    ['a string', '"progress"'],
    ['an array', '[]'],
    ['an empty object', '{}'],
    ['another version', JSON.stringify({ ...defaultProgress(), version: 2 })],
    ['no version', JSON.stringify({ reviews: {}, streak: { count: 0, lastDay: null }, settings: defaultProgress().settings })],
    ['no reviews', JSON.stringify({ version: 1, streak: { count: 0, lastDay: null }, settings: defaultProgress().settings })],
    ['reviews as an array', JSON.stringify({ ...defaultProgress(), reviews: [] })],
  ])('returns defaults when the saved text is not a version 1 file (%s)', (_name, text) => {
    storage.data.set(STORAGE_KEY, text)
    expect(loadProgress()).toEqual(defaultProgress())
    expect(storage.data.get(STORAGE_KEY)).toBe(text)
  })

  describe('repair: one bad piece does not cost the rest', () => {
    const good = (box: number, due = '2026-03-12') => ({ box, due, runs: 2, cleanRuns: 1, missedKeys: ['k'] })

    function saved(over: Record<string, unknown>): void {
      const p = recordSession(defaultProgress(), result({ patternIds: ['p1', 'p2'] }), '2026-03-10')
      storage.data.set(STORAGE_KEY, JSON.stringify({ ...p, ...over }))
    }

    it('keeps the good reviews and drops only the bad ones', () => {
      saved({
        reviews: {
          'a:defend': good(2),
          'b:defend': { box: 9, due: '2026-03-12', runs: 1, cleanRuns: 1, missedKeys: [] },
          'c:attack': good(3, '2026-04-01'),
          'd:attack': 'junk',
          'e:attack': { ...good(1), due: '2026-02-31' },
          'f:attack': { ...good(1), missedKeys: [1] },
          'g:attack': null,
        },
      })
      const p = loadProgress()
      expect(Object.keys(p.reviews).sort()).toEqual(['a:defend', 'c:attack'])
      expect(p.reviews['a:defend']).toEqual(good(2))
      expect(p.reviews['c:attack']).toEqual(good(3, '2026-04-01'))
      expect(p.streak).toEqual({ count: 1, lastDay: '2026-03-10' })
    })

    it('keeps a review’s first day, and treats a missing or unreadable one as unknown (R44)', () => {
      saved({
        reviews: {
          'a:defend': { ...good(2), firstDay: '2026-03-01' },
          'b:defend': good(2),
          'c:defend': { ...good(2), firstDay: 'last week' },
        },
      })
      const p = loadProgress()
      expect(p.reviews['a:defend']).toEqual({ ...good(2), firstDay: '2026-03-01' })
      expect(p.reviews['b:defend']).toEqual(good(2))
      expect(p.reviews['c:defend']).toEqual(good(2))
      expect(p.reviews['c:defend']).not.toHaveProperty('firstDay')
    })

    it.each([
      ['a streak of the wrong shape', { count: 'x', lastDay: 3 }],
      ['a streak with a bad day', { count: 4, lastDay: 'yesterday' }],
      ['a negative streak', { count: -1, lastDay: null }],
      ['streak as null', null],
      ['streak as text', 'long'],
    ])('keeps the reviews when it has %s, and the streak starts over', (_name, streak) => {
      saved({ streak })
      const p = loadProgress()
      expect(Object.keys(p.reviews).sort()).toEqual(['p1:defend', 'p2:defend'])
      expect(p.streak).toEqual({ count: 0, lastDay: null })
      expect(p.settings).toEqual(defaultProgress().settings)
    })

    it('keeps the reviews when there is no streak at all', () => {
      saved({ streak: undefined })
      const p = loadProgress()
      expect(Object.keys(p.reviews)).toHaveLength(2)
      expect(p.streak).toEqual({ count: 0, lastDay: null })
    })

    it.each([
      ['missing', undefined],
      ['null', null],
      ['text', 'dark'],
      ['an array', []],
    ])('keeps the reviews and the streak when settings are %s, and settings are the defaults', (_name, settings) => {
      saved({ settings })
      const p = loadProgress()
      expect(Object.keys(p.reviews)).toHaveLength(2)
      expect(p.streak).toEqual({ count: 1, lastDay: '2026-03-10' })
      expect(p.settings).toEqual(defaultProgress().settings)
    })

    it('does not back up a save it could use, and does not write', () => {
      saved({ streak: null })
      loadProgress()
      expect(storage.setItem).not.toHaveBeenCalled()
    })
  })

  describe('text it cannot use is backed up', () => {
    it('copies corrupt text to the backup key once, and leaves the main key untouched', () => {
      storage.data.set(STORAGE_KEY, '{not json')
      expect(loadProgress()).toEqual(defaultProgress())
      expect(storage.data.get(UNREADABLE_BACKUP_KEY)).toBe('{not json')
      expect(storage.data.get(STORAGE_KEY)).toBe('{not json')
      expect(storage.setItem).toHaveBeenCalledTimes(1)
      expect(storage.setItem).toHaveBeenCalledWith(UNREADABLE_BACKUP_KEY, '{not json')
      expect(UNREADABLE_BACKUP_KEY).toBe('go-to-d:progress:unreadable')
    })

    it('copies a save from a newer version, and a later save does not destroy that copy', () => {
      const future = JSON.stringify({ version: 2, reviews: { 'x:defend': { rank: 'gold' } }, streak: 9 })
      storage.data.set(STORAGE_KEY, future)
      const p = loadProgress()
      expect(p).toEqual(defaultProgress())
      expect(storage.data.get(UNREADABLE_BACKUP_KEY)).toBe(future)
      expect(storage.data.get(STORAGE_KEY)).toBe(future) // still untouched until a save
      saveProgress(p)
      expect(storage.data.get(STORAGE_KEY)).not.toBe(future)
      expect(storage.data.get(UNREADABLE_BACKUP_KEY)).toBe(future)
    })

    it('does not replace a backup that is already there', () => {
      storage.data.set(UNREADABLE_BACKUP_KEY, 'first')
      storage.data.set(STORAGE_KEY, 'second')
      loadProgress()
      expect(storage.data.get(UNREADABLE_BACKUP_KEY)).toBe('first')
      expect(storage.setItem).not.toHaveBeenCalled()
    })

    it('does not back up when nothing is saved', () => {
      loadProgress()
      expect(storage.setItem).not.toHaveBeenCalled()
      expect(storage.data.size).toBe(0)
    })

    it('does not back up a good save', () => {
      saveProgress(defaultProgress())
      storage.setItem.mockClear()
      loadProgress()
      expect(storage.setItem).not.toHaveBeenCalled()
    })

    it('still returns defaults when the backup can’t be written', () => {
      storage.data.set(STORAGE_KEY, '{not json')
      storage.setItem.mockImplementation(() => {
        throw new Error('QuotaExceededError')
      })
      expect(loadProgress()).toEqual(defaultProgress())
    })

    it('still returns defaults when reading the backup key throws', () => {
      storage.data.set(STORAGE_KEY, '{not json')
      storage.getItem.mockImplementation((k: string) => {
        if (k === UNREADABLE_BACKUP_KEY) throw new Error('SecurityError')
        return storage.data.get(k) ?? null
      })
      expect(loadProgress()).toEqual(defaultProgress())
    })
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
      settings: {
        thresholds: { fine: 2 },
        visits: 'lots',
        newPerDay: -3,
        newOpeningsPerDay: 1.5,
        iosHintDismissed: 'yes',
        extra: 1,
      },
    }
    storage.data.set(STORAGE_KEY, JSON.stringify(raw))
    const s = loadProgress().settings
    expect(s).toEqual({
      thresholds: { fine: 2, big: DEFAULT_THRESHOLDS.big },
      visits: DEFAULT_VISITS,
      newPerDay: 2,
      newOpeningsPerDay: 1,
      iosHintDismissed: false,
    })
  })

  it('holds settings to the limits the Settings form allows, on load and on import', () => {
    const withSettings = (settings: unknown) => JSON.stringify({ ...defaultProgress(), settings })
    const d = defaultProgress().settings

    storage.data.set(STORAGE_KEY, withSettings({ visits: 5000, newPerDay: 50, newOpeningsPerDay: 9 }))
    expect(loadProgress().settings).toMatchObject({ visits: 400, newPerDay: 10, newOpeningsPerDay: 3 })
    // A save from before openings existed gets the default: one new opening a day (R46).
    expect(importProgress(withSettings({ newPerDay: 4 })).settings.newOpeningsPerDay).toBe(1)
    expect(importProgress(withSettings({ newOpeningsPerDay: 0 })).settings.newOpeningsPerDay).toBe(0)
    expect(importProgress(withSettings({ visits: 3 })).settings.visits).toBe(16)
    expect(importProgress(withSettings({ visits: 16.5 })).settings.visits).toBe(d.visits)

    // fine must stay below big; otherwise the pair goes back to the defaults.
    expect(importProgress(withSettings({ thresholds: { fine: 5, big: 3 } })).settings.thresholds).toEqual(d.thresholds)
    expect(importProgress(withSettings({ thresholds: { fine: 4, big: 4 } })).settings.thresholds).toEqual(d.thresholds)
    expect(importProgress(withSettings({ thresholds: { fine: 6 } })).settings.thresholds).toEqual(d.thresholds)
    expect(importProgress(withSettings({ thresholds: { fine: 0.5, big: 2 } })).settings.thresholds).toEqual({ fine: 0.5, big: 2 })
  })

  it('does not touch the stored text', () => {
    saveProgress(defaultProgress())
    storage.setItem.mockClear()
    loadProgress()
    expect(storage.setItem).not.toHaveBeenCalled()
  })
})

describe('saveProgress', () => {
  it('returns false and does not throw when setItem throws (quota, private window)', () => {
    storage.setItem.mockImplementation(() => {
      throw new Error('QuotaExceededError')
    })
    let ok: boolean | undefined
    expect(() => {
      ok = saveProgress(defaultProgress())
    }).not.toThrow()
    expect(ok).toBe(false)
  })

  it('returns false without localStorage', () => {
    vi.stubGlobal('localStorage', undefined)
    expect(saveProgress(defaultProgress())).toBe(false)
  })

  it('returns false when even reading the localStorage property throws', () => {
    const before = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')!
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      get() {
        throw new Error('SecurityError')
      },
    })
    try {
      expect(saveProgress(defaultProgress())).toBe(false)
    } finally {
      Object.defineProperty(globalThis, 'localStorage', before)
    }
  })

  it('writes JSON under the storage key and returns true', () => {
    const p = defaultProgress()
    expect(saveProgress(p)).toBe(true)
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
      firstDay: day1,
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

    it('counts a last day after today as today, so the streak is not frozen', () => {
      let p = recordSession(defaultProgress(), result(), day1)
      p = recordSession(p, result(), '2026-03-11')
      p = recordSession(p, result(), day1) // the clock went back a day
      expect(p.streak).toEqual({ count: 2, lastDay: day1 })
      p = recordSession(p, result(), '2026-03-11')
      expect(p.streak).toEqual({ count: 3, lastDay: '2026-03-11' })
    })

    it('recovers from a last day far in the future', () => {
      let p = recordSession(defaultProgress(), result(), '2031-01-01')
      p = recordSession(p, result(), day1)
      expect(p.streak).toEqual({ count: 1, lastDay: day1 })
      p = recordSession(p, result(), '2026-03-11')
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
    return {
      ...p,
      settings: { thresholds: { fine: 2, big: 5 }, visits: 200, newPerDay: 3, newOpeningsPerDay: 2, iosHintDismissed: true },
    }
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
    ['a different file', '{"name":"notes","items":[1,2]}'],
    ['version 2', JSON.stringify({ ...defaultProgress(), version: 2 })],
    ['version as text', JSON.stringify({ ...defaultProgress(), version: '1' })],
    ['no version', JSON.stringify({ reviews: {}, streak: { count: 0, lastDay: null }, settings: defaultProgress().settings })],
    ['no reviews', JSON.stringify({ version: 1, streak: { count: 0, lastDay: null }, settings: defaultProgress().settings })],
    ['reviews as an array', JSON.stringify({ ...defaultProgress(), reviews: [] })],
    ['reviews as null', JSON.stringify({ ...defaultProgress(), reviews: null })],
  ])('rejects %s', (_name, text) => {
    expect(() => importProgress(text)).toThrow(new Error('Not a Go-to-D progress file'))
  })

  describe('a Go-to-D file with odd pieces is repaired, not rejected', () => {
    const odd = { box: 9, due: '2026-03-12', runs: 1, cleanRuns: 1, missedKeys: [] }

    it('restores an export that has one odd record', () => {
      const p = busy()
      const exported = JSON.parse(exportProgress(p))
      exported.reviews['odd:defend'] = odd
      const restored = importProgress(JSON.stringify(exported))
      expect(restored).toEqual(p)
    })

    it('keeps the reviews of a file with a bad streak or settings', () => {
      const p = busy()
      const exported = JSON.parse(exportProgress(p))
      const restored = importProgress(JSON.stringify({ ...exported, streak: 'x', settings: null }))
      expect(restored.reviews).toEqual(p.reviews)
      expect(restored.streak).toEqual({ count: 0, lastDay: null })
      expect(restored.settings).toEqual(defaultProgress().settings)
    })

    it('keeps the reviews of a file with no streak and no settings', () => {
      const p = busy()
      const restored = importProgress(JSON.stringify({ version: 1, reviews: p.reviews }))
      expect(restored.reviews).toEqual(p.reviews)
      expect(restored.streak).toEqual({ count: 0, lastDay: null })
      expect(restored.settings).toEqual(defaultProgress().settings)
    })

    it('does not touch storage while repairing', () => {
      saveProgress(busy())
      storage.setItem.mockClear()
      importProgress(JSON.stringify({ version: 1, reviews: { 'odd:defend': odd } }))
      expect(storage.setItem).not.toHaveBeenCalled()
      expect(storage.removeItem).not.toHaveBeenCalled()
    })
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
