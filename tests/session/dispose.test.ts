// SparController.dispose(): the screen went away, so the session stops asking the engine and changing.

import { describe, expect, it, vi } from 'vitest'
import { buildBook } from '../../src/book/build'
import { parseGtp } from '../../src/go/coords'
import { SparController } from '../../src/session/controller'
import { DEFAULT_THRESHOLDS } from '../../src/session/judge'
import { FIXTURE_FAMILY } from '../book/fixture'
import { defaultAnalysis, FakeEngine } from './fakeEngine'

const BOOK = buildBook([FIXTURE_FAMILY])

function make(engine: FakeEngine) {
  return new SparController(BOOK, engine, {
    mode: 'drill',
    family: 'star44',
    patternId: 'fixture-hane',
    side: 'defend',
    sym: 0,
    seed: 1,
    thresholds: DEFAULT_THRESHOLDS,
    missed: new Set(),
  })
}

const flush = () => new Promise((r) => setTimeout(r, 0))

describe('SparController.dispose', () => {
  it('drops an engine answer still on its way and asks the engine nothing more', async () => {
    let release!: () => void
    const gate = new Promise<void>((r) => (release = r))
    const engine = new FakeEngine({
      analyze: async (pos, _komi, region) => {
        await gate
        return defaultAnalysis(pos, region)
      },
      score: () => -10,
    })
    const c = make(engine)
    await c.start()
    expect(c.state.status).toBe('owner-to-move')

    const judging = c.ownerPlay(parseGtp('S12')) // off the book: judged by the engine
    await flush()
    expect(c.state.status).toBe('teacher-thinking')
    const listener = vi.fn()
    c.subscribe(listener)
    const frozen = c.state
    const asked = engine.analyzeCalls.length + engine.scoreCalls.length
    c.dispose()
    release()
    await judging
    await flush()

    expect(c.state).toBe(frozen)
    expect(engine.analyzeCalls.length + engine.scoreCalls.length).toBe(asked)
    expect(listener).not.toHaveBeenCalled()
  })

  it('makes every later call do nothing', async () => {
    const c = make(new FakeEngine())
    await c.start()
    const before = c.state
    c.dispose()
    c.dispose()
    await c.ownerPlay(parseGtp('Q14'))
    await c.start()
    c.retry()
    await c.playOn()
    expect(c.switchTo('fixture-crawl')).toBeNull()
    expect(c.state).toBe(before)
  })
})
