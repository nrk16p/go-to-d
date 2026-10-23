// Records a finished (or abandoned) session. Progress is loaded fresh at save time, so a session
// finished in a second tab isn't overwritten by this one (R24).

import { loadProgress, recordSession, saveProgress, todayLocal } from '../progress/store'
import type { SessionResult } from '../session/controller'

/** True when the progress was stored; false when this browser wouldn't keep it. */
export function saveSession(r: SessionResult, today: string = todayLocal()): boolean {
  const saved = saveProgress(recordSession(loadProgress(), r, today))
  if (saved) askToKeepStorage()
  return saved
}

let asked = false

/**
 * Once per page load, after progress was saved, asks the browser to keep this site's storage (M8).
 * Where it's granted (Android Chrome, a Home Screen app), progress and the cached network aren't
 * cleared to make room. Nothing happens where the browser has no such request or already keeps it.
 */
function askToKeepStorage(): void {
  if (asked) return
  asked = true
  try {
    const storage = globalThis.navigator?.storage
    if (typeof storage?.persisted !== 'function' || typeof storage.persist !== 'function') return
    storage
      .persisted()
      .then((kept) => (kept ? undefined : storage.persist()))
      .catch(() => {})
  } catch {
    // Not offered here: progress lives on as before.
  }
}
