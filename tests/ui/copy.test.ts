// @vitest-environment jsdom
// The Thai UI text has the same shape as the English (the type check holds most of it; this catches
// the rest), its counts read right with no plural forms and plain digits, and copy.ts hands out the
// language picked when the app loaded.

import { afterEach, describe, expect, it, vi } from 'vitest'
import * as EN from '../../src/ui/copy.en'
import * as TH from '../../src/ui/copy.th'
import { LANG_KEY } from '../../src/ui/lang'
import { MemoryStorage } from './memoryStorage'

type Shape = string | { [k: string]: Shape }

function shape(v: unknown): Shape {
  if (v !== null && typeof v === 'object') {
    return Object.fromEntries(
      Object.keys(v)
        .sort()
        .map((k) => [k, shape((v as Record<string, unknown>)[k])]),
    )
  }
  return typeof v
}

/** Sample arguments for every function in COPY, by its path. A new function needs a line here. */
const SAMPLES: Record<string, unknown[][]> = {
  'board.point': [['Q16']],
  'spar.freeTitle': [['จุดดาว 4-4']],
  'spar.youAre': [
    ['black', 'defend'],
    ['white', 'attack'],
  ],
  'spar.tapAgain': [['R14']],
  'spar.playPoint': [['R14']],
  'spar.elsewhere': [['D4']],
  'spar.movesSoFar': [[0], [7]],
  'spar.unknownPattern': [['x-1']],
  'verdict.fineCost': [[0], [0.5], [1]],
  'verdict.bookPlays': [['O17']],
  'verdict.better': [
    ['R17', null],
    ['R17', 1],
    ['R17', 2.46],
  ],
  'verdict.betterElsewhere': [[null], [3]],
  'verdict.betterElsewhereAt': [
    ['D10', null],
    ['D10', 5],
  ],
  'verdict.costOnly': [[1], [4.5]],
  'verdict.otherJosekiOne': [['ฮาเนะ แล้วกัน']],
  'verdict.switchTo': [['ฮาเนะ แล้วกัน']],
  'report.mistakes': [[1], [3]],
  'report.nextIn': [[2], [12]],
  'report.countedFor': [['ฮาเนะ แล้วกัน']],
  'report.side': [['defend'], ['attack']],
  'report.subtitle': [
    ['ฮาเนะ แล้วกัน', 'defend'],
    ['ฮาเนะ แล้วกัน', 'attack'],
  ],
  'report.dueSide': [['defend'], ['attack']],
  'today.lead': [
    [0, 0],
    [1, 0],
    [3, 0],
    [0, 1],
    [0, 2],
    [3, 2],
  ],
  'today.masteredValue': [[0, 186]],
  level: [
    [0, false],
    [2, false],
    [5, true],
  ],
  sideName: [['defend'], ['attack']],
  'library.lead': [[94]],
  'library.sideShort': [['defend'], ['attack']],
  'pattern.step': [[3, 7]],
  'pattern.move': [
    ['black', 'Q16'],
    ['white', 'R14'],
  ],
  'pattern.elsewhere': [['black'], ['white']],
  'pattern.meta': [
    ['จุดดาว 4-4', 1],
    ['จุดดาว 4-4', 2],
    ['จุดดาว 4-4', 3],
  ],
  'pattern.drill': [
    ['defend', 'black'],
    ['attack', 'white'],
  ],
  'watch.lead': [
    ['black', 'defend'],
    ['white', 'attack'],
  ],
  'settings.backendName': [['webgpu'], ['wasm'], ['cpu'], ['webgl']],
  'settings.importConfirm': [
    [0, 0],
    [1, 0],
    [0, 4],
    [12, 3],
  ],
  'settings.imported': [[0], [1], [9]],
  'settings.importBad': [['Not a Go-to-D progress file']],
  'settings.resetConfirm': [[0], [1], [9]],
}

/** Every function in an object, by its dotted path. */
function functions(v: unknown, path = ''): Array<[string, (...a: unknown[]) => unknown]> {
  if (typeof v === 'function') return [[path, v as (...a: unknown[]) => unknown]]
  if (v === null || typeof v !== 'object') return []
  return Object.entries(v).flatMap(([k, child]) => functions(child, path ? `${path}.${k}` : k))
}

