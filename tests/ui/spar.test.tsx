// @vitest-environment jsdom
// The Spar screen wired to a real SparController and the real book, with a fake engine:
// verdict panels and their buttons, saving when a session ends or is switched away, and the report.

import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { StrictMode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { parseGtp } from '../../src/go/coords'
import { SparController } from '../../src/session/controller'
import { STORAGE_KEY } from '../../src/progress/store'
import { COPY } from '../../src/ui/copy'
import { EngineHub } from '../../src/ui/engine'
import { getLastReport } from '../../src/ui/reportStore'
import { parseRoute, sparHref } from '../../src/ui/router'
import { Spar } from '../../src/ui/screens/Spar'
import { Report } from '../../src/ui/screens/Report'
import { FakeEngine, type EngineStatus } from '../session/fakeEngine'

// The knight's-move drill, defending (Black), with the book's own orientation.
const KNIGHT = { family: 'star44', pattern: 'star44-low-knight-slide', side: 'defend', sym: '0', seed: '1' }

let hubs: EngineHub[] = []

/** Node 25 has a localStorage of its own that shadows jsdom's; the tests use a plain one in memory. */
class MemoryStorage {
  private m = new Map<string, string>()
  get length() {
    return this.m.size
  }
  key(i: number) {
    return [...this.m.keys()][i] ?? null
  }
  getItem(k: string) {
    return this.m.get(k) ?? null
  }
  setItem(k: string, v: string) {
    this.m.set(k, String(v))
  }
  removeItem(k: string) {
    this.m.delete(k)
  }
  clear() {
    this.m.clear()
  }
}

function hub(status: EngineStatus = 'loading'): EngineHub {
  const h = new EngineHub(() => new FakeEngine({ status }))
  hubs.push(h.start())
  return h
}

/** Lets the controller's promises and React's updates run out. */
async function settle(): Promise<void> {
  await act(async () => {
    for (let i = 0; i < 5; i++) await new Promise((r) => setTimeout(r, 0))
  })
}

async function tap(container: HTMLElement, gtp: string): Promise<void> {
  const p = parseGtp(gtp)
  const el = container.querySelector(`[data-x="${p.x}"][data-y="${p.y}"]`)
  if (!el) throw new Error(`${gtp} is not on the board`)
  fireEvent.click(el)
  await settle()
}

/** A finger tap: pointerdown says touch, then the click. */
async function touchTap(container: HTMLElement, gtp: string): Promise<void> {
  const p = parseGtp(gtp)
  const el = container.querySelector(`[data-x="${p.x}"][data-y="${p.y}"]`)
  if (!el) throw new Error(`${gtp} is not on the board`)
  fireEvent.pointerDown(el, { pointerType: 'touch' })
  fireEvent.click(el)
  await settle()
}

async function press(name: string): Promise<void> {
  fireEvent.click(screen.getByRole('button', { name }))
  await settle()
}

/** The verdict panel's text (the move list below repeats the verdict words). */
function verdict(): string {
  return document.querySelector('.verdict')?.textContent ?? ''
}

function saved(): { reviews: Record<string, { box: number; runs: number }> } | null {
  const raw = localStorage.getItem(STORAGE_KEY)
  return raw ? JSON.parse(raw) : null
}

beforeEach(() => {
  vi.stubGlobal('localStorage', new MemoryStorage())
  vi.stubGlobal('sessionStorage', new MemoryStorage())
  window.location.hash = '#/spar'
})

afterEach(async () => {
  cleanup()
  // An unmounted session disposes its controller on the next tick: let that happen here.
  await new Promise((r) => setTimeout(r, 0))
  for (const h of hubs) h.dispose()
  hubs = []
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

async function startKnight(engine = hub()) {
  const r = render(<Spar params={KNIGHT} engine={engine} gapMs={0} />)
  await settle()
  return r
}

describe('Spar', () => {
  it('runs an in-book drill to the end while the engine is still loading, saves it and goes to the report', async () => {
    const { container } = await startKnight()
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe("Low approach, knight's move, slide, block, extend")
    expect(screen.getByText(COPY.engine.loading)).toBeTruthy()
    expect(screen.getByText(COPY.spar.yourMove)).toBeTruthy()

    await tap(container, 'O17')
    expect(verdict()).toContain(COPY.verdict.good)
    await tap(container, 'R17')

    expect(window.location.hash).toBe('#/report')
    const report = getLastReport()
    expect(report?.result).toMatchObject({ patternIds: ['star44-low-knight-slide'], clean: true, mistakes: 0 })
    expect(report?.right).toBe(2)
    expect(saved()?.reviews['star44-low-knight-slide:defend']).toMatchObject({ box: 1, runs: 1 })

    cleanup()
    render(<Report />)
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(COPY.report.clean)
    expect(screen.getByText(COPY.report.nextTomorrow)).toBeTruthy()
  })

  it('stops on a book mistake, marks the better point in red, and Retry goes back', async () => {
    const { container } = await startKnight()
    await tap(container, 'O17')
    await tap(container, 'S17')

    // R29: the book check's loss for S17 (5.12), even with the engine still loading.
    expect(verdict()).toContain(COPY.verdict.bigMistake)
    expect(verdict()).toContain(COPY.verdict.better('R17', 5.1))
    const r17 = parseGtp('R17')
    const s17 = parseGtp('S17')
    expect(container.querySelector(`[data-marker="better"][data-at="${r17.x},${r17.y}"]`)).not.toBeNull()
    expect(container.querySelector(`[data-marker="mistake"][data-at="${s17.x},${s17.y}"]`)).not.toBeNull()
    expect(screen.queryByRole('button', { name: COPY.spar.playElsewhere })).toBeNull()

    await press(COPY.verdict.retry)
    expect(screen.getByText(COPY.spar.yourMove)).toBeTruthy()
    expect(container.querySelector('[data-marker]')).toBeNull()
    expect(container.querySelector(`[data-stone][data-x]`)).toBeNull()
  })

  it('Play on after a mistake: the teacher punishes, and the session is saved as missed', async () => {
    const { container } = await startKnight()
    await tap(container, 'O17')
    await tap(container, 'S17')
    await press(COPY.verdict.playOn)
    await tap(container, 'R16')

    expect(window.location.hash).toBe('#/report')
    expect(getLastReport()?.result).toMatchObject({ clean: false, mistakes: 1, pointsLost: 5.1 })
    expect(saved()?.reviews['star44-low-knight-slide:defend']).toMatchObject({ box: 1 })
  })

  it('another joseki stops play with Retry this drill and Switch to that pattern; switching costs nothing', async () => {
    const { container } = await startKnight()
    await tap(container, 'Q14')

    expect(verdict()).toContain(COPY.verdict.otherJoseki)
    expect(screen.getByRole('button', { name: COPY.verdict.retryDrill })).toBeTruthy()
    await press(COPY.verdict.switchOne)

    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Low approach, attach and extend')
    expect(screen.getByText(COPY.spar.yourMove)).toBeTruthy()
    expect(saved()).toBeNull()
  })

  it('offers one Switch button per pattern, by name, when the move starts several', async () => {
    await startKnight()
    await press(COPY.spar.playElsewhere)

    expect(verdict()).toContain(COPY.verdict.otherJoseki)
    expect(screen.getByRole('button', { name: COPY.verdict.switchTo('Double approach after tenuki: attach on the stronger side') })).toBeTruthy()
    expect(screen.getByRole('button', { name: COPY.verdict.switchTo('Low approach, tenuki: White takes the 3-3 point') })).toBeTruthy()
    expect(screen.queryByRole('button', { name: COPY.verdict.switchOne })).toBeNull()

    await press(COPY.verdict.retryDrill)
    expect(screen.getByText(COPY.spar.yourMove)).toBeTruthy()
  })

  it('switching after a mistake saves the abandoned drill as missed', async () => {
    // A ready engine that scores every move 5 points down: an off-book move is a big mistake.
    const engine = new EngineHub(() => new FakeEngine({ status: 'ready', score: () => -5 }))
    hubs.push(engine.start())
    const { container } = await startKnight(engine)
    await tap(container, 'P17')
    expect(verdict()).toContain(COPY.verdict.bigMistake)
    await press(COPY.verdict.retry)

    await tap(container, 'Q14')
    await press(COPY.verdict.switchOne)
    expect(saved()?.reviews['star44-low-knight-slide:defend']).toMatchObject({ box: 1, runs: 1 })
    expect(saved()?.reviews['star44-low-attach-extend:defend']).toBeUndefined()
  })

  it('an off-book move with the engine loading is not checked, and says so', async () => {
    const { container } = await startKnight()
    await tap(container, 'P17')
    expect(verdict()).toBe(COPY.verdict.unjudged)
  })

  it('says so when progress could not be saved', async () => {
    vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError')
    })
    const { container } = await startKnight()
    await tap(container, 'O17')
    await tap(container, 'R17')
    expect(getLastReport()?.saved).toBe(false)
    cleanup()
    render(<Report />)
    expect(screen.getByText(COPY.spar.saveFailed)).toBeTruthy()
  })

  it('shows the engine as off when it fails, disposes it, and Try again starts a fresh one', async () => {
    const made: FakeEngine[] = []
    const engine = new EngineHub(() => {
      const e = new FakeEngine({ status: made.length === 0 ? 'failed' : 'ready' })
      made.push(e)
      return e
    })
    hubs.push(engine.start())
    const dispose = vi.spyOn(made[0], 'dispose')
    await startKnight(engine)
    expect(screen.getByText(COPY.engine.off)).toBeTruthy()
    expect(screen.getByText(COPY.engine.offHelp)).toBeTruthy() // as text: phones show no tooltips
    expect(dispose).toHaveBeenCalled()

    await press(COPY.engine.retry)
    expect(made).toHaveLength(2)
    expect(screen.getByText(COPY.engine.ready)).toBeTruthy()
  })

  it('puts the low-confidence line under a note the book is unsure of, and only there', async () => {
    const params = { family: 'sansan33', pattern: 'sansan33-fourth-line-approach', side: 'defend', sym: '0', seed: '1' }
    const { container } = render(<Spar params={params} engine={hub()} gapMs={0} />)
    await settle()
    expect(screen.queryByText(COPY.spar.lowConfidence)).toBeNull() // White's O16 is a sure note
    await tap(container, 'Q14')
    // White's answer, R12, carries confidence: 'low'.
    const lines = [...container.querySelectorAll('.move-line')]
    expect(lines).toHaveLength(1)
    expect(lines[0].textContent).toContain('R12')
    expect(lines[0].textContent).toContain(COPY.spar.lowConfidence)
    expect(verdict()).not.toContain(COPY.spar.lowConfidence)
  })

  it('names a pattern that does not exist instead of starting', async () => {
    render(<Spar params={{ pattern: 'nope' }} engine={hub()} gapMs={0} />)
    expect(screen.getByText(COPY.spar.unknownPattern('nope'))).toBeTruthy()
  })

  it('free sparring starts from the family alone', async () => {
    render(<Spar params={{ family: 'star44', side: 'defend', sym: '0', seed: '3' }} engine={hub()} gapMs={0} />)
    await settle()
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(COPY.spar.freeTitle('4-4 point'))
    expect(screen.getByText(COPY.spar.yourMove)).toBeTruthy()
  })
})

describe('Spar on touch', () => {
  it('Play O17 confirms the ghost; after a mistake and Retry no ghost comes back', async () => {
    const { container } = await startKnight()
    await touchTap(container, 'O17')
    expect(screen.getByText(COPY.spar.tapAgain('O17'))).toBeTruthy()
    await press(COPY.spar.playPoint('O17'))
    expect(verdict()).toContain(COPY.verdict.good)

    await touchTap(container, 'S17')
    await press(COPY.spar.playPoint('S17'))
    expect(verdict()).toContain(COPY.verdict.bigMistake)
    await press(COPY.verdict.retry)

    expect(container.querySelector('[data-ghost]')).toBeNull()
    expect(screen.queryByRole('button', { name: COPY.spar.playPoint('S17') })).toBeNull()
    // One tap on S17 is a fresh first tap, not a replay of the mistake.
    await touchTap(container, 'S17')
    expect(screen.getByText(COPY.spar.tapAgain('S17'))).toBeTruthy()
    expect(container.querySelector('.verdict')).toBeNull()
  })

  it('the confirm button sits in the bar right under the board', async () => {
    const { container } = await startKnight()
    await touchTap(container, 'O17')
    const panel = container.querySelector('.spar-panel')!
    expect(panel.firstElementChild?.classList.contains('bar')).toBe(true)
    expect(panel.firstElementChild?.textContent).toContain(COPY.spar.playPoint('O17'))
  })
})

describe('Spar address', () => {
  const LINK = { family: 'star44', pattern: 'star44-low-knight-slide', side: 'defend' }

  it('a link without sym and seed gets the ones picked written into the address, so a reload replays the same board', async () => {
    // 0.5 picks sym 4 (mirrored: the teacher's R14 lands on C14) and seed 2^31.
    vi.spyOn(Math, 'random').mockReturnValue(0.5)
    window.location.hash = sparHref(LINK)
    const { container, unmount } = render(<Spar params={LINK} engine={hub()} gapMs={0} />)
    await settle()
    const c14 = parseGtp('C14')
    expect(container.querySelector(`[data-last="${c14.x},${c14.y}"]`)).not.toBeNull()
    expect(window.location.hash).toBe(sparHref({ ...LINK, sym: '4', seed: '2147483648' }))

    // The reload: the address now names sym and seed, Math.random is no longer asked.
    unmount()
    vi.mocked(Math.random).mockReturnValue(0)
    const route = parseRoute(window.location.hash)
    if (route.name !== 'spar') throw new Error('not a spar route')
    const again = render(<Spar params={route.params} engine={hub()} gapMs={0} />)
    await settle()
    expect(again.container.querySelector(`[data-last="${c14.x},${c14.y}"]`)).not.toBeNull()
    expect(window.location.hash).toBe(sparHref({ ...LINK, sym: '4', seed: '2147483648' }))
  })

  it('a link that names sym and seed is left as it is', async () => {
    window.location.hash = sparHref(KNIGHT)
    await startKnight()
    expect(window.location.hash).toBe(sparHref(KNIGHT))
  })

  it('switching to another pattern keeps sym and seed in the address', async () => {
    const { container } = await startKnight()
    await tap(container, 'Q14')
    await press(COPY.verdict.switchOne)
    expect(window.location.hash).toBe(sparHref({ family: 'star44', pattern: 'star44-low-attach-extend', side: 'defend', sym: '0', seed: '1' }))
  })
})

describe('Spar lifecycle', () => {
  it('under StrictMode starts one session, and disposes it only when the screen really goes', async () => {
    const start = vi.spyOn(SparController.prototype, 'start')
    const dispose = vi.spyOn(SparController.prototype, 'dispose')
    const { container, unmount } = render(
      <StrictMode>
        <Spar params={KNIGHT} engine={hub()} gapMs={0} />
      </StrictMode>,
    )
    await settle()
    expect(new Set(start.mock.contexts).size).toBe(1)
    const session = start.mock.contexts[0]
    const disposals = () => dispose.mock.contexts.filter((c) => c === session).length
    expect(disposals()).toBe(0)
    expect(container.querySelectorAll('[data-stone="white"]')).toHaveLength(1) // one teacher move, R14

    await tap(container, 'O17')
    expect(verdict()).toContain(COPY.verdict.good)

    unmount()
    await settle()
    expect(disposals()).toBe(1)
  })

  it('a move that fails shows an error with Start again, which starts a fresh session', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(SparController.prototype, 'ownerPlay').mockRejectedValueOnce(new Error('boom'))
    const { container } = await startKnight()
    await tap(container, 'O17')
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(COPY.spar.failed)

    await press(COPY.spar.startAgain)
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe("Low approach, knight's move, slide, block, extend")
    expect(screen.getByText(COPY.spar.yourMove)).toBeTruthy()
  })

  it('a screen that throws while drawing shows the error instead of a blank app', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const real = Object.getOwnPropertyDescriptor(SparController.prototype, 'state')!.get!
    let broken = true
    vi.spyOn(SparController.prototype, 'state', 'get').mockImplementation(function (this: SparController) {
      if (broken) throw new Error('boom')
      return real.call(this)
    })
    await startKnight()
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(COPY.spar.failed)

    broken = false
    await press(COPY.spar.startAgain)
    expect(screen.getByText(COPY.spar.yourMove)).toBeTruthy()
  })
})
