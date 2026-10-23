// @vitest-environment jsdom
// The Report screen after a reload: the session comes back from sessionStorage, not from memory.

import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { emptyPosition } from '../../src/go/rules'
import { CORNER_REGION } from '../../src/go/coords'
import type { SessionReport } from '../../src/ui/reportStore'

class MemoryStorage {
  private m = new Map<string, string>()
  getItem(k: string) {
    return this.m.get(k) ?? null
  }
  setItem(k: string, v: string) {
    this.m.set(k, String(v))
  }
  removeItem(k: string) {
    this.m.delete(k)
  }
}

const REPORT: SessionReport = {
  result: { patternIds: ['star44-low-jump'], side: 'attack', clean: false, mistakes: 2, pointsLost: 6.3, missedKeys: [] },
  saved: true,
  title: 'Low approach, one-space jump',
  family: 'star44',
  side: 'attack',
  mode: 'drill',
  patternId: 'star44-low-jump',
  board: emptyPosition().board,
  region: CORNER_REGION,
  note: null,
  noteLow: false,
  message: null,
  right: 3,
  unchecked: 1,
}

beforeEach(() => {
  vi.stubGlobal('localStorage', new MemoryStorage())
  vi.stubGlobal('sessionStorage', new MemoryStorage())
  vi.resetModules()
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('Report after a reload', () => {
  it('reads the last session back from sessionStorage', async () => {
    // The first page load stores it…
    const first = await import('../../src/ui/reportStore')
    first.setLastReport(REPORT)
    // …and a reload starts with fresh modules and only sessionStorage.
    vi.resetModules()
    const { Report } = await import('../../src/ui/screens/Report')
    const { COPY } = await import('../../src/ui/copy')
    render(<Report />)
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(COPY.report.mistakes(2))
    expect(screen.getByText(COPY.report.subtitle(REPORT.title, 'attack'))).toBeTruthy()
    expect(screen.getByText('6.3')).toBeTruthy()
    expect(screen.getByText(COPY.report.unchecked)).toBeTruthy()
  })

  it('says there is nothing to report when sessionStorage has nothing usable', async () => {
    sessionStorage.setItem('go-to-d:last-report', '{not json')
    const { Report } = await import('../../src/ui/screens/Report')
    const { COPY } = await import('../../src/ui/copy')
    render(<Report />)
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(COPY.report.none)
  })
})
