// @vitest-environment jsdom
// The Today screen on a progress fixture: due reviews first, then exactly newPerDay new ones in course
// order (R32), the mastered count over every drillable side, the streak, and the iOS install hint.

import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { BOOK } from '../../src/book/data'
import { courseOrder } from '../../src/progress/course'
import type { Progress, ReviewState } from '../../src/progress/srs'
import { defaultProgress, loadProgress, STORAGE_KEY } from '../../src/progress/store'
import { drillableSides } from '../../src/session/sides'
import { COPY } from '../../src/ui/copy'
import { sparHref } from '../../src/ui/router'
import { Today } from '../../src/ui/screens/Today'
import { MemoryStorage } from './memoryStorage'

const TODAY = '2026-10-22'
/** Every pattern × drillable side in the book (it grows; one trick pattern has one side). */
const TOTAL = Object.keys(BOOK.patterns).reduce((n, id) => n + drillableSides(BOOK, id).length, 0)
const IPHONE =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Mobile/15E148 Safari/604.1'
const IPHONE_LINE = `${IPHONE} Line/14.16.0`
const IPAD_DESKTOP =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Safari/605.1.15'
const ANDROID =
  'Mozilla/5.0 (Linux; Android 15; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Mobile Safari/537.36'

function review(box: ReviewState['box'], due: string): ReviewState {
  return { box, due, runs: 2, cleanRuns: 1, missedKeys: [] }
}

function store(p: Progress): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(p))
}

const FIXTURE: Progress = {
  ...defaultProgress(),
  reviews: {
    'star44-low-knight-slide:defend': review(4, '2026-11-01'),
    'star44-low-jump:defend': review(1, '2026-10-20'),
    'invade33-hane-hane:attack': review(2, TODAY),
    'komoku34-tenuki:defend': review(5, '2026-11-20'),
    'invade33-cut-trick:defend': review(4, '2026-11-02'),
    'invade33-cut-trick:attack': review(5, '2026-11-02'),
    'gone-pattern:defend': review(1, '2026-10-01'),
  },
  streak: { count: 4, lastDay: '2026-10-21' },
  settings: { ...defaultProgress().settings, newPerDay: 3 },
}

/** The spar links in a section, as "pattern:side". */
function itemsIn(name: string): string[] {
  const region = screen.getByRole('region', { name })
  return within(region)
    .getAllByRole('link')
    .map((a) => {
      const q = new URLSearchParams(a.getAttribute('href')!.split('?')[1])
      return `${q.get('pattern')}:${q.get('side')}`
    })
}

function stat(label: string): string {
  const dt = screen.getByText(label, { selector: 'dt' })
  return dt.nextElementSibling?.textContent ?? ''
}

