import { afterEach, describe, expect, it, vi } from 'vitest'
import { buildBook } from '../../src/book/build'
import { startPosition } from '../../src/book/setups'
import { parseGtp, transform, type Sym } from '../../src/go/coords'
import { play, type Position } from '../../src/go/rules'
import { ask, ENGINE_TIMEOUT_MS, EngineAccess, timed } from '../../src/session/engineAccess'
import { FIXTURE_FAMILY } from '../book/fixture'
import { analysisOf, defaultAnalysis, FakeEngine } from './fakeEngine'

const BOOK = buildBook([FIXTURE_FAMILY])
const start = (sym: Sym = 0) => startPosition(BOOK, 'star44', 'fixture-hane', sym)

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('timed', () => {
  it('passes the value through, and turns a rejection into null', async () => {
    expect(await timed(Promise.resolve(3), 'x')).toBe(3)
    const p = Promise.reject(new Error('no'))
    p.catch(() => {})
    expect(await timed(p, 'x')).toBeNull()
  })

  it(`gives null and a warning after ${ENGINE_TIMEOUT_MS} ms`, async () => {
    vi.useFakeTimers()
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const r = timed(new Promise<number>(() => {}), 'scoreFor')
    await vi.advanceTimersByTimeAsync(ENGINE_TIMEOUT_MS)
    expect(await r).toBeNull()
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('scoreFor took longer'))
  })
})

describe('ask', () => {
  it('turns a throw into a logged rejection that nobody has to catch', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const p = ask('analyzeCorner', () => {
      throw new Error('boom')
    })
    expect(await timed(p, 'analyzeCorner')).toBeNull()
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('analyzeCorner failed'), expect.any(Error))
  })
})

describe('EngineAccess', () => {
  function slow() {
    const pending: Array<() => void> = []
    const engine = new FakeEngine({
      analyze: (pos, _komi, region) => new Promise((r) => pending.push(() => r(defaultAnalysis(pos, region)))),
    })
    return { engine, pending }
  }
  const after = (pos: Position, gtp: string) => {
    const r = play(pos, parseGtp(gtp), pos.toMove)
    if ('illegal' in r) throw new Error(gtp)
    return r.pos
  }

  it('runs one look-ahead at a time; the newest waiting one runs next if still current, older ones are dropped', async () => {
    const { engine, pending } = slow()
    const { pos, region } = start()
    const p1 = after(pos, 'R14')
    const p2 = after(p1, 'Q14')
    const p3 = after(p2, 'Q13')
    let current: Position = p3
    const acc = new EngineAccess(engine, 4.5, region, 0, (p) => p === current)
    acc.lookAhead(p1)
    acc.lookAhead(p2)
    acc.lookAhead(p3)
    expect(engine.analyzeCalls.map((c) => c.pos)).toEqual([p1])
    pending.shift()!()
    await vi.waitFor(() => expect(engine.analyzeCalls).toHaveLength(2))
    expect(engine.analyzeCalls[1].pos).toBe(p3)
    expect(engine.analyzeCalls[1].komi).toBe(4.5)

    // A queued look-ahead whose position has gone is not run.
    acc.lookAhead(p2)
    current = p1
    pending.shift()!()
    await new Promise((r) => setTimeout(r, 0))
    expect(engine.analyzeCalls).toHaveLength(2)
  })

  it('an analysis that is needed now starts at once, and reuses a look-ahead of the same position', async () => {
    const { engine, pending } = slow()
    const { pos, region } = start()
    const p1 = after(pos, 'R14')
    const p2 = after(p1, 'Q14')
    const acc = new EngineAccess(engine, 4.5, region, 0, () => true)
    acc.lookAhead(p1)
    acc.lookAhead(p2)
    const now = acc.analysis(p2)
    expect(engine.analyzeCalls.map((c) => c.pos)).toEqual([p1, p2])
    pending.forEach((go) => go())
    expect((await now)?.toMove).toBe(p2.toMove)
    // The queued look-ahead of p2 was taken by the request, so it isn't run again.
    await new Promise((r) => setTimeout(r, 0))
    expect(engine.analyzeCalls).toHaveLength(2)
    await acc.analysis(p2)
    expect(engine.analyzeCalls).toHaveLength(2)
  })

  it('asks nothing while the engine is not ready', async () => {
    const engine = new FakeEngine({ status: 'loading' })
    const { pos, region } = start()
    const acc = new EngineAccess(engine, 4.5, region, 0, () => true)
    acc.lookAhead(pos)
    expect(await acc.analysis(pos)).toBeNull()
    expect(await acc.score(pos, 'white')).toBeNull()
    expect(engine.analyzeCalls).toHaveLength(0)
    expect(engine.scoreCalls).toHaveLength(0)
  })

  it('a tenuki goes to the engine’s point, else the first free big point under the symmetry', () => {
    const sym: Sym = 3
    const { pos, region } = start(sym)
    const acc = new EngineAccess(new FakeEngine(), 4.5, region, sym, () => true)
    const k4 = analysisOf('white', [['A19', 0]], ['K4', 0])
    expect(acc.tenukiPoint(pos, k4, 'white')).toEqual(parseGtp('K4'))
    const d10 = transform(parseGtp('D10'), sym)
    expect(acc.tenukiPoint(pos, null, 'white')).toEqual(d10)
    // D10 taken: the next big point.
    const taken = play(pos, d10, 'white')
    if ('illegal' in taken) throw new Error('D10')
    expect(acc.tenukiPoint(taken.pos, null, 'black')).toEqual(transform(parseGtp('K4'), sym))
  })
})
