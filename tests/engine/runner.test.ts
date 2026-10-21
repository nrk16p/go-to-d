import { describe, expect, it, vi } from 'vitest'
import { buildBook } from '../../src/book/build'
import { startPosition } from '../../src/book/setups'
import { parseGtp } from '../../src/go/coords'
import type { KataGoAnalyzeRequest } from '../../src/engine/katago/types'
import { DEFAULT_MAX_TIME_MS } from '../../src/engine/model'
import { createTeacherFromRunner, type EngineSearch, type SearchRunner } from '../../src/engine/teacher'
import { FIXTURE_FAMILY } from '../book/fixture'

// The TeacherEngine logic on a fake engine: no network, no TF.js.

const start = () => startPosition(buildBook([FIXTURE_FAMILY]), 'star44', null, 0)

/** Black leads by 30; Q14 is the corner move, D10 the move elsewhere. */
function fakeSearch(req: KataGoAnalyzeRequest): EngineSearch {
  const q14 = parseGtp('Q14')
  const d10 = parseGtp('D10')
  return {
    rootScoreLead: 30,
    rootWinRate: 0.9,
    rootVisits: req.visits ?? 0,
    moves: req.regionOfInterest
      ? [{ ...q14, scoreLead: 31, winRate: 0.9, prior: 0.4, visits: 10, order: 0 }]
      : [
          { ...q14, scoreLead: 31, winRate: 0.9, prior: 0.4, visits: 10, order: 0 },
          { ...d10, scoreLead: 29, winRate: 0.9, prior: 0.1, visits: 5, order: 1 },
        ],
  }
}

function fakeRunner(
  opts: {
    load?: Promise<{ backend: string; model: string }>
    searchMs?: number
    /** Visits a search ends with; default: all it was asked for. Fewer means the time cap stopped it. */
    rootVisits?: number
  } = {},
) {
  const calls: KataGoAnalyzeRequest[] = []
  let running = 0
  let maxRunning = 0
  let crash: (err: Error) => void = () => {}
  const runner: SearchRunner = {
    load(onCrash) {
      crash = onCrash
      return opts.load ?? Promise.resolve({ backend: 'fake', model: 'fake-net' })
    },
    async search(req) {
      calls.push(req)
      running++
      maxRunning = Math.max(maxRunning, running)
      await new Promise((r) => setTimeout(r, opts.searchMs ?? 5))
      running--
      const s = fakeSearch(req)
      return opts.rootVisits === undefined ? s : { ...s, rootVisits: opts.rootVisits }
    },
  }
  return { runner, calls, maxRunning: () => maxRunning, crash: (e: Error) => crash(e) }
}

