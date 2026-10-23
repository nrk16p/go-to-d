// @vitest-environment jsdom
// The Report screen after a reload: the session comes back from sessionStorage, not from memory.

import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { emptyPosition } from '../../src/go/rules'
import { CORNER_REGION } from '../../src/go/coords'
import type { Progress, ReviewState } from '../../src/progress/srs'
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

  it('names an opening’s side by colour, in the subtitle and in the due list (R46)', async () => {
    const { BOOK } = await import('../../src/book/data')
    const { defaultProgress, STORAGE_KEY, todayLocal } = await import('../../src/progress/store')
    const { BOARD_REGION } = await import('../../src/go/coords')
    const even = BOOK.families['open-even'].def.patterns[0]
    const p = defaultProgress()
    p.reviews[`${even.id}:attack`] = { box: 1, due: todayLocal(), runs: 1, cleanRuns: 0, missedKeys: [] }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(p))
    const store = await import('../../src/ui/reportStore')
    store.setLastReport({
      ...REPORT,
      result: { ...REPORT.result, patternIds: [even.id], side: 'defend' },
      title: even.name,
      family: 'open-even',
      side: 'defend',
      patternId: even.id,
      region: BOARD_REGION,
    })
    const { Report } = await import('../../src/ui/screens/Report')
    const { COPY } = await import('../../src/ui/copy')
    render(<Report />)
    expect(screen.getByText(COPY.report.subtitleColor(even.name, 'black'))).toBeTruthy()
    expect(screen.getByText(COPY.report.dueColor('white'))).toBeTruthy()
    expect(document.querySelectorAll('.report-board [data-x]')).toHaveLength(361)
  })

  it('lists what is due exactly as Today does (M4): a side the book doesn’t drill is left out', async () => {
    const { BOOK } = await import('../../src/book/data')
    const { dueItems } = await import('../../src/progress/course')
    const { defaultProgress, STORAGE_KEY, todayLocal } = await import('../../src/progress/store')
    const { drillableSides } = await import('../../src/session/sides')
    const today = todayLocal()
    // A pattern with a trick on its main line is drilled from one side only (R14).
    const oneSided = Object.keys(BOOK.patterns).find((id) => drillableSides(BOOK, id).length === 1)!
    const undrilled = drillableSides(BOOK, oneSided)[0] === 'defend' ? 'attack' : 'defend'
    const due: ReviewState = { box: 1, due: today, runs: 1, cleanRuns: 0, missedKeys: [] }
    const progress: Progress = {
      ...defaultProgress(),
      reviews: { 'star44-low-jump:defend': due, [`${oneSided}:${undrilled}`]: due, 'gone-pattern:defend': due },
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(progress))
    const first = await import('../../src/ui/reportStore')
    first.setLastReport(REPORT)
    const { Report } = await import('../../src/ui/screens/Report')
    const { COPY } = await import('../../src/ui/copy')
    render(<Report />)
    const list = screen.getByRole('region', { name: COPY.report.dueTitle })
    const links = [...list.querySelectorAll('a')].map((a) => new URLSearchParams(a.getAttribute('href')!.split('?')[1]))
    expect(links.map((q) => `${q.get('pattern')}:${q.get('side')}`)).toEqual(dueItems(BOOK, progress, today).map((i) => i.key))
    expect(links.map((q) => q.get('pattern'))).toEqual(['star44-low-jump'])
  })

  it('says there is nothing to report when sessionStorage has nothing usable', async () => {
    sessionStorage.setItem('go-to-d:last-report', '{not json')
    const { Report } = await import('../../src/ui/screens/Report')
    const { COPY } = await import('../../src/ui/copy')
    render(<Report />)
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(COPY.report.none)
  })
})
