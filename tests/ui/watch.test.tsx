// @vitest-environment jsdom
// Watch first, then test (R45). The watch screen plays the main line on the board the test will use,
// Auto-play runs by itself (not with reduced motion), "Try it yourself" lands in the test with the same
// sym and seed, and the test offers "Watch first" before the owner's first move. Which links open the
// watch: Today's new patterns and the Watch buttons do; reviews and the Test buttons don't.

import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../../src/App'
import { BOOK } from '../../src/book/data'
import { parseGtp, toGtp, transform, type Pt, type Sym } from '../../src/go/coords'
import type { Progress, ReviewState } from '../../src/progress/srs'
import { defaultProgress, STORAGE_KEY } from '../../src/progress/store'
import { orientNote } from '../../src/session/orient'
import { drillableSides, ownerColor } from '../../src/session/sides'
import { COPY } from '../../src/ui/copy'
import { EngineHub } from '../../src/ui/engine'
import { parseRoute, phaseHref, sparHref, wantsWatch, type SparParams } from '../../src/ui/router'
import { Library } from '../../src/ui/screens/Library'
import { Pattern } from '../../src/ui/screens/Pattern'
import { Spar } from '../../src/ui/screens/Spar'
import { Today } from '../../src/ui/screens/Today'
import { Watch } from '../../src/ui/screens/Watch'
import { AUTO_PLAY_MS } from '../../src/ui/watchLine'
import { FakeEngine } from '../session/fakeEngine'
import { MemoryStorage } from './memoryStorage'

const P = COPY.pattern
const W = COPY.watch
const KNIGHT_ID = 'star44-low-knight-slide'
const PATH = BOOK.patterns[KNIGHT_ID].path
const N = PATH.length

function knight(sym: Sym, seed: number, more: SparParams = {}): SparParams {
  return { family: 'star44', pattern: KNIGHT_ID, side: 'defend', sym: String(sym), seed: String(seed), ...more }
}

let hubs: EngineHub[] = []
function hub(): EngineHub {
  const h = new EngineHub(() => new FakeEngine({ status: 'loading' }))
  hubs.push(h.start())
  return h
}

/** The app open on Today, then sent to `hash` the way a link does it: a hashchange. */
async function openApp(hash: string): Promise<void> {
  render(<App engine={hub()} />)
  await settle()
  window.location.hash = hash
  await settle()
}

/** Waits (real time) until `ok` holds: the teacher's answer shows after a short pause (TEACHER_GAP_MS). */
async function until(ok: () => boolean, ms = 3000): Promise<void> {
  for (let waited = 0; !ok() && waited < ms; waited += 50) {
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50))
    })
  }
}

/** Lets promises, effects and a hashchange run out. */
async function settle(): Promise<void> {
  await act(async () => {
    for (let i = 0; i < 5; i++) await new Promise((r) => setTimeout(r, 0))
  })
}

function reducedMotion(on: boolean): void {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: (q: string) => ({ matches: on && q.includes('reduce'), media: q, addEventListener() {}, removeEventListener() {} }),
  })
}

const count = () => document.querySelector('.step-count')?.textContent
const note = () => document.querySelector('.step')?.textContent ?? ''
const lastMark = () => document.querySelector('[data-last]')?.getAttribute('data-last') ?? null
const keyOf = (p: Pt) => `${p.x},${p.y}`
const onBoard = (i: number, sym: Sym) => {
  const at = PATH[i].move!.at
  if (at === 'tenuki') throw new Error('tenuki')
  return transform(at, sym)
}
const tryIt = () => screen.getByRole('link', { name: W.tryIt })
const query = (h: string) => new URLSearchParams(h.split('?')[1])

beforeEach(() => {
  vi.stubGlobal('localStorage', new MemoryStorage())
  vi.stubGlobal('sessionStorage', new MemoryStorage())
  window.location.hash = '#/'
  reducedMotion(false)
})

