// Which language the app speaks (R38). Picked once when the page loads: what the owner chose before,
// else the browser's own language. Switching saves the choice and reloads, so every module that read
// the language at start (the copy, the book text) reads it again.

export type Lang = 'en' | 'th'

export const LANG_KEY = 'go-to-d:lang'

const isLang = (v: unknown): v is Lang => v === 'en' || v === 'th'

/** Each language's name in its own words, for the switch: a Thai reader finds "ไทย" on an English page. */
export const LANG_NAME: Record<Lang, string> = { en: 'English', th: 'ไทย' }

/** The header switch's short label for each language. */
export const LANG_SHORT: Record<Lang, string> = { en: 'EN', th: 'ไทย' }

/** What the switch does, said in the language it switches to. */
export const SWITCH_TO: Record<Lang, string> = { en: 'Switch to English', th: 'เปลี่ยนเป็นภาษาไทย' }

export function currentLang(): Lang {
  try {
    // Only a page has a saved choice. Outside one (vitest's node tests, the e2e runner) Node 25 has a
    // localStorage of its own that warns when it is touched without a file, so it is left alone.
    const stored = typeof document === 'undefined' ? null : localStorage.getItem(LANG_KEY)
    if (isLang(stored)) return stored
  } catch {
    // No storage (blocked, private window): go by the browser.
  }
  try {
    const browser = typeof navigator === 'undefined' ? undefined : navigator?.language
    return typeof browser === 'string' && browser.toLowerCase().startsWith('th') ? 'th' : 'en'
  } catch {
    return 'en'
  }
}

/**
 * Saves `lang` and reloads the page in it. Returns false, and stays put, when the browser won't keep
 * the choice: a reload would only come back in the old language.
 */
export function setLang(lang: Lang, reload: () => void = () => location.reload()): boolean {
  try {
    localStorage.setItem(LANG_KEY, lang)
  } catch {
    return false
  }
  reload()
  return true
}
