// Deadlines that don't count the time the page spends hidden (R41). When the owner switches apps, a phone
// suspends the page and the engine's worker in the middle of a search. A plain setTimeout counts on, fires
// the moment the page comes back, before the worker has had a chance to answer, and the engine was
// stopped for nothing. These deadlines stop while the page is hidden and go on with the time they had
// left once it shows again.

export interface PageVisibility {
  hidden(): boolean
  /** Calls `fn` whenever the page is hidden or shown. Returns the unsubscribe. */
  onChange(fn: () => void): () => void
}

/** The real page. Outside a page (node tests, the worker) it is never hidden and never changes. */
export const pageVisibility: PageVisibility = {
  hidden() {
    try {
      return typeof document !== 'undefined' && document.visibilityState === 'hidden'
    } catch {
      return false
    }
  },
  onChange(fn) {
    if (typeof document === 'undefined') return () => {}
    document.addEventListener('visibilitychange', fn)
    return () => document.removeEventListener('visibilitychange', fn)
  },
}

/** A timer this much later than due means the page was frozen while showing (a phone asleep). */
const FROZEN_MS = 2000

/**
 * Calls `onExpire` once `ms` of time with the page showing has passed. Returns a cancel function (safe
 * to call twice, and after it fired).
 * - While the page is hidden the clock stops. When it shows, the deadline gets the time it had left.
 * - A timer that comes due while the page says it is hidden (the hide went unnoticed) waits for the page
 *   to show and then gives the full `ms` again.
 * - A timer that comes due more than FROZEN_MS late was frozen with the page: it gets the full `ms` once more.
 */
export function deadline(ms: number, onExpire: () => void, vis: PageVisibility = pageVisibility): () => void {
  let left = ms
  let armedAt = 0
  let timer: ReturnType<typeof setTimeout> | null = null
  let over = false
  let extended = false

  const arm = () => {
    if (over || timer !== null || vis.hidden()) return
    armedAt = Date.now()
    timer = setTimeout(fire, left)
  }
  const pause = () => {
    if (timer === null) return
    clearTimeout(timer)
    timer = null
    left = Math.max(0, left - (Date.now() - armedAt))
  }
  const fire = () => {
    timer = null
    if (over) return
    if (vis.hidden()) {
      left = ms
      return
    }
    if (!extended && Date.now() - armedAt - left > FROZEN_MS) {
      extended = true
      left = ms
      arm()
      return
    }
    cancel()
    onExpire()
  }
  const unsubscribe = vis.onChange(() => (vis.hidden() ? pause() : arm()))
  const cancel = () => {
    if (over) return
    over = true
    unsubscribe()
    if (timer !== null) clearTimeout(timer)
    timer = null
  }
  arm()
  return cancel
}
