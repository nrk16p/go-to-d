// @vitest-environment jsdom
// Every place an opening shows the owner's side says the colour, never a corner (R46, review Important 3).

import { cleanup } from '@testing-library/react'
import { afterEach, beforeEach, describe, it, vi } from 'vitest'
import { MemoryStorage } from './memoryStorage'
import { checkOpeningSeats } from './openingSeats'

vi.mock('../../src/ui/lang', async (original) => ({ ...(await original<typeof import('../../src/ui/lang')>()), currentLang: () => 'en' }))

beforeEach(() => {
  vi.stubGlobal('localStorage', new MemoryStorage())
  vi.stubGlobal('sessionStorage', new MemoryStorage())
  Object.defineProperty(window, 'matchMedia', { configurable: true, value: () => ({ matches: true }) })
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  delete (window as { matchMedia?: unknown }).matchMedia
})

describe('openings name sides by colour (English)', () => {
  // Renders every opening on five screens; under a full parallel run that takes longer than the default 5 s.
  it('on the watch screen, the drill, the Pattern page, the Library and Today', async () => {
    await checkOpeningSeats(/corner|defend|attack/i)
  }, 30_000)
})