afterEach(async () => {
  cleanup()
  vi.useRealTimers()
  await new Promise((r) => setTimeout(r, 0))
  for (const h of hubs) h.dispose()
  hubs = []
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  delete (window as { matchMedia?: unknown }).matchMedia
})

describe('the watch phase', () => {
  it('plays the main line on the turned board, a move at a time, with turned notes and the last move marked', () => {
    reducedMotion(true)
    const sym: Sym = 3
    render(<Watch params={knight(sym, 42, { phase: 'watch' })} />)
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(BOOK.patterns[KNIGHT_ID].def.name)
    expect(screen.getByText(W.lead('black', 'defend'))).toBeTruthy()
    expect(count()).toBe(P.start)
    expect(lastMark()).toBeNull()

    const next = screen.getByRole('button', { name: P.next })
    for (let i = 0; i < N; i++) {
      fireEvent.click(next)
      const p = onBoard(i, sym)
      expect(count()).toBe(P.step(i + 1, N))
      expect(lastMark()).toBe(keyOf(p))
      expect(note()).toContain(P.move(PATH[i].move!.color, toGtp(p)))
      expect(note()).toContain(orientNote(PATH[i].note, sym))
      // Try it yourself is there the whole time, and leads only once the line is done.
      expect(tryIt().classList.contains('btn-primary')).toBe(i === N - 1)
    }
    expect(next).toHaveProperty('disabled', true)
    // The points named are this board's, not the book's (R14 is somewhere else under sym 3).
    expect(toGtp(onBoard(0, sym))).not.toBe('R14')

    fireEvent.click(screen.getByRole('button', { name: P.prev }))
    expect(count()).toBe(P.step(N - 1, N))
    // Watching saves nothing.
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
  })

  it('Auto-play starts by itself, moves on every AUTO_PLAY_MS, and Pause stops it', () => {
    vi.useFakeTimers()
    render(<Watch params={knight(1, 5, { phase: 'watch' })} />)
    expect(count()).toBe(P.start)
    act(() => vi.advanceTimersByTime(AUTO_PLAY_MS))
    expect(count()).toBe(P.step(1, N))
    act(() => vi.advanceTimersByTime(AUTO_PLAY_MS))
    expect(count()).toBe(P.step(2, N))

    fireEvent.click(screen.getByRole('button', { name: W.pause }))
    for (let i = 0; i < 5; i++) act(() => vi.advanceTimersByTime(AUTO_PLAY_MS))
    expect(count()).toBe(P.step(2, N))

    // Played to the end, it rests there; pressed again, it starts the line over.
    fireEvent.click(screen.getByRole('button', { name: W.autoPlay }))
    for (let i = 0; i < N + 3; i++) act(() => vi.advanceTimersByTime(AUTO_PLAY_MS))
    expect(count()).toBe(P.step(N, N))
    fireEvent.click(screen.getByRole('button', { name: W.autoPlay }))
    expect(count()).toBe(P.start)
    act(() => vi.advanceTimersByTime(AUTO_PLAY_MS))
    expect(count()).toBe(P.step(1, N))

    // A step by hand stops it too.
    fireEvent.click(screen.getByRole('button', { name: P.next }))
    for (let i = 0; i < 3; i++) act(() => vi.advanceTimersByTime(AUTO_PLAY_MS))
    expect(count()).toBe(P.step(2, N))
  })

  it('with reduced motion, Auto-play waits for a tap', () => {
    vi.useFakeTimers()
    reducedMotion(true)
    render(<Watch params={knight(0, 1, { phase: 'watch' })} />)
    for (let i = 0; i < 3; i++) act(() => vi.advanceTimersByTime(AUTO_PLAY_MS))
    expect(count()).toBe(P.start)
    fireEvent.click(screen.getByRole('button', { name: W.autoPlay }))
    act(() => vi.advanceTimersByTime(AUTO_PLAY_MS))
    expect(count()).toBe(P.step(1, N))
  })

  it('a link without sym and seed gets them: in the address, and in Try it yourself', () => {
    const params = { family: 'star44', pattern: KNIGHT_ID, side: 'defend', phase: 'watch' }
    window.location.hash = sparHref(params)
    render(<Watch params={params} />)
    const address = parseRoute(window.location.hash)
    if (address.name !== 'spar') throw new Error('not a spar address')
    expect(address.params).toMatchObject({ ...params, sym: expect.stringMatching(/^[0-7]$/), seed: expect.stringMatching(/^\d+$/) })
    const sym = Number(address.params.sym) as Sym
    expect(tryIt().getAttribute('href')).toBe(sparHref({ ...params, phase: undefined, sym: address.params.sym, seed: address.params.seed }))
    // The board on show is that sym's: the first move lands where the book's R14 turns to.
    fireEvent.click(screen.getByRole('button', { name: P.next }))
    expect(lastMark()).toBe(keyOf(transform(parseGtp('R14'), sym)))
  })

  it('Try it yourself lands in the test, same sym and seed, without a reload', async () => {
    reducedMotion(true)
    const sym: Sym = 5
    await openApp(sparHref(knight(sym, 77, { phase: 'watch' })))
    const page = document.querySelector('.app')
    expect(screen.getByRole('link', { name: W.tryIt })).toBeTruthy()
    expect(screen.queryByText(COPY.spar.youAre('black', 'defend'))).toBeNull()

    const href = tryIt().getAttribute('href')!
    expect(wantsWatch((parseRoute(href) as { params: SparParams }).params)).toBe(false)
    fireEvent.click(tryIt())
    // jsdom follows a same-page link like a browser: a hashchange, not a page load.
    await settle()
    expect(window.location.hash).toBe(href)
    // Same page, same app: only the screen under it changed.
    expect(document.querySelector('.app')).toBe(page)

    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(BOOK.patterns[KNIGHT_ID].def.name)
    expect(screen.getByText(COPY.spar.youAre('black', 'defend'))).toBeTruthy()
    expect(screen.queryByRole('link', { name: W.tryIt })).toBeNull()
    const q = query(window.location.hash)
    expect([q.get('sym'), q.get('seed'), q.get('phase')]).toEqual(['5', '77', null])
    // The test's teacher opens on the same turned board: its first stone is where the watch put it.
    await until(() => lastMark() !== null)
    expect(lastMark()).toBe(keyOf(onBoard(0, sym)))
  })

  it("free sparring has no watch phase, and an unknown pattern says so", async () => {
    await openApp('#/spar?family=star44&side=defend&mode=free&phase=watch')
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(COPY.spar.freeTitle(BOOK.families.star44.def.name))
    expect(screen.queryByRole('link', { name: W.tryIt })).toBeNull()
    expect(screen.queryByRole('link', { name: W.watchFirst })).toBeNull()
    cleanup()

    expect(wantsWatch({ family: 'star44', phase: 'watch' })).toBe(false)
    expect(wantsWatch({ pattern: KNIGHT_ID, phase: 'test' })).toBe(false)
    expect(wantsWatch({ pattern: KNIGHT_ID, phase: 'watch' })).toBe(true)

    render(<Watch params={{ pattern: 'nope', phase: 'watch' }} />)
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(COPY.spar.unknownPattern('nope'))
  })
})

