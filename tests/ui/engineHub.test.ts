// The app's engine hub passes the owner's visits setting on to every search that doesn't name its own,
// brings an engine back by itself after an app switch (R41), and reloads once for a worker file an
// update removed (M1).

import { afterEach, describe, expect, it, vi } from 'vitest'
import { CORNER_REGION } from '../../src/go/coords'
import { emptyPosition } from '../../src/go/rules'
import type { TeacherEngine } from '../../src/engine/teacher'
import { EngineHub } from '../../src/ui/engine'
import { FakeVisibility } from '../engine/fakeVisibility'
import { FakeEngine } from '../session/fakeEngine'

class RecordingEngine extends FakeEngine {
  readonly opts: Array<{ visits?: number } | undefined> = []
  analyzeCorner(...args: Parameters<TeacherEngine['analyzeCorner']>) {
    this.opts.push(args[3])
    return super.analyzeCorner(args[0], args[1], args[2])
  }
  scoreFor(...args: Parameters<TeacherEngine['scoreFor']>) {
    this.opts.push(args[3])
    return super.scoreFor(args[0], args[1], args[2])
  }
}

let hubs: EngineHub[] = []
afterEach(() => {
  for (const h of hubs) h.dispose()
  hubs = []
})

describe('EngineHub visits', () => {
  it("fills in the visits setting, read at each call, and leaves a caller's own visits alone", async () => {
    const engine = new RecordingEngine()
    let visits = 64
    const h = new EngineHub(() => engine, { visits: () => visits }).start()
    hubs.push(h)
    const pos = emptyPosition()

    await h.analyzeCorner(pos, 7.5, CORNER_REGION)
    visits = 300
    await h.scoreFor(pos, 7.5, 'black')
    await h.analyzeCorner(pos, 7.5, CORNER_REGION, { visits: 20, maxTimeMs: 500 })
    expect(engine.opts).toEqual([{ visits: 64 }, { visits: 300 }, { visits: 20, maxTimeMs: 500 }])
  })

  it('passes nothing extra without a visits source', async () => {
    const engine = new RecordingEngine()
    const h = new EngineHub(() => engine).start()
    hubs.push(h)
    await h.analyzeCorner(emptyPosition(), 7.5, CORNER_REGION)
    expect(engine.opts).toEqual([undefined])
  })
})

/** A hub over a line of fake engines: `engines[i]` is the i-th one it made. */
function hubWith(opts: { reload?: () => boolean } = {}) {
  const engines: FakeEngine[] = []
  const vis = new FakeVisibility()
  const h = new EngineHub(
    () => {
      const e = new FakeEngine()
      engines.push(e)
      return e
    },
    { visibility: vis, ...opts },
  ).start()
  hubs.push(h)
  return { h, engines, vis }
}

const settle = () => new Promise((r) => setTimeout(r, 0))

describe('EngineHub after an app switch (R41)', () => {
  it('an engine stopped by a deadline comes back by itself when the page shows again', async () => {
    const { h, engines, vis } = hubWith()
    await settle()
    vis.set(true)
    engines[0].fail('deadline')
    expect(engines).toHaveLength(1)
    vis.set(false)
    expect(engines).toHaveLength(2)
    expect(h.status()).toBe('ready')
    expect(engines[0].current).toBe('failed')
  })

  it('…also when the deadline goes off just after the page came back', async () => {
    const { h, engines, vis } = hubWith()
    await settle()
    vis.set(true)
    vis.set(false)
    engines[0].fail('deadline')
    h.status()
    await settle()
    expect(engines).toHaveLength(2)
    expect(h.snapshot()).toBe('ready')
  })

  it('only once in a row: a new engine that never got going is left for Try again', async () => {
    const engines: FakeEngine[] = []
    const vis = new FakeVisibility()
    const h = new EngineHub(
      () => {
        const e = new FakeEngine({ status: engines.length === 0 ? 'ready' : 'loading' })
        engines.push(e)
        return e
      },
      { visibility: vis },
    ).start()
    hubs.push(h)
    await settle()
    engines[0].fail('deadline')
    vis.set(true)
    vis.set(false)
    expect(engines).toHaveLength(2)
    engines[1].fail('deadline')
    vis.set(true)
    vis.set(false)
    h.status()
    await settle()
    expect(engines).toHaveLength(2)
    expect(h.snapshot()).toBe('failed')
    h.retry()
    expect(engines).toHaveLength(3)
  })

  it('an engine that came back and worked comes back again after the next switch', async () => {
    const { h, engines, vis } = hubWith()
    await settle()
    for (let i = 0; i < 3; i++) {
      vis.set(true)
      engines[i].fail('deadline')
      vis.set(false)
      await settle()
    }
    expect(engines).toHaveLength(4)
    expect(h.status()).toBe('ready')
  })

  it('a deadline missed with the page showing all along waits for the next time the page shows', async () => {
    const { h, engines, vis } = hubWith()
    await settle()
    engines[0].fail('deadline')
    h.status()
    await settle()
    expect(engines).toHaveLength(1)
    expect(h.snapshot()).toBe('failed')
    vis.set(true)
    vis.set(false)
    expect(engines).toHaveLength(2)
  })

  it('repeated search errors count like a deadline; a failed load or a crash does not', async () => {
    const errors = hubWith()
    await settle()
    errors.vis.set(true)
    errors.engines[0].fail('errors')
    errors.vis.set(false)
    expect(errors.engines).toHaveLength(2)

    for (const why of ['load', 'crash', 'start'] as const) {
      const other = hubWith()
      await settle()
      other.vis.set(true)
      other.engines[0].fail(why)
      other.vis.set(false)
      expect(other.engines).toHaveLength(1)
    }
  })

  it('says why its engine stopped', async () => {
    const { h, engines } = hubWith()
    expect(h.failure()).toBeNull()
    engines[0].fail('load')
    expect(h.failure()).toBe('load')
  })
})

describe('EngineHub Try again after an app update (M1)', () => {
  it('a worker that never started reloads the page once, to get this build’s files; after that it just starts a new engine', async () => {
    const reload = vi.fn().mockReturnValueOnce(true).mockReturnValue(false)
    const { h, engines } = hubWith({ reload })
    await settle()
    engines[0].fail('start')
    h.retry()
    expect(reload).toHaveBeenCalledTimes(1)
    expect(engines).toHaveLength(1)
    h.retry()
    expect(reload).toHaveBeenCalledTimes(2)
    expect(engines).toHaveLength(2)
  })

  it('any other failure just starts a new engine', async () => {
    const reload = vi.fn(() => true)
    const { h, engines } = hubWith({ reload })
    await settle()
    engines[0].fail('deadline')
    h.retry()
    expect(reload).not.toHaveBeenCalled()
    expect(engines).toHaveLength(2)
  })
})
