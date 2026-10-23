import { afterEach, describe, expect, it, vi } from 'vitest'
import { buildBook } from '../../src/book/build'
import { startPosition } from '../../src/book/setups'
import { parseGtp } from '../../src/go/coords'
import type { EngineSearch, WorkerRequest, WorkerResponse } from '../../src/engine/search'
import { createTeacherFromRunner } from '../../src/engine/teacher'
import { LOAD_TIMEOUT_MS, SEARCH_SLACK_MS, workerRunner } from '../../src/engine/workerRunner'
import { FIXTURE_FAMILY } from '../book/fixture'
import { FakeVisibility } from './fakeVisibility'

// The worker-backed runner with a fake Worker: message ids, failures, and the deadlines that keep a
// worker that never answers from wedging the engine.

class FakeWorker {
  onmessage: ((ev: { data: WorkerResponse }) => void) | null = null
  onerror: ((ev: { message: string; preventDefault?: () => void }) => void) | null = null
  onmessageerror: (() => void) | null = null
  posted: WorkerRequest[] = []
  terminated = false
  postMessage(msg: WorkerRequest) {
    this.posted.push(msg)
  }
  terminate() {
    this.terminated = true
  }
  answer(msg: WorkerResponse) {
    this.onmessage?.({ data: msg })
  }
  searchIds(): number[] {
    return this.posted.flatMap((m) => (m.type === 'search' ? [m.id] : []))
  }
}

const MODEL = 'https://example.test/go-to-d/models/net.bin.gz'

function setup(visibility = new FakeVisibility()) {
  const workers: FakeWorker[] = []
  const runner = workerRunner(MODEL, undefined, {
    createWorker: () => {
      const w = new FakeWorker()
      workers.push(w)
      return w as unknown as Worker
    },
    visibility,
  })
  const engine = createTeacherFromRunner(runner)
  return { runner, engine, worker: () => workers[0], visibility }
}

const start = () => startPosition(buildBook([FIXTURE_FAMILY]), 'star44', null, 0)

const SEARCH: EngineSearch = {
  rootScoreLead: 30,
  rootWinRate: 0.9,
  rootVisits: 100,
  moves: [
    { ...parseGtp('Q14'), scoreLead: 31, winRate: 0.9, prior: 0.4, visits: 60, order: 0 },
    { ...parseGtp('D10'), scoreLead: 29, winRate: 0.9, prior: 0.1, visits: 40, order: 1 },
  ],
}

/** Lets queued promise callbacks run (the engine posts a search only after a few awaits). */
const settle = () => vi.advanceTimersByTimeAsync(0)

afterEach(() => {
  vi.useRealTimers()
})