describe('createTeacherFromRunner', () => {
  it('is loading, then ready with what the runner loaded', async () => {
    let resolve!: (v: { backend: string; model: string }) => void
    const f = fakeRunner({ load: new Promise((r) => (resolve = r)) })
    const engine = createTeacherFromRunner(f.runner)
    expect(engine.status()).toBe('loading')
    resolve({ backend: 'wasm', model: 'net' })
    await expect(engine.ready()).resolves.toEqual({ backend: 'wasm', model: 'net' })
    expect(engine.status()).toBe('ready')
  })

  it('fails when loading fails, and every call rejects', async () => {
    const f = fakeRunner({ load: Promise.reject(new Error('no WebGPU, no WASM')) })
    const engine = createTeacherFromRunner(f.runner)
    await expect(engine.ready()).rejects.toThrow('no WebGPU, no WASM')
    expect(engine.status()).toBe('failed')
    const { pos, komi, region } = start()
    await expect(engine.analyzeCorner(pos, komi, region)).rejects.toThrow()
    expect(f.calls).toHaveLength(0)
  })

  it('fails when the runner throws while starting', async () => {
    const engine = createTeacherFromRunner({
      load() {
        throw new Error('no Worker')
      },
      search: () => Promise.reject(new Error('unreachable')),
    })
    await expect(engine.ready()).rejects.toThrow('no Worker')
    expect(engine.status()).toBe('failed')
  })

  it('goes to failed when the engine crashes after loading', async () => {
    const f = fakeRunner()
    const engine = createTeacherFromRunner(f.runner)
    await engine.ready()
    f.crash(new Error('worker died'))
    expect(engine.status()).toBe('failed')
    const { pos, komi, region } = start()
    await expect(engine.analyzeCorner(pos, komi, region)).rejects.toThrow()
  })

  it('analyzeCorner runs a corner search and a whole-board search with the teacher settings', async () => {
    const f = fakeRunner()
    const engine = createTeacherFromRunner(f.runner)
    const { pos, komi, region } = start()
    const a = await engine.analyzeCorner(pos, komi, region, { visits: 50, maxTimeMs: 2000 })
    expect(a).toEqual({
      toMove: 'white',
      cornerBest: { pt: parseGtp('Q14'), scoreLead: -31 },
      tenukiBest: { pt: parseGtp('D10'), scoreLead: -29 },
      candidates: [{ pt: parseGtp('Q14'), scoreLead: -31, prior: 0.4 }],
    })
    expect(f.calls).toHaveLength(2)
    const [corner, anywhere] = f.calls
    expect(corner.regionOfInterest).toEqual(region)
    expect(anywhere.regionOfInterest).toBeNull()
    for (const c of f.calls) {
      expect(c).toMatchObject({ visits: 50, komi, rules: 'chinese', currentPlayer: 'white', wideRootNoise: 0 })
    }
    // The corner search gets half the budget; the whole-board search gets what is left.
    expect(corner.maxTimeMs).toBe(1000)
    expect(anywhere.maxTimeMs).toBeGreaterThan(900)
    expect(anywhere.maxTimeMs).toBeLessThanOrEqual(2000)
  })

  it('a corner search that overruns its half of the budget leaves less for the whole-board search', async () => {
    // Each search takes 600 ms; the corner search was given 500, so it overran by 100 and the
    // whole-board search is expected to overrun as much: 1000 - 600 - 100 = 300 ms left for it.
    const f = fakeRunner({ searchMs: 600 })
    const engine = createTeacherFromRunner(f.runner)
    const { pos, komi, region } = start()
    await engine.analyzeCorner(pos, komi, region, { visits: 50, maxTimeMs: 1000 })
    expect(f.calls[0].maxTimeMs).toBe(500)
    expect(f.calls[1].maxTimeMs).toBeGreaterThanOrEqual(100)
    expect(f.calls[1].maxTimeMs).toBeLessThanOrEqual(320)
  })

  it('never runs two searches at once', async () => {
    const f = fakeRunner()
    const engine = createTeacherFromRunner(f.runner)
    const { pos, komi, region } = start()
    await Promise.all([
      engine.analyzeCorner(pos, komi, region, { visits: 20 }),
      engine.analyzeCorner(pos, komi, region, { visits: 30 }),
      engine.scoreFor(pos, komi, 'white', { visits: 40 }),
    ])
    expect(f.maxRunning()).toBe(1)
  })

  it('scoreFor and a following analyzeCorner on the same position share the whole-board search', async () => {
    const f = fakeRunner()
    const engine = createTeacherFromRunner(f.runner)
    const { pos, komi, region } = start()
    expect(await engine.scoreFor(pos, komi, 'black', { visits: 64 })).toBe(30)
    expect(await engine.scoreFor(pos, komi, 'white', { visits: 64 })).toBe(-30)
    expect(f.calls).toHaveLength(1)
    const a = await engine.analyzeCorner(pos, komi, region, { visits: 64, maxTimeMs: 2000 })
    expect(a.tenukiBest?.pt).toEqual(parseGtp('D10'))
    expect(f.calls).toHaveLength(2)
    // scoreFor took half of the default budget, the corner search takes the other half: after an
    // off-book move the controller calls scoreFor then analyzeCorner, and the pair is one answer.
    expect(f.calls[0].maxTimeMs).toBe(DEFAULT_MAX_TIME_MS / 2)
    expect(f.calls[1].maxTimeMs).toBe(1000)
    // A different komi or visit count is a different search.
    await engine.scoreFor(pos, komi + 1, 'black', { visits: 64 })
    await engine.scoreFor(pos, komi, 'black', { visits: 65 })
    expect(f.calls).toHaveLength(4)
  })

  it('scoreFor does not reuse a whole-board search that a smaller time cap cut short', async () => {
    // analyzeCorner first: its whole-board search got only what was left (the floor, 100 ms) and
    // stopped at 5 of 50 visits. scoreFor wants half the default budget, so it searches again.
    const f = fakeRunner({ searchMs: 300, rootVisits: 5 })
    const engine = createTeacherFromRunner(f.runner)
    const { pos, komi, region } = start()
    await engine.analyzeCorner(pos, komi, region, { visits: 50, maxTimeMs: 400 })
    expect(f.calls[1].maxTimeMs).toBe(100)
    await engine.scoreFor(pos, komi, 'black', { visits: 50 })
    expect(f.calls).toHaveLength(3)
    expect(f.calls[2].maxTimeMs).toBe(DEFAULT_MAX_TIME_MS / 2)
  })

  it('scoreFor reuses a whole-board search with a smaller cap when it finished all its visits', async () => {
    const f = fakeRunner()
    const engine = createTeacherFromRunner(f.runner)
    const { pos, komi, region } = start()
    await engine.analyzeCorner(pos, komi, region, { visits: 50, maxTimeMs: 400 })
    await engine.scoreFor(pos, komi, 'black', { visits: 50 })
    expect(f.calls).toHaveLength(2)
  })

  it('dispose stops the runner and fails the engine; calls reject after it', async () => {
    const f = fakeRunner()
    const stop = vi.fn()
    const engine = createTeacherFromRunner({ ...f.runner, dispose: stop })
    await engine.ready()
    engine.dispose()
    expect(stop).toHaveBeenCalledOnce()
    expect(engine.status()).toBe('failed')
    const { pos, komi, region } = start()
    await expect(engine.analyzeCorner(pos, komi, region)).rejects.toThrow()
    expect(f.calls).toHaveLength(0)
  })

  it('dispose is fine on a runner with nothing to stop (the in-process engine)', async () => {
    const engine = createTeacherFromRunner(fakeRunner().runner)
    await engine.ready()
    expect(() => engine.dispose()).not.toThrow()
  })
})
