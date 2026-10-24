// @vitest-environment jsdom
// R51: the Report's "Your mistakes": order, the line under each board, the practice link, and reports
// stored before R51.

import { cleanup, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CORNER_REGION, parseGtp, type Pt } from '../../src/go/coords'
import { emptyPosition } from '../../src/go/rules'
import type { MistakeRecord } from '../../src/session/controller'
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

const g = (s: string): Pt => parseGtp(s)

function mistake(over: Partial<MistakeRecord>): MistakeRecord {
  return {
    moveNumber: 2,
    before: emptyPosition().board,
    region: CORNER_REGION,
    played: g('S17'),
    tenuki: false,
    better: g('R17'),
    pointsLost: 4.8,
    note: 'Too low.',
    sym: 0,
    practice: { family: 'star44', patternId: 'star44-low-knight-slide', from: 3 },
    ...over,
  }
}

const BASE: SessionReport = {
  result: { patternIds: ['star44-low-knight-slide'], side: 'defend', clean: false, mistakes: 3, pointsLost: 11, missedKeys: [] },
  saved: true,
  title: 'Low approach',
  family: 'star44',
  side: 'defend',
  mode: 'drill',
  patternId: 'star44-low-knight-slide',
  board: emptyPosition().board,
  region: CORNER_REGION,
  note: null,
  noteLow: false,
  message: null,
  right: 3,
  unchecked: 0,
  seed: 7,
  mistakes: [
    mistake({ moveNumber: 2, pointsLost: 1.7, practice: null, note: null }),
    mistake({ moveNumber: 6, pointsLost: null, better: null }),
    mistake({ moveNumber: 4, pointsLost: 4.8, sym: 5 }),
  ],
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

describe('reviewList (R51)', () => {
  it('puts the biggest loss first, unknown losses last, ties in the order played', async () => {
    const { reviewList } = await import('../../src/ui/reportStore')
    const list = reviewList({
      mistakes: [
        mistake({ moveNumber: 8, pointsLost: null }),
        mistake({ moveNumber: 2, pointsLost: 1.7 }),
        mistake({ moveNumber: 6, pointsLost: 4.8 }),
        mistake({ moveNumber: 4, pointsLost: 4.8 }),
        mistake({ moveNumber: 3, pointsLost: null }),
        mistake({ moveNumber: 10, pointsLost: 9 }),
      ],
    })
    expect(list.map((m) => m.moveNumber)).toEqual([10, 4, 6, 2, 3, 8])
  })

  it('is empty for a report stored before R51, and leaves out records it cannot draw', async () => {
    const { reviewList } = await import('../../src/ui/reportStore')
    expect(reviewList({})).toEqual([])
    expect(reviewList({ mistakes: 'nope' as unknown as MistakeRecord[] })).toEqual([])
    const bad = [null, { moveNumber: 3 }, { ...mistake({}), before: [] }] as unknown as MistakeRecord[]
    expect(reviewList({ mistakes: [...bad, mistake({ moveNumber: 5 })] }).map((m) => m.moveNumber)).toEqual([5])
  })
})

describe('Report: Your mistakes (R51)', () => {
  async function show(report: SessionReport) {
    const store = await import('../../src/ui/reportStore')
    store.setLastReport(report)
    vi.resetModules()
    const { Report } = await import('../../src/ui/screens/Report')
    const { COPY } = await import('../../src/ui/copy')
    render(<Report />)
    return COPY
  }

  it('lists each mistake biggest loss first, with a tip, the line, the note and the board marks', async () => {
    const COPY = await show(BASE)
    const R = COPY.report
    const section = screen.getByRole('region', { name: R.reviewTitle })
    expect(within(section).getByText(R.reviewTip(4))).toBeTruthy()

    const items = section.querySelectorAll('.review-item')
    expect([...items].map((li) => li.getAttribute('data-move'))).toEqual(['4', '2', '6'])

    const first = items[0] as HTMLElement
    expect(first.querySelector('.review-line')?.textContent).toBe(`${R.reviewPlayed('S17', false, 4.8)} ${R.reviewBest('R17')}`)
    expect(first.querySelector('.review-line')?.textContent).toBe('You played S17 and lost about 4.8 points. Best was R17.')
    expect(within(first).getByText('Too low.')).toBeTruthy()
    const s17 = g('S17')
    const r17 = g('R17')
    expect(first.querySelector(`[data-marker="mistake"][data-at="${s17.x},${s17.y}"]`)).not.toBeNull()
    expect(first.querySelector(`[data-marker="better"][data-at="${r17.x},${r17.y}"]`)).not.toBeNull()
    expect(within(first).getByRole('img', { name: R.reviewBoard(4) })).toBeTruthy()
  })

  it('leaves the best move out when there is none, and says when the loss is unknown', async () => {
    const COPY = await show(BASE)
    const last = document.querySelector('.review-item[data-move="6"]') as HTMLElement
    expect(last.querySelector('.review-line')?.textContent).toBe(COPY.report.reviewPlayed('S17', false, null))
    expect(last.querySelector('[data-marker="better"]')).toBeNull()
    expect(last.querySelector('[data-marker="mistake"]')).not.toBeNull()
  })

  it('names a tenuki and a best move elsewhere', async () => {
    const COPY = await show({
      ...BASE,
      mistakes: [mistake({ tenuki: true, played: g('K10'), better: 'tenuki', pointsLost: 2 }), mistake({ moveNumber: 3, better: g('D4'), pointsLost: 1 })],
    })
    const R = COPY.report
    const lines = [...document.querySelectorAll('.review-line')].map((p) => p.textContent)
    expect(lines).toEqual([`${R.reviewPlayed('K10', true, 2)} ${R.reviewBestElsewhere}`, `${R.reviewPlayed('S17', false, 1)} ${R.reviewBestElsewhereAt('D4')}`])
  })

  it('has no tip when the biggest loss is unknown', async () => {
    const COPY = await show({ ...BASE, mistakes: [mistake({ pointsLost: null })] })
    expect(screen.getByRole('region', { name: COPY.report.reviewTitle })).toBeTruthy()
    expect(document.querySelector('.review-tip')).toBeNull()
  })

  it('links Practise this move again to the same pattern, side, sym and seed, from the move; none off the book', async () => {
    const COPY = await show(BASE)
    const links = screen.getAllByRole('link', { name: COPY.report.practise })
    // Move 2 has no practice start.
    expect(links).toHaveLength(2)
    const first = document.querySelector('.review-item[data-move="4"] a') as HTMLAnchorElement
    expect(first.getAttribute('href')).toBe('#/spar?family=star44&pattern=star44-low-knight-slide&side=defend&sym=5&seed=7&from=3')
    expect(document.querySelector('.review-item[data-move="2"] a')).toBeNull()
  })

  it('a report stored before R51 still shows, with no review', async () => {
    const old = { ...BASE } as Partial<SessionReport>
    delete old.mistakes
    delete old.seed
    const COPY = await show(old as SessionReport)
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(COPY.report.mistakes(3))
    expect(screen.queryByRole('region', { name: COPY.report.reviewTitle })).toBeNull()
    expect(screen.getByText(COPY.report.dueTitle)).toBeTruthy()
  })

  it('a report from sessionStorage keeps its mistakes after a reload', async () => {
    const COPY = await show(BASE)
    expect(document.querySelectorAll('.review-item')).toHaveLength(3)
    expect(screen.getByText(COPY.report.reviewTitle)).toBeTruthy()
  })

  it('a practice run says it changed nothing, not that saving failed', async () => {
    const COPY = await show({ ...BASE, saved: false, practice: true })
    expect(screen.getByText(COPY.report.practiceRun)).toBeTruthy()
    expect(screen.queryByText(COPY.spar.saveFailed)).toBeNull()
  })
})