describe('workerRunner', () => {
  it('posts the model URL, then answers each search by its id', async () => {
    const { runner, engine, worker } = setup()
    expect(worker().posted[0]).toEqual({ type: 'load', modelUrl: MODEL, backend: undefined })
    worker().answer({ type: 'loaded', ok: true, backend: 'webgpu', model: 'net', note: null })
    await expect(engine.ready()).resolves.toEqual({ backend: 'webgpu', model: 'net' })

    const a = runner.search({ board: [], currentPlayer: 'black', moveHistory: [], komi: 0.5, maxTimeMs: 1000 })
    const b = runner.search({ board: [], currentPlayer: 'white', moveHistory: [], komi: 0.5, maxTimeMs: 1000 })
    const [idA, idB] = worker().searchIds()
    worker().answer({ type: 'searched', id: idB, ok: true, search: { ...SEARCH, rootScoreLead: -5 } })
    worker().answer({ type: 'searched', id: idA, ok: false, error: 'no legal move' })
    await expect(b).resolves.toMatchObject({ rootScoreLead: -5 })
    await expect(a).rejects.toThrow('no legal move')
    expect(engine.status()).toBe('ready')
  })

  it('a load error from the worker fails the engine', async () => {
    const { engine, worker } = setup()
    worker().answer({ type: 'loaded', ok: false, error: 'Failed to fetch model: 404' })
    await expect(engine.ready()).rejects.toThrow('404')
    expect(engine.status()).toBe('failed')
  })

  it('fails at once where there is no Worker', async () => {
    expect(typeof (globalThis as { Worker?: unknown }).Worker).toBe('undefined') // plain Node
    const engine = createTeacherFromRunner(workerRunner(MODEL, undefined))
    await expect(engine.ready()).rejects.toThrow('cannot run Web Workers')
    expect(engine.status()).toBe('failed')
  })

  it('a load that never answers fails the engine at the ceiling and stops the worker', async () => {
    vi.useFakeTimers()
    const { engine, worker } = setup()
    const ready = engine.ready().catch((e: Error) => e)
    await vi.advanceTimersByTimeAsync(LOAD_TIMEOUT_MS - 1)
    expect(engine.status()).toBe('loading')
    await vi.advanceTimersByTimeAsync(1)
    expect(await ready).toBeInstanceOf(Error)
    expect(engine.status()).toBe('failed')
    expect(worker().terminated).toBe(true)
  })

  it('a search that never answers fails the engine at its deadline, and the queue behind it drains', async () => {
    vi.useFakeTimers()
    const { engine, worker } = setup()
    worker().answer({ type: 'loaded', ok: true, backend: 'wasm', model: 'net', note: null })
    await engine.ready()
    const { pos, komi, region } = start()
    // The corner search is capped at 1000 ms (half the budget), so its deadline is 1000 + slack.
    const corner = engine.analyzeCorner(pos, komi, region, { visits: 50, maxTimeMs: 2000 }).catch((e: Error) => e)
    const behind = engine.scoreFor(pos, komi, 'black', { visits: 50 }).catch((e: Error) => e)
    await settle()
    expect(worker().searchIds()).toHaveLength(1)
    await vi.advanceTimersByTimeAsync(1000 + SEARCH_SLACK_MS - 1)
    expect(engine.status()).toBe('ready')
    await vi.advanceTimersByTimeAsync(1)
    expect(await corner).toBeInstanceOf(Error)
    expect(await behind).toBeInstanceOf(Error)
    expect(engine.status()).toBe('failed')
    expect(worker().terminated).toBe(true)
    expect(worker().searchIds()).toHaveLength(1) // the queued search never reached the dead worker
    await expect(engine.analyzeCorner(pos, komi, region)).rejects.toThrow()
  })

  it('an answer in time clears the deadline', async () => {
    vi.useFakeTimers()
    const { engine, worker } = setup()
    worker().answer({ type: 'loaded', ok: true, backend: 'wasm', model: 'net', note: null })
    await engine.ready()
    const { pos, komi } = start()
    const score = engine.scoreFor(pos, komi, 'black', { visits: 50 })
    await settle()
    worker().answer({ type: 'searched', id: worker().searchIds()[0], ok: true, search: SEARCH })
    await expect(score).resolves.toBe(30)
    await vi.advanceTimersByTimeAsync(10 * 60 * 1000)
    expect(engine.status()).toBe('ready')
    expect(worker().terminated).toBe(false)
  })

  it('a worker crash fails the engine and rejects what is pending', async () => {
    const { runner, engine, worker } = setup()
    worker().answer({ type: 'loaded', ok: true, backend: 'wasm', model: 'net', note: null })
    await engine.ready()
    const a = runner.search({ board: [], currentPlayer: 'black', moveHistory: [], komi: 0.5, maxTimeMs: 1000 })
    worker().onerror?.({ message: 'out of memory' })
    await expect(a).rejects.toThrow('out of memory')
    expect(engine.status()).toBe('failed')
    expect(worker().terminated).toBe(true)
  })

  it('dispose stops the worker; the engine is failed and calls reject', async () => {
    const { engine, worker } = setup()
    worker().answer({ type: 'loaded', ok: true, backend: 'wasm', model: 'net', note: null })
    await engine.ready()
    engine.dispose()
    expect(worker().terminated).toBe(true)
    expect(engine.status()).toBe('failed')
    const { pos, komi, region } = start()
    await expect(engine.analyzeCorner(pos, komi, region)).rejects.toThrow()
  })
})

describe('workerRunner while the page is hidden (R41)', () => {
  it('a search’s deadline stops while the owner is in another app, and the answer after coming back counts', async () => {
    vi.useFakeTimers()
    const { engine, worker, visibility } = setup()
    worker().answer({ type: 'loaded', ok: true, backend: 'wasm', model: 'net', note: null })
    await engine.ready()
    const { pos, komi } = start()
    const score = engine.scoreFor(pos, komi, 'black', { visits: 50 })
    await settle()
    await vi.advanceTimersByTimeAsync(500)
    visibility.set(true)
    await vi.advanceTimersByTimeAsync(10 * 60_000)
    expect(engine.status()).toBe('ready')
    visibility.set(false)
    // The worker wakes up with the page and answers: the deadline didn't go off meanwhile.
    worker().answer({ type: 'searched', id: worker().searchIds()[0], ok: true, search: SEARCH })
    await expect(score).resolves.toBe(30)
    expect(engine.status()).toBe('ready')
    expect(worker().terminated).toBe(false)
  })

  it('…and still goes off with the time it had left when the worker never answers', async () => {
    vi.useFakeTimers()
    const { engine, worker, visibility } = setup()
    worker().answer({ type: 'loaded', ok: true, backend: 'wasm', model: 'net', note: null })
    await engine.ready()
    const { pos, komi } = start()
    const score = engine.scoreFor(pos, komi, 'black', { visits: 50 }).catch((e: Error) => e)
    await settle()
    // scoreFor's search is capped at 1000 ms, so its deadline is 1000 + slack.
    await vi.advanceTimersByTimeAsync(1000)
    visibility.set(true)
    await vi.advanceTimersByTimeAsync(10 * 60_000)
    visibility.set(false)
    await vi.advanceTimersByTimeAsync(SEARCH_SLACK_MS - 1)
    expect(engine.status()).toBe('ready')
    await vi.advanceTimersByTimeAsync(1)
    expect(await score).toBeInstanceOf(Error)
    expect(engine.status()).toBe('failed')
    expect(engine.failure?.()).toBe('deadline')
  })

  it('the load ceiling stops too while the page is hidden', async () => {
    vi.useFakeTimers()
    const { engine, worker, visibility } = setup()
    await vi.advanceTimersByTimeAsync(LOAD_TIMEOUT_MS - 10_000)
    visibility.set(true)
    await vi.advanceTimersByTimeAsync(10 * 60_000)
    visibility.set(false)
    await vi.advanceTimersByTimeAsync(9_000)
    expect(engine.status()).toBe('loading')
    worker().answer({ type: 'loaded', ok: true, backend: 'wasm', model: 'net', note: null })
    await expect(engine.ready()).resolves.toMatchObject({ backend: 'wasm' })
  })
})

