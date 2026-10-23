// @vitest-environment jsdom
// Every place an opening shows the owner's side says the colour, never a corner (R46, review Important 3).

import { cleanup } from '@testing-library/react'
import { afterEach, beforeEach, describe, it, vi } from 'vitest'
import { MemoryStorage } from './memoryStorage'
import { checkOpeningSeats } from './openingSeats'

vi.mock('../../src/ui/lang', async (original) => ({ ...(await original<typeof import('../../src/ui/lang')>()), currentLang: () => 'th' }))

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

describe('openings name sides by colour (Thai)', () => {
  it('on the watch screen, the drill, the Pattern page, the Library and Today', async () => {
    await checkOpeningSeats(/มุม|ฝ่ายรับ|ฝ่ายบุก|คุณ/)
  })
})
