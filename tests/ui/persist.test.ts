// After the first saved session the app asks the browser, once, to keep its storage (M8): a granted
// request keeps progress and the cached network from being cleared to make room.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { SessionResult } from '../../src/session/controller'
import { MemoryStorage } from './memoryStorage'

const RESULT: SessionResult = { patternIds: ['star44-low-jump'], side: 'defend', clean: true, mistakes: 0, pointsLost: 0, missedKeys: [] }

beforeEach(() => {
  vi.resetModules()
  vi.stubGlobal('localStorage', new MemoryStorage())
})

afterEach(() => {
  vi.unstubAllGlobals()
})

function storageApi(persisted: boolean) {
  const api = { persisted: vi.fn(async () => persisted), persist: vi.fn(async () => true) }
  vi.stubGlobal('navigator', { storage: api })
  return api
}

describe('asking to keep storage', () => {
  it('asks once, after a session is saved, and only if the browser isn’t keeping it already', async () => {
    const api = storageApi(false)
    const { saveSession } = await import('../../src/ui/saveSession')
    expect(api.persist).not.toHaveBeenCalled()
    expect(saveSession(RESULT, '2026-10-23')).toBe(true)
    expect(saveSession(RESULT, '2026-10-24')).toBe(true)
    await vi.waitFor(() => expect(api.persist).toHaveBeenCalledTimes(1))
    expect(api.persisted).toHaveBeenCalledTimes(1)
  })

  it('doesn’t ask when the storage is already kept', async () => {
    const api = storageApi(true)
    const { saveSession } = await import('../../src/ui/saveSession')
    saveSession(RESULT, '2026-10-23')
    await vi.waitFor(() => expect(api.persisted).toHaveBeenCalled())
    expect(api.persist).not.toHaveBeenCalled()
  })

  it('is quiet where the browser has no such thing, or it throws', async () => {
    vi.stubGlobal('navigator', {})
    const { saveSession } = await import('../../src/ui/saveSession')
    expect(saveSession(RESULT, '2026-10-23')).toBe(true)

    vi.resetModules()
    vi.stubGlobal('navigator', { storage: { persisted: () => Promise.reject(new Error('no')), persist: vi.fn() } })
    const again = await import('../../src/ui/saveSession')
    expect(again.saveSession(RESULT, '2026-10-23')).toBe(true)
  })
})
