// Deadlines that stop counting while the page is hidden (R41): a phone suspends the page and the engine's
// worker when the owner switches apps, and a plain timer would fire the moment the page comes back.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { deadline } from '../../src/engine/deadline'
import { FakeVisibility } from './fakeVisibility'

let vis: FakeVisibility
beforeEach(() => {
  vi.useFakeTimers()
  vis = new FakeVisibility()
})
afterEach(() => {
  vi.useRealTimers()
})

describe('deadline', () => {
  it('fires once the time is up on a visible page', () => {
    const done = vi.fn()
    deadline(5000, done, vis)
    vi.advanceTimersByTime(4999)
    expect(done).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(done).toHaveBeenCalledTimes(1)
    vi.advanceTimersByTime(60_000)
    expect(done).toHaveBeenCalledTimes(1)
    expect(vis.listeners).toBe(0)
  })

  it('stops while the page is hidden and goes on with the time it had left', () => {
    const done = vi.fn()
    deadline(5000, done, vis)
    vi.advanceTimersByTime(3000)
    vis.set(true)
    vi.advanceTimersByTime(10 * 60_000)
    expect(done).not.toHaveBeenCalled()
    vis.set(false)
    vi.advanceTimersByTime(1999)
    expect(done).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(done).toHaveBeenCalledTimes(1)
  })

  it('started on a hidden page, waits for it to show', () => {
    const done = vi.fn()
    vis.set(true)
    deadline(1000, done, vis)
    vi.advanceTimersByTime(60_000)
    expect(done).not.toHaveBeenCalled()
    vis.set(false)
    vi.advanceTimersByTime(1000)
    expect(done).toHaveBeenCalledTimes(1)
  })

  it('a timer that fires on a hidden page (the hide went unnoticed) waits, then gives the full time again', () => {
    const done = vi.fn()
    deadline(1000, done, vis)
    vis.set(true, true)
    vi.advanceTimersByTime(1000)
    expect(done).not.toHaveBeenCalled()
    vis.set(false)
    vi.advanceTimersByTime(999)
    expect(done).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(done).toHaveBeenCalledTimes(1)
  })

  it('a timer that fires long after its time (the page was frozen while showing) gets the full time once more', () => {
    const done = vi.fn()
    deadline(1000, done, vis)
    // The phone slept: the clock jumped, the timer comes due late.
    vi.setSystemTime(Date.now() + 5 * 60_000)
    vi.advanceTimersByTime(1000)
    expect(done).not.toHaveBeenCalled()
    vi.setSystemTime(Date.now() + 5 * 60_000)
    vi.advanceTimersByTime(1000)
    expect(done).toHaveBeenCalledTimes(1)
  })

  it('cancel stops it for good', () => {
    const done = vi.fn()
    const cancel = deadline(1000, done, vis)
    cancel()
    vis.set(true)
    vis.set(false)
    vi.advanceTimersByTime(60_000)
    expect(done).not.toHaveBeenCalled()
    expect(vis.listeners).toBe(0)
    cancel()
  })
})