describe('why the engine stopped', () => {
  it('says deadline, start, crash, load or disposed', async () => {
    vi.useFakeTimers()
    const late = setup()
    await vi.advanceTimersByTimeAsync(LOAD_TIMEOUT_MS)
    expect(late.engine.failure?.()).toBe('deadline')

    // An error before the worker said anything: its file didn't load (gone after an app update, M1).
    const start = setup()
    start.worker().onerror?.({ message: '' })
    await start.engine.ready().catch(() => {})
    expect(start.engine.failure?.()).toBe('start')

    const crash = setup()
    crash.worker().answer({ type: 'loaded', ok: true, backend: 'wasm', model: 'net', note: null })
    await crash.engine.ready()
    crash.worker().onerror?.({ message: 'out of memory' })
    expect(crash.engine.failure?.()).toBe('crash')

    const load = setup()
    load.worker().answer({ type: 'loaded', ok: false, error: 'Failed to fetch model: 404' })
    await load.engine.ready().catch(() => {})
    expect(load.engine.failure?.()).toBe('load')

    const gone = setup()
    gone.worker().answer({ type: 'loaded', ok: true, backend: 'wasm', model: 'net', note: null })
    await gone.engine.ready()
    expect(gone.engine.failure?.()).toBeNull()
    gone.engine.dispose()
    expect(gone.engine.failure?.()).toBe('disposed')
  })

  it('an engine that answers every search with an error stops after three in a row (M2)', async () => {
    const { engine, worker } = setup()
    worker().answer({ type: 'loaded', ok: true, backend: 'webgpu', model: 'net', note: null })
    await engine.ready()
    const { pos, komi } = start()
    const failOne = async (visits: number) => {
      const n = worker().searchIds().length
      const p = engine.scoreFor(pos, komi, 'black', { visits }).catch((e: Error) => e)
      await vi.waitFor(() => expect(worker().searchIds()).toHaveLength(n + 1))
      const id = worker().searchIds()[n]
      worker().answer({ type: 'searched', id, ok: false, error: 'GPU device was lost' })
      return p
    }
    await failOne(11)
    await failOne(12)
    // A good answer in between starts the count again.
    const ok = engine.scoreFor(pos, komi, 'black', { visits: 13 })
    await vi.waitFor(() => expect(worker().searchIds()).toHaveLength(3))
    worker().answer({ type: 'searched', id: worker().searchIds()[2], ok: true, search: SEARCH })
    await ok
    await failOne(14)
    await failOne(15)
    expect(engine.status()).toBe('ready')
    await failOne(16)
    expect(engine.status()).toBe('failed')
    expect(engine.failure?.()).toBe('errors')
    expect(worker().terminated).toBe(true)
  })
})

describe('teacher.worker message pump', () => {
  it('answers a message whose result cannot be posted with an error, and keeps answering', async () => {
    vi.resetModules()
    vi.doMock('../../src/engine/katago/engine', () => ({
      loadKataGoModel: vi.fn(async () => ({ backend: 'wasm', modelName: 'net', backendNote: null })),
      analyzeKataGo: vi.fn(async () => ({ rootScoreLead: 1, rootWinRate: 0.5, rootVisits: 16, moves: [] })),
    }))
    const sent: WorkerResponse[] = []
    let failNext = true
    const scope: { onmessage: ((ev: { data: WorkerRequest }) => void) | null; postMessage: (m: WorkerResponse) => void } = {
      onmessage: null,
      postMessage(m) {
        if (failNext) {
          failNext = false
          throw new Error('DataCloneError')
        }
        sent.push(m)
      },
    }
    vi.stubGlobal('self', scope)
    try {
      await import('../../src/engine/teacher.worker')
      const req = { board: [], currentPlayer: 'black' as const, moveHistory: [], komi: 0.5 }
      scope.onmessage?.({ data: { type: 'search', id: 1, req } })
      scope.onmessage?.({ data: { type: 'search', id: 2, req } })
      await vi.waitFor(() => expect(sent).toHaveLength(2))
      expect(sent[0]).toMatchObject({ type: 'searched', id: 1, ok: false })
      expect(sent[1]).toMatchObject({ type: 'searched', id: 2, ok: true })
    } finally {
      vi.unstubAllGlobals()
      vi.doUnmock('../../src/engine/katago/engine')
    }
  })
})