describe('Watch first, in the test', () => {
  it('goes to the watch for the same board until the owner plays, and not in free sparring', async () => {
    const { container } = render(<Spar params={knight(0, 9)} engine={hub()} gapMs={0} />)
    await settle()
    const link = screen.getByRole('link', { name: W.watchFirst })
    expect(link.getAttribute('href')).toBe(phaseHref(knight(0, 9), 'watch'))
    expect(query(link.getAttribute('href')!).get('phase')).toBe('watch')

    // The owner's first move: from here it's the test, no peeking.
    const o17 = parseGtp('O17')
    fireEvent.click(container.querySelector(`[data-x="${o17.x}"][data-y="${o17.y}"]`)!)
    await settle()
    expect(screen.queryByRole('link', { name: W.watchFirst })).toBeNull()
    cleanup()

    render(<Spar params={{ family: 'star44', side: 'defend', mode: 'free', sym: '0', seed: '1' }} engine={hub()} gapMs={0} />)
    await settle()
    expect(screen.queryByRole('link', { name: W.watchFirst })).toBeNull()
  })
})

function review(box: ReviewState['box'], due: string): ReviewState {
  return { box, due, runs: 2, cleanRuns: 1, missedKeys: [] }
}

describe('which links open the watch', () => {
  it("Today: the new patterns do; the reviews due don't", () => {
    const progress: Progress = {
      ...defaultProgress(),
      reviews: { 'star44-low-jump:defend': review(1, '2026-10-20'), 'invade33-hane-hane:attack': review(2, '2026-10-22') },
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(progress))
    render(<Today today="2026-10-22" />)
    const links = (title: string) =>
      within(screen.getByRole('region', { name: title }))
        .getAllByRole('link')
        .map((a) => a.getAttribute('href')!)
    const due = links(COPY.today.dueTitle)
    const fresh = links(COPY.today.newTitle)
    expect(due).toHaveLength(2)
    expect(fresh.length).toBeGreaterThan(0)
    for (const h of due) expect(query(h).get('phase')).toBeNull()
    for (const h of fresh) expect(query(h).get('phase')).toBe('watch')
    expect(due[0]).toBe(sparHref({ family: 'star44', pattern: 'star44-low-jump', side: 'defend' }))
  })

  it('Library: every drillable side has Watch and Test', () => {
    render(<Library />)
    for (const id of ['star44-low-jump', 'invade33-cut-trick']) {
      const family = BOOK.patterns[id].family
      for (const side of drillableSides(BOOK, id)) {
        const groups = screen.getAllByRole('group', { name: P.drill(side, ownerColor(BOOK.families[family].def, side)) })
        const group = groups.find((g) => query(g.querySelector('a')!.getAttribute('href')!).get('pattern') === id)!
        const drill = { family, pattern: id, side }
        expect(within(group).getByRole('link', { name: W.watch }).getAttribute('href')).toBe(phaseHref(drill, 'watch'))
        expect(within(group).getByRole('link', { name: W.test }).getAttribute('href')).toBe(phaseHref(drill, 'test'))
      }
    }
    const sides = Object.keys(BOOK.patterns).reduce((n, id) => n + drillableSides(BOOK, id).length, 0)
    expect(screen.getAllByRole('link', { name: W.watch })).toHaveLength(sides)
    expect(screen.getAllByRole('link', { name: W.test })).toHaveLength(sides)
  })

  it('Pattern page: Watch and Test per side; a side not played yet leads with Watch, a played one with Test', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...defaultProgress(), reviews: { 'star44-low-jump:attack': review(2, '2026-11-01') } }))
    render(<Pattern id="star44-low-jump" />)
    const group = (side: 'defend' | 'attack') =>
      screen.getByRole('group', { name: P.drill(side, ownerColor(BOOK.families.star44.def, side)) })
    const drill = (side: 'defend' | 'attack') => ({ family: 'star44', pattern: 'star44-low-jump', side })
    for (const side of ['defend', 'attack'] as const) {
      expect(within(group(side)).getByRole('link', { name: W.watch }).getAttribute('href')).toBe(phaseHref(drill(side), 'watch'))
      expect(within(group(side)).getByRole('link', { name: W.test }).getAttribute('href')).toBe(phaseHref(drill(side), 'test'))
    }
    expect(within(group('defend')).getByRole('link', { name: W.watch }).classList.contains('btn-primary')).toBe(true)
    expect(within(group('defend')).getByRole('link', { name: W.test }).classList.contains('btn-primary')).toBe(false)
    expect(within(group('attack')).getByRole('link', { name: W.test }).classList.contains('btn-primary')).toBe(true)
  })
})