beforeEach(() => {
  vi.stubGlobal('localStorage', new MemoryStorage())
  vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(ANDROID)
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('Today', () => {
  it('lists the due reviews first, then exactly newPerDay new ones in course order', () => {
    store(FIXTURE)
    render(<Today today={TODAY} />)

    expect(itemsIn(COPY.today.dueTitle)).toEqual(['star44-low-jump:defend', 'invade33-hane-hane:attack'])
    expect(itemsIn(COPY.today.newTitle)).toEqual([
      'star44-low-attach-extend:defend',
      'star44-low-pincer:defend',
      'star44-high-attach:defend',
    ])

    // The first item of the day is the obvious next step: it comes first in the page and says Play.
    const links = screen.getAllByRole('link').map((a) => a.getAttribute('href'))
    const firstDue = links.findIndex((h) => h?.includes('pattern=star44-low-jump'))
    const firstNew = links.findIndex((h) => h?.includes('pattern=star44-low-attach-extend'))
    expect(firstDue).toBeGreaterThanOrEqual(0)
    expect(firstDue).toBeLessThan(firstNew)
    expect(within(screen.getByRole('region', { name: COPY.today.dueTitle })).getAllByText(COPY.today.play)).toHaveLength(1)
  })

  it('offers newPerDay less the new ones already started today (R44)', () => {
    const course = courseOrder(BOOK)
    const newPerDay = defaultProgress().settings.newPerDay
    store({ ...defaultProgress(), reviews: { [course[0].key]: { ...review(1, '2026-10-23'), firstDay: TODAY } } })
    render(<Today today={TODAY} />)
    expect(itemsIn(COPY.today.newTitle)).toEqual(course.slice(1, newPerDay).map((i) => i.key))
    expect(screen.getByText(COPY.today.lead(0, newPerDay - 1))).toBeTruthy()
  })

  it('once today’s new ones are started, says so, the list is done, and one more is a tap away', () => {
    const course = courseOrder(BOOK)
    const newPerDay = defaultProgress().settings.newPerDay
    const started = Object.fromEntries(course.slice(0, newPerDay).map((i) => [i.key, { ...review(1, '2026-10-23'), firstDay: TODAY }]))
    store({ ...defaultProgress(), reviews: started })
    render(<Today today={TODAY} />)
    expect(screen.getByText(COPY.today.lead(0, 0))).toBeTruthy()
    const region = screen.getByRole('region', { name: COPY.today.newTitle })
    expect(within(region).getByText(COPY.today.doneNew)).toBeTruthy()
    const next = course[newPerDay]
    const more = within(region).getByRole('link', { name: COPY.today.learnOneMore })
    expect(more.getAttribute('href')).toBe(sparHref({ family: next.family, pattern: next.patternId, side: next.side }))
    expect(within(region).queryByText(COPY.today.play)).toBeNull()

    // Tomorrow the day's share is back.
    cleanup()
    render(<Today today="2026-10-23" />)
    expect(itemsIn(COPY.today.newTitle)).toEqual(course.slice(newPerDay, 2 * newPerDay).map((i) => i.key))
  })

  it('shows the mastered count over every drillable side, and the streak', () => {
    store(FIXTURE)
    render(<Today today={TODAY} />)
    expect(stat(COPY.today.mastered)).toBe(COPY.today.masteredValue(3, TOTAL))
    expect(stat(COPY.today.streak)).toBe('4')
  })

  it('starts a new owner on the first two 4-4 point patterns, defending', () => {
    render(<Today today={TODAY} />)
    expect(screen.queryByRole('region', { name: COPY.today.dueTitle })).toBeNull()
    expect(itemsIn(COPY.today.newTitle)).toEqual(['star44-low-knight-slide:defend', 'star44-low-attach-extend:defend'])
    expect(stat(COPY.today.mastered)).toBe(COPY.today.masteredValue(0, TOTAL))
    expect(stat(COPY.today.streak)).toBe('0')
  })

  it("offers Teacher's choice: free sparring in each corner, on the side picked", () => {
    render(<Today today={TODAY} />)
    const region = screen.getByRole('region', { name: COPY.today.freeTitle })
    const hrefs = () => within(region).getAllByRole('link').map((a) => a.getAttribute('href'))
    expect(hrefs()).toHaveLength(4)
    expect(hrefs()[0]).toBe('#/spar?family=star44&side=defend&mode=free')
    fireEvent.click(within(region).getByRole('radio', { name: COPY.today.sideAttack }))
    expect(hrefs()[1]).toBe('#/spar?family=invade33&side=attack&mode=free')
  })

  it('on iOS outside the Home Screen app, shows the install hint until it is dismissed', () => {
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(IPHONE)
    render(<Today today={TODAY} />)
    expect(screen.getByText(COPY.today.iosHintTitle)).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: COPY.today.iosHintDismiss }))
    expect(screen.queryByText(COPY.today.iosHintTitle)).toBeNull()
    expect(loadProgress().settings.iosHintDismissed).toBe(true)

    cleanup()
    render(<Today today={TODAY} />)
    expect(screen.queryByText(COPY.today.iosHintTitle)).toBeNull()
  })

  it('with progress to carry over, says to Export it first and links to Settings', () => {
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(IPHONE)
    render(<Today today={TODAY} />)
    // A new owner has nothing to move.
    expect(screen.getByText(COPY.today.iosHintBody)).toBeTruthy()
    expect(screen.queryByText(COPY.today.iosHintMove)).toBeNull()
    cleanup()

    store(FIXTURE)
    render(<Today today={TODAY} />)
    expect(screen.getByText(COPY.today.iosHintTitle)).toBeTruthy()
    expect(screen.getByText(COPY.today.iosHintMove)).toBeTruthy()
    expect(screen.getByRole('link', { name: COPY.today.iosHintExport }).getAttribute('href')).toBe('#/settings')
  })

  it("inside an app's browser (LINE), says to open the page in Safari first", () => {
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(IPHONE_LINE)
    render(<Today today={TODAY} />)
    expect(screen.getByText(COPY.today.iosHintInApp)).toBeTruthy()
    expect(screen.queryByText(COPY.today.iosHintBody)).toBeNull()
  })

  it('counts an iPad that asks for desktop pages as iOS, but not a Mac', () => {
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(IPAD_DESKTOP)
    render(<Today today={TODAY} />)
    expect(screen.queryByText(COPY.today.iosHintTitle)).toBeNull()
    cleanup()

    Object.defineProperty(navigator, 'maxTouchPoints', { value: 5, configurable: true })
    try {
      render(<Today today={TODAY} />)
      expect(screen.getByText(COPY.today.iosHintTitle)).toBeTruthy()
    } finally {
      delete (navigator as { maxTouchPoints?: number }).maxTouchPoints
    }
  })

  it('shows no install hint on Android, or when already installed on iOS', () => {
    render(<Today today={TODAY} />)
    expect(screen.queryByText(COPY.today.iosHintTitle)).toBeNull()
    cleanup()

    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(IPHONE)
    Object.defineProperty(navigator, 'standalone', { value: true, configurable: true })
    try {
      render(<Today today={TODAY} />)
      expect(screen.queryByText(COPY.today.iosHintTitle)).toBeNull()
    } finally {
      delete (navigator as { standalone?: boolean }).standalone
    }
  })
})