/** Every string Thai copy can show: the plain strings, and each function's output for its samples. */
function thaiOutputs(): Array<[string, string]> {
  const out: Array<[string, string]> = []
  const strings = (v: unknown, path: string) => {
    if (typeof v === 'string') out.push([path, v])
    else if (v && typeof v === 'object') for (const [k, c] of Object.entries(v)) strings(c, path ? `${path}.${k}` : k)
  }
  strings(TH.COPY, '')
  strings(TH.SESSION_MESSAGES, 'session')
  for (const [path, fn] of functions(TH.COPY)) {
    for (const args of SAMPLES[path] ?? []) out.push([`${path}(${args.join(', ')})`, String(fn(...args))])
  }
  return out
}

describe('Thai copy', () => {
  it('has the same keys as the English, with a function wherever English has one', () => {
    expect(shape(TH.COPY)).toEqual(shape(EN.COPY))
    expect(shape(TH.SESSION_MESSAGES)).toEqual(shape(EN.SESSION_MESSAGES))
  })

  it('cannot leave a key out: the type check fails', () => {
    const missing: EN.Copy = {
      ...TH.COPY,
      // @ts-expect-error: a Thai notFound without its body is not a Copy
      notFound: { title: 'ไม่มีหน้านี้' },
    }
    expect(missing.notFound.title).toBe('ไม่มีหน้านี้')
  })

  it('has samples for every function, so every output below gets checked', () => {
    expect(functions(EN.COPY).map(([p]) => p).filter((p) => !SAMPLES[p])).toEqual([])
  })

  it('says points with plain digits and no plural', () => {
    expect(TH.points(1)).toBe('1 แต้ม')
    expect(TH.points(3)).toBe('3 แต้ม')
    expect(TH.points(0.5)).toBe('0.5 แต้ม')
    expect(TH.points(2.46)).toBe('2.5 แต้ม')
    expect(TH.COPY.verdict.better('R17', null)).toBe('R17 ดีกว่า')
    expect(TH.COPY.verdict.better('R17', 2.46)).toBe('R17 ดีกว่าราว 2.5 แต้ม')
    expect(TH.COPY.report.mistakes(3)).toContain('3')
    expect(TH.COPY.today.lead(3, 2)).toContain('3')
    expect(TH.COPY.today.lead(3, 2)).toContain('2')
  })

  it('reads cleanly for every sample: no Thai digits, no leftovers, no English words', () => {
    const bad: string[] = []
    for (const [where, text] of thaiOutputs()) {
      if (/[๐-๙]/.test(text)) bad.push(`${where}: Thai digits in "${text}"`)
      if (/undefined|NaN|null|\[object|\$\{/.test(text)) bad.push(`${where}: leftover in "${text}"`)
      // Latin letters are fine for board points, the app's name and a few names of things (Safari, LINE, WebGPU).
      const words = text.replace(/Go-to-D|Safari|LINE|iPhone|Enter|WebGPU|WebAssembly|visits?|webgl|Not a Go-to-D progress file/g, '')
      const english = words.match(/\b[a-z]{2,}\b/gi)?.filter((w) => !/^[A-HJ-T]\d{1,2}$/.test(w))
      if (english?.length) bad.push(`${where}: English in "${text}"`)
    }
    expect(bad).toEqual([])
  })
})

describe('copy.ts', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.resetModules()
  })

  async function load(stored: string | null, language: string) {
    const s = new MemoryStorage()
    if (stored !== null) s.setItem(LANG_KEY, stored)
    vi.stubGlobal('localStorage', s)
    vi.stubGlobal('navigator', { language })
    vi.resetModules()
    const copy = await import('../../src/ui/copy')
    const messages = await import('../../src/session/messages')
    const th = await import('../../src/ui/copy.th')
    const en = await import('../../src/ui/copy.en')
    return { copy, messages, th, en }
  }

  it('hands out Thai when Thai was picked, session messages too', async () => {
    const { copy, messages, th } = await load('th', 'en-US')
    expect(copy.LANG).toBe('th')
    expect(copy.COPY).toBe(th.COPY)
    expect(copy.SESSION_MESSAGES).toBe(th.SESSION_MESSAGES)
    expect(messages.MESSAGES).toBe(th.SESSION_MESSAGES)
    expect(copy.points(2)).toBe('2 แต้ม')
  })

  it('hands out English otherwise', async () => {
    const { copy, messages, en } = await load(null, 'en-US')
    expect(copy.LANG).toBe('en')
    expect(copy.COPY).toBe(en.COPY)
    expect(messages.MESSAGES).toBe(en.SESSION_MESSAGES)
    expect(copy.points(2)).toBe('2 points')
  })

  it('follows a Thai browser on the first visit', async () => {
    const { copy, th } = await load(null, 'th-TH')
    expect(copy.COPY).toBe(th.COPY)
  })
})
