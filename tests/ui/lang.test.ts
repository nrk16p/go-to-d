// @vitest-environment jsdom
// The app's language: what was picked before, else the browser's language; a storage that throws
// falls back quietly. Switching saves the choice and reloads.

import { afterEach, describe, expect, it, vi } from 'vitest'
import { currentLang, LANG_KEY, setLang } from '../../src/ui/lang'
import { MemoryStorage } from './memoryStorage'

function storageWith(value?: string): MemoryStorage {
  const s = new MemoryStorage()
  if (value !== undefined) s.setItem(LANG_KEY, value)
  return s
}

const browser = (language: string | undefined) => vi.stubGlobal('navigator', { language })

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('currentLang', () => {
  it('uses the stored choice over the browser language', () => {
    vi.stubGlobal('localStorage', storageWith('th'))
    browser('en-US')
    expect(currentLang()).toBe('th')
    vi.stubGlobal('localStorage', storageWith('en'))
    browser('th-TH')
    expect(currentLang()).toBe('en')
  })

  it('follows the browser language when nothing is stored', () => {
    vi.stubGlobal('localStorage', storageWith())
    browser('th-TH')
    expect(currentLang()).toBe('th')
    browser('th')
    expect(currentLang()).toBe('th')
    browser('TH-th')
    expect(currentLang()).toBe('th')
    browser('en-GB')
    expect(currentLang()).toBe('en')
    browser('ja-JP')
    expect(currentLang()).toBe('en')
    browser(undefined)
    expect(currentLang()).toBe('en')
  })

  it('ignores a stored value that is not a language it knows', () => {
    vi.stubGlobal('localStorage', storageWith('fr'))
    browser('th-TH')
    expect(currentLang()).toBe('th')
    vi.stubGlobal('localStorage', storageWith(''))
    browser('en-US')
    expect(currentLang()).toBe('en')
  })

  it('falls back to the browser language when storage throws', () => {
    const throwing = new MemoryStorage()
    throwing.getItem = () => {
      throw new Error('SecurityError')
    }
    vi.stubGlobal('localStorage', throwing)
    browser('th-TH')
    expect(currentLang()).toBe('th')
  })

  it('falls back when even reaching localStorage throws, or there is no navigator', () => {
    // Safari with site data blocked throws on the localStorage getter itself.
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      get() {
        throw new Error('SecurityError')
      },
    })
    try {
      browser('th-TH')
      expect(currentLang()).toBe('th')
      vi.stubGlobal('navigator', undefined)
      expect(currentLang()).toBe('en')
    } finally {
      vi.stubGlobal('localStorage', storageWith())
    }
  })
})

describe('setLang', () => {
  it('saves the choice, then reloads', () => {
    const s = storageWith('en')
    vi.stubGlobal('localStorage', s)
    const order: string[] = []
    const reload = vi.fn(() => order.push(`reload:${s.getItem(LANG_KEY)}`))
    expect(setLang('th', reload)).toBe(true)
    expect(reload).toHaveBeenCalledOnce()
    expect(order).toEqual(['reload:th'])
  })

  it('does not reload when the choice could not be saved', () => {
    const s = storageWith('en')
    s.failWrites = true
    vi.stubGlobal('localStorage', s)
    const reload = vi.fn()
    expect(setLang('th', reload)).toBe(false)
    expect(reload).not.toHaveBeenCalled()
    expect(s.getItem(LANG_KEY)).toBe('en')
  })
})
