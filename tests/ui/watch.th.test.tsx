// @vitest-environment jsdom
// The watch phase in Thai (R38, R45): the page loaded in Thai shows the Thai notes, with their points
// turned for the board, and the Thai words for its buttons.

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { BOOK as ENGLISH } from '../../src/book/data'
import { TH } from '../../src/book/th'
import { toGtp, transform, type Sym } from '../../src/go/coords'
import { orientNote } from '../../src/session/orient'
import { COPY } from '../../src/ui/copy'
import { COPY as TH_COPY } from '../../src/ui/copy.th'
import { Watch } from '../../src/ui/screens/Watch'
import { MemoryStorage } from './memoryStorage'

// This page load speaks Thai, whatever the machine running the tests speaks.
vi.mock('../../src/ui/lang', async (original) => ({ ...(await original<typeof import('../../src/ui/lang')>()), currentLang: () => 'th' }))

const ID = 'invade33-hane-hane'
const PATH = ENGLISH.patterns[ID].path
const THAI = /[฀-๿]/

beforeEach(() => {
  vi.stubGlobal('localStorage', new MemoryStorage())
  Object.defineProperty(window, 'matchMedia', { configurable: true, value: () => ({ matches: true }) })
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  delete (window as { matchMedia?: unknown }).matchMedia
})

describe('the watch phase in Thai', () => {
  it('shows each move with its Thai note, points turned for the board', () => {
    expect(COPY).toBe(TH_COPY)
    const sym: Sym = 3
    render(<Watch params={{ family: 'invade33', pattern: ID, side: 'defend', sym: String(sym), seed: '4', phase: 'watch' }} />)
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(TH.invade33.names[ID])
    expect(screen.getByRole('link', { name: 'ลองเล่นเอง' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'เล่นอัตโนมัติ' })).toBeTruthy()

    const next = screen.getByRole('button', { name: TH_COPY.pattern.next })
    for (const node of PATH) {
      fireEvent.click(next)
      const text = document.querySelector('.step')?.textContent ?? ''
      const thai = TH.invade33.notes[node.key]
      expect(text).toContain(orientNote(thai, sym))
      expect(text).toMatch(THAI)
      expect(text).not.toContain(orientNote(node.note, sym))
      const at = node.move!.at
      if (at !== 'tenuki') expect(text).toContain(TH_COPY.pattern.move(node.move!.color, toGtp(transform(at, sym))))
    }
  })
})
