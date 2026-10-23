import { afterEach, describe, expect, it, vi } from 'vitest'
import { buildBook } from '../../src/book/build'
import { BOOK as REAL_BOOK } from '../../src/book/data'
import type { Book, FamilyDef, FamilyId } from '../../src/book/types'
import type { TeacherEngine } from '../../src/engine/teacher'
import {
  BOARD_REGION,
  CORNER_REGION,
  isWholeBoard,
  parseGtp,
  toGtp,
  transform,
  transformRegion,
  type Pt,
  type Sym,
} from '../../src/go/coords'
import { ENGINE_TIMEOUT_MS, SparController, type SparState } from '../../src/session/controller'
import { DEFAULT_THRESHOLDS } from '../../src/session/judge'
import { orientNote } from '../../src/session/orient'
import { drillableSides } from '../../src/session/sides'
import { FIXTURE_FAMILY } from '../book/fixture'
import { analysisOf, defaultAnalysis, FakeEngine } from './fakeEngine'

// Fixture lines (canonical frame, White moves first, corner stone Black on Q16):
//   fixture-hane     W R14, B Q14, W Q13, B P13, W R13   (mistake: B R13 after W Q13, punished by W R12, B S13)
//   fixture-crawl    W R14, B Q14, W R13, B Q13, W R12   (mistake: W T19 after B Q14; B S19, W R13, B T18 captures)
//   fixture-tenuki   W R14, B Q14, W tenuki, B R13, W R15

const BOOK = buildBook([FIXTURE_FAMILY])

type Config = ConstructorParameters<typeof SparController>[2]

function make(over: Partial<Config> = {}, engine: TeacherEngine = new FakeEngine(), book: Book = BOOK): SparController {
  return new SparController(book, engine, {
    mode: 'drill',
    family: 'star44',
    patternId: 'fixture-hane',
    side: 'defend',
    sym: 0,
    seed: 1,
    thresholds: DEFAULT_THRESHOLDS,
    missed: new Set(),
    ...over,
  })
}

/** A canonical GTP point on the board under `sym`. */
const at = (gtp: string, sym: Sym = 0): Pt => transform(parseGtp(gtp), sym)
const stoneAt = (c: SparController, gtp: string, sym: Sym = 0) => {
  const p = at(gtp, sym)
  return c.state.pos.board[p.y][p.x]
}
const ownerMoves = (s: SparState) => s.log.filter((e) => e.by === 'owner')
/** The log as "W R14" strings in the board frame; tenuki entries read "W tenuki". */
const moves = (s: SparState) =>
  s.log.map((e) =>
    'tenuki' in e.move
      ? `${e.move.tenuki === 'black' ? 'B' : 'W'} tenuki`
      : `${e.move.player === 'black' ? 'B' : 'W'} ${toGtp(e.move)}`,
  )

afterEach(() => {
  vi.useRealTimers()
})

describe('SparController: a clean drill', () => {
  it.each([0, 1, 2, 5] as Sym[])('defend side under sym %i: teacher starts, owner follows the book, done at the leaf', async (sym) => {
    const engine = new FakeEngine()
    const c = make({ sym }, engine)
    expect(c.state.region).toEqual(transformRegion(CORNER_REGION, sym))
    expect(c.state.komi).toBe(0.5)

    await c.start()
    expect(c.state.status).toBe('owner-to-move')
    expect(stoneAt(c, 'R14', sym)).toBe('white')
    expect(c.state.note).toBe(orientNote('Low approach from the side, a knight’s move from the 4-4 stone.', sym))

    await c.ownerPlay(at('Q14', sym))
    expect(c.state.lastVerdict).toEqual({
      type: 'good',
      kind: 'joseki',
      note: orientNote('Attach on the inside so White cannot settle for free.', sym),
    })
    expect(stoneAt(c, 'Q13', sym)).toBe('white')
    expect(c.state.status).toBe('owner-to-move')

    await c.ownerPlay(at('P13', sym))
    expect(stoneAt(c, 'R13', sym)).toBe('white')
    expect(c.state.status).toBe('done')
    expect(c.state.node?.key).toBe('W:R14/B:Q14/W:Q13/B:P13/W:R13')
    expect(c.state.log).toHaveLength(5)
    expect(ownerMoves(c.state).every((e) => e.verdict?.type === 'good')).toBe(true)
    expect(c.state.result).toEqual({
      patternIds: ['fixture-hane'],
      side: 'defend',
      clean: true,
      mistakes: 0,
      pointsLost: 0,
      missedKeys: [],
    })
    // Notes follow the board: "R13" in the book is N17 under sym 5.
    if (sym === 5) expect((c.state.log[3].verdict as { note: string }).note).toContain('N17')
  })

  it('attack side: the owner moves first and ends the line', async () => {
    const c = make({ side: 'attack', sym: 2 })
    await c.start()
    expect(c.state.status).toBe('owner-to-move')
    expect(c.state.log).toEqual([])
    await c.ownerPlay(at('R14', 2))
    await c.ownerPlay(at('Q13', 2))
    await c.ownerPlay(at('R13', 2))
    expect(moves(c.state)).toEqual(['W R14', 'B Q14', 'W Q13', 'B P13', 'W R13'].map((m) => {
      const [col, gtp] = m.split(' ')
      return `${col} ${toGtp(at(gtp, 2))}`
    }))
    expect(c.state.status).toBe('done')
    expect(c.state.result).toMatchObject({ patternIds: ['fixture-hane'], side: 'attack', clean: true })
  })

  it('ignores ownerPlay before start()', async () => {
    const c = make({ side: 'attack' })
    await c.ownerPlay(at('R14'))
    expect(c.state.log).toEqual([])
  })

  it('tells subscribers about every change until they unsubscribe', async () => {
    const c = make()
    const seen: string[] = []
    const off = c.subscribe((s) => seen.push(s.status))
    await c.start()
    expect(seen).toContain('owner-to-move')
    off()
    const n = seen.length
    await c.ownerPlay(at('Q14'))
    expect(seen).toHaveLength(n)
  })
})

describe('SparController: mistakes, retry and play on', () => {
  it.each([0, 3, 5] as Sym[])('a book mistake stops play; retry restores the position; play on runs the punishment (sym %i)', async (sym) => {
    const c = make({ sym }, new FakeEngine({ score: () => -3 }))
    await c.start()
    await c.ownerPlay(at('Q14', sym))
    const before = c.state

    await c.ownerPlay(at('R13', sym))
    expect(c.state.status).toBe('stopped')
    expect(stoneAt(c, 'R13', sym)).toBe('black')
    expect(c.state.lastVerdict).toEqual({
      type: 'mistake',
      inBook: true,
      better: at('P13', sym),
      pointsLost: 3,
      big: false,
      note: orientNote('Cutting too early. The stone has two liberties and White can chase it.', sym),
    })
    // Not allowed while stopped.
    await c.ownerPlay(at('S12', sym))
    expect(ownerMoves(c.state)).toHaveLength(2)

    c.retry()
    expect(c.state.pos).toBe(before.pos)
    expect(c.state.node).toBe(before.node)
    expect(c.state.log).toBe(before.log)
    expect(c.state.offBookMoves).toBe(before.offBookMoves)
    expect(c.state.status).toBe('owner-to-move')
    expect(c.state.lastVerdict).toBeNull()

    await c.ownerPlay(at('R13', sym))
    expect(c.state.status).toBe('stopped')
    await c.playOn()
    expect(stoneAt(c, 'R12', sym)).toBe('white')
    expect(c.state.node?.key).toBe('W:R14/B:Q14/W:Q13/B:R13/W:R12')
    expect(c.state.status).toBe('owner-to-move')

    await c.ownerPlay(at('S13', sym))
    expect(c.state.status).toBe('done')
    expect(c.state.result).toEqual({
      patternIds: ['fixture-hane'],
      side: 'defend',
      clean: false,
      // The same mistake in the same position, retried: counted once, with the points from the first time.
      mistakes: 1,
      pointsLost: 3,
      missedKeys: ['W:R14/B:Q14/W:Q13'],
    })
  })

  it('play on after the 1-1 poke: the teacher captures and the session ends at the leaf', async () => {
    const c = make({ side: 'attack', patternId: 'fixture-crawl' })
    await c.start()
    await c.ownerPlay(at('R14'))
    await c.ownerPlay(at('T19'))
    expect(c.state.lastVerdict).toMatchObject({ type: 'mistake', inBook: true, better: at('R13') })
    await c.playOn()
    expect(stoneAt(c, 'S19')).toBe('black')
    await c.ownerPlay(at('R13'))
    expect(c.state.lastVerdict?.type).toBe('good')
    expect(stoneAt(c, 'T18')).toBe('black')
    expect(stoneAt(c, 'T19')).toBeNull()
    expect(c.state.status).toBe('done')
    expect(c.state.result).toMatchObject({ clean: false, mistakes: 1, missedKeys: ['W:R14/B:Q14'] })
  })

  it('retry and playOn do nothing unless play is stopped', async () => {
    const c = make()
    await c.start()
    const s = c.state
    c.retry()
    await c.playOn()
    expect(c.state).toBe(s)
  })
})

describe('SparController: other joseki in a drill', () => {
  it('stops without a penalty; retry goes back, switchTo restarts as a drill of the other pattern', async () => {
    const c = make({ side: 'attack', sym: 5 })
    await c.start()
    await c.ownerPlay(at('R14', 5))
    const before = c.state
    await c.ownerPlay(at('R13', 5))
    expect(c.state.status).toBe('stopped')
    expect(c.state.lastVerdict).toEqual({
      type: 'other-joseki',
      patternIds: ['fixture-crawl'],
      note: orientNote('Extend down the side and keep the stones together.', 5),
    })

    // Play on is for mistakes only: here the choice is Retry or Switch.
    await c.playOn()
    expect(c.state.status).toBe('stopped')
    expect(c.state.log).toHaveLength(3)

    c.retry()
    expect(c.state.pos).toBe(before.pos)
    expect(c.state.log).toBe(before.log)

    await c.ownerPlay(at('R13', 5))
    // Switching after another joseki carries no penalty: nothing to record (spec 1b, R27).
    expect(c.switchTo('fixture-crawl')).toBeNull()
    await vi.waitFor(() => expect(c.state.status).toBe('owner-to-move'))
    expect(c.state.log).toEqual([])
    expect(c.state.lastVerdict).toBeNull()
    expect(stoneAt(c, 'R14', 5)).toBeNull()

    await c.ownerPlay(at('R14', 5))
    await c.ownerPlay(at('R13', 5))
    expect(c.state.lastVerdict?.type).toBe('good')
    await c.ownerPlay(at('R12', 5))
    expect(c.state.status).toBe('done')
    expect(c.state.result).toMatchObject({ patternIds: ['fixture-crawl'], side: 'attack', clean: true, mistakes: 0 })
  })

  it.each(['judging the owner’s move', 'the teacher’s answer'])('switchTo while the engine works on %s drops the old result', async (phase) => {
    let release = () => {}
    const gate = new Promise<void>((r) => (release = r))
    let waiting = false
    const engine = new FakeEngine({
      analyze: async (pos, _komi, region) => {
        if (phase === 'the teacher’s answer' && pos.toMove === 'white') {
          waiting = true
          await gate
        }
        return defaultAnalysis(pos, region)
      },
      score: async () => {
        if (phase === 'judging the owner’s move') {
          waiting = true
          await gate
        }
        return 0
      },
    })
    const c = make({}, engine)
    await c.start()
    const played = c.ownerPlay(at('R17'))
    await vi.waitFor(() => expect(waiting).toBe(true))
    c.switchTo('fixture-crawl')
    expect(moves(c.state)).toEqual(['W R14'])
    release()
    await played
    await new Promise((r) => setTimeout(r, 0))
    expect(moves(c.state)).toEqual(['W R14'])
    expect(c.state.status).toBe('owner-to-move')
    expect(c.state.offBookMoves).toBe(0)
  })

  it('offers only patterns that have the move on their main line', async () => {
    // W R13 after W R14, B Q14: a side branch of 'aside', the main line of 'crawl'. 'aside' comes first.
    const SHARED: FamilyDef = {
      id: 'star44',
      name: 'shared move',
      setup: 'handicap4',
      start: [{ c: 'B', at: 'Q16', note: 'corner' }],
      patterns: [
        {
          id: 'hane',
          name: 'hane',
          difficulty: 1,
          order: 1,
          line: [
            { c: 'W', at: 'R14', note: 'Approach.' },
            { c: 'B', at: 'Q14', note: 'Attach.' },
            { c: 'W', at: 'Q13', note: 'Hane.' },
          ],
        },
        {
          id: 'aside',
          name: 'aside',
          difficulty: 1,
          order: 2,
          line: [
            { c: 'W', at: 'R14', note: '' },
            { c: 'B', at: 'Q14', note: '' },
            { c: 'W', at: 'tenuki', note: 'Elsewhere.' },
          ],
          branches: [{ after: 2, move: { c: 'W', at: 'R13', kind: 'alternative', note: 'Extend.' } }],
        },
        {
          id: 'crawl',
          name: 'crawl',
          difficulty: 1,
          order: 3,
          line: [
            { c: 'W', at: 'R14', note: '' },
            { c: 'B', at: 'Q14', note: '' },
            { c: 'W', at: 'R13', note: '' },
          ],
        },
      ],
    }
    const c = make({ side: 'attack', patternId: 'hane' }, new FakeEngine(), buildBook([SHARED]))
    await c.start()
    await c.ownerPlay(at('R14'))
    expect(c.state.node?.children.find((n) => n.key.endsWith('W:R13'))?.patternIds).toEqual(['aside', 'crawl'])
    await c.ownerPlay(at('R13'))
    expect(c.state.lastVerdict).toMatchObject({ type: 'other-joseki', patternIds: ['crawl'] })
  })

  it('a retried other-joseki leaves the drill clean', async () => {
    const c = make({ side: 'attack' })
    await c.start()
    await c.ownerPlay(at('R14'))
    await c.ownerPlay(at('R13'))
    c.retry()
    await c.ownerPlay(at('Q13'))
    await c.ownerPlay(at('R13'))
    expect(c.state.result).toMatchObject({ clean: true, mistakes: 0, patternIds: ['fixture-hane'] })
  })
})

describe('SparController: taps that do not count', () => {
  it('a second ownerPlay while the first is being handled is ignored', async () => {
    const c = make()
    await c.start()
    const first = c.ownerPlay(at('Q14'))
    const second = c.ownerPlay(at('R13'))
    expect(c.state.status).toBe('teacher-thinking')
    await Promise.all([first, second])
    expect(ownerMoves(c.state)).toHaveLength(1)
    expect(moves(c.state)).toEqual(['W R14', 'B Q14', 'W Q13'])
  })

  it('a tap while the teacher waits for the engine is ignored', async () => {
    let release = () => {}
    const gate = new Promise<void>((r) => (release = r))
    const engine = new FakeEngine({
      analyze: async (pos, _komi, region) => {
        if (pos.toMove === 'white') await gate
        return defaultAnalysis(pos, region)
      },
    })
    const c = make({}, engine)
    await c.start()
    const played = c.ownerPlay(at('R17'))
    await vi.waitFor(() => expect(engine.analyzeCalls.some((a) => a.pos.toMove === 'white')).toBe(true))
    expect(c.state.status).toBe('teacher-thinking')
    await c.ownerPlay(at('O17'))
    expect(ownerMoves(c.state)).toHaveLength(1)
    release()
    await played
    expect(c.state.status).toBe('owner-to-move')
    expect(ownerMoves(c.state)).toHaveLength(1)
    expect(c.state.log).toHaveLength(3)
  })

  it('an illegal tap sets a message and changes nothing else', async () => {
    const c = make()
    await c.start()
    const before = c.state
    for (const gtp of ['R14', 'Q16', 'D4']) {
      await c.ownerPlay(at(gtp))
      expect(c.state.message).toEqual(expect.any(String))
      expect(c.state.pos).toBe(before.pos)
      expect(c.state.log).toBe(before.log)
      expect(c.state.node).toBe(before.node)
      expect(c.state.lastVerdict).toBeNull()
      expect(c.state.status).toBe('owner-to-move')
    }
    await c.ownerPlay(at('Q14'))
    expect(c.state.message).toBeNull()
    expect(ownerMoves(c.state)).toHaveLength(1)
  })
})

describe('SparController: when the engine is missing or slow', () => {
  it('ready() rejects: the in-book drill still completes', async () => {
    const engine = new FakeEngine({ status: 'failed' })
    await expect(engine.ready()).rejects.toThrow()
    const c = make({}, engine)
    await c.start()
    await c.ownerPlay(at('Q14'))
    await c.ownerPlay(at('P13'))
    expect(c.state.status).toBe('done')
    expect(c.state.result?.clean).toBe(true)
  })

  it('ready() rejects: an off-book move is unjudged and the session ends with a message', async () => {
    const c = make({}, new FakeEngine({ status: 'failed' }))
    await c.start()
    await c.ownerPlay(at('R17'))
    expect(c.state.log[1].verdict).toEqual({ type: 'unjudged', reason: 'engine-failed' })
    expect(c.state.lastVerdict).toEqual({ type: 'unjudged', reason: 'engine-failed' })
    expect(c.state.status).toBe('done')
    expect(c.state.message).toEqual(expect.any(String))
    // No mistake, but the drill never reached its leaf (R25); the owner left the book after W R14.
    expect(c.state.result).toMatchObject({ clean: false, mistakes: 0, missedKeys: ['W:R14'] })
  })

  it('a book mistake without the engine has no points lost', async () => {
    const c = make({}, new FakeEngine({ status: 'failed' }))
    await c.start()
    await c.ownerPlay(at('Q14'))
    await c.ownerPlay(at('R13'))
    expect(c.state.lastVerdict).toMatchObject({ type: 'mistake', inBook: true, pointsLost: null, big: false })
  })

  it('still loading: unjudged right away, without asking the engine', async () => {
    const engine = new FakeEngine({ status: 'loading' })
    const c = make({}, engine)
    await c.start()
    await c.ownerPlay(at('R17'))
    expect(c.state.log[1].verdict).toEqual({ type: 'unjudged', reason: 'engine-loading' })
    expect(engine.analyzeCalls).toHaveLength(0)
    expect(engine.scoreCalls).toHaveLength(0)
    expect(c.state.status).toBe('done')
    expect(c.state.message).toEqual(expect.any(String))
  })

  it('an engine that rejects every search never surfaces an unhandled rejection, and says why in the console', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const engine = new FakeEngine({
      analyze: () => Promise.reject(new Error('no move inside the region')),
      score: () => Promise.reject(new Error('stopped')),
    })
    const c = make({}, engine)
    await c.start()
    await c.ownerPlay(at('Q14'))
    await c.ownerPlay(at('P13'))
    expect(c.state.status).toBe('done')

    const off = make({}, engine)
    await off.start()
    await off.ownerPlay(at('R17'))
    expect(off.state.log[1].verdict).toEqual({ type: 'unjudged', reason: 'engine-failed' })
    expect(off.state.status).toBe('done')
    expect(off.state.message).toEqual(expect.any(String))
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('analyzeCorner failed'), expect.any(Error))
    // Without the search before the move there is nothing to judge with, so the second one isn't asked (R40).
    expect(engine.scoreCalls).toEqual([])

    // The search before the move worked but the one after it fails: still unjudged, and said in the console.
    const half = new FakeEngine({ score: () => Promise.reject(new Error('stopped')) })
    const h = make({}, half)
    await h.start()
    await h.ownerPlay(at('R17'))
    expect(h.state.log[1].verdict).toEqual({ type: 'unjudged', reason: 'engine-failed' })
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('scoreFor failed'), expect.any(Error))
  })

  it(`gives up on an engine call after ${ENGINE_TIMEOUT_MS} ms`, async () => {
    vi.useFakeTimers()
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const engine = new FakeEngine({ score: () => new Promise<number>(() => {}) })
    const c = make({}, engine)
    await c.start()
    const played = c.ownerPlay(at('R17'))
    await vi.advanceTimersByTimeAsync(ENGINE_TIMEOUT_MS - 10)
    expect(c.state.status).toBe('teacher-thinking')
    await vi.advanceTimersByTimeAsync(20)
    await played
    expect(c.state.log[1].verdict).toEqual({ type: 'unjudged', reason: 'engine-failed' })
    // The teacher's own reply did not need scoreFor, so play goes on.
    expect(c.state.status).toBe('owner-to-move')
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('scoreFor took longer'))
  })

  it('the teacher stops the session when it cannot answer off book', async () => {
    const engine = new FakeEngine({
      analyze: (pos, _komi, region) =>
        pos.toMove === 'white' ? Promise.reject(new Error('stopped')) : defaultAnalysis(pos, region),
    })
    const c = make({}, engine)
    await c.start()
    await c.ownerPlay(at('R17'))
    expect(c.state.lastVerdict?.type).toBe('fine-offbook')
    expect(c.state.status).toBe('done')
    expect(c.state.message).toEqual(expect.any(String))
    expect(c.state.result).toMatchObject({ clean: false, mistakes: 0 })
  })
})

describe('SparController: off book', () => {
  it.each([0, 3] as Sym[])('ends after 6 moves off book, and a drill that ends that way is not clean (sym %i)', async (sym) => {
    const c = make({ sym })
    await c.start()
    await c.ownerPlay(at('R17', sym))
    expect(c.state.lastVerdict).toEqual({ type: 'fine-offbook', pointsLost: 0, bookMove: at('Q14', sym) })
    expect(c.state.node).toBeNull()
    await c.ownerPlay(at('O17', sym))
    expect(c.state.status).toBe('owner-to-move')
    expect(c.state.offBookMoves).toBe(4)
    await c.ownerPlay(at('O15', sym))
    expect(c.state.offBookMoves).toBe(6)
    expect(c.state.status).toBe('done')
    expect(c.state.log).toHaveLength(7)
    expect(c.state.result).toEqual({
      patternIds: ['fixture-hane'],
      side: 'defend',
      clean: false,
      mistakes: 0,
      pointsLost: 0,
      missedKeys: ['W:R14'],
    })
  })

  it.each([1, 3] as Sym[])('engine points go back to the board under a rotation (sym %i)', async (sym) => {
    // The engine answers in the board frame: O17 (turned) is its corner move, with a score that makes R17 cost 5 or 1.
    const g = (gtp: string) => toGtp(at(gtp, sym))
    let score = -3
    const engine = new FakeEngine({
      analyze: (pos, _komi, region) =>
        pos.toMove === 'black' ? analysisOf('black', [[g('O17'), 2]], [g('K4'), -5]) : defaultAnalysis(pos, region),
      score: () => score,
    })
    const c = make({ sym }, engine)
    await c.start()
    await c.ownerPlay(at('R17', sym))
    expect(c.state.lastVerdict).toEqual({ type: 'mistake', inBook: false, better: at('O17', sym), pointsLost: 5, big: true })
    c.retry()
    score = 1
    await c.ownerPlay(at('R17', sym))
    expect(c.state.lastVerdict).toEqual({ type: 'fine-offbook', pointsLost: 1, bookMove: at('Q14', sym) })
  })

  describe('the owner’s move judged inside one search (R40)', () => {
    // A slow phone's short searches: before Black's move the corner search likes O17 (+2) and has looked at
    // R17 (+1.6); the separate search after the move always comes back 3 points lower (one-sided noise).
    const lowVisits = () =>
      new FakeEngine({
        analyze: (pos, _komi, region) =>
          pos.toMove === 'black' && pos.history.length === 1
            ? analysisOf('black', [['O17', 2], ['R17', 1.6]], ['K4', -8])
            : defaultAnalysis(pos, region),
        score: () => -1,
      })

    it('playing the engine’s best move is fine with loss 0, and needs no second search', async () => {
      const engine = lowVisits()
      const c = make({}, engine)
      await c.start()
      await c.ownerPlay(at('O17'))
      expect(c.state.log[1].verdict).toEqual({ type: 'fine-offbook', pointsLost: 0, bookMove: at('Q14') })
      expect(engine.scoreCalls).toEqual([])
    })

    it('another move the search looked at loses the difference inside it', async () => {
      const engine = lowVisits()
      const c = make({}, engine)
      await c.start()
      await c.ownerPlay(at('R17'))
      expect(c.state.log[1].verdict).toEqual({ type: 'fine-offbook', pointsLost: 0.4, bookMove: at('Q14') })
      expect(engine.scoreCalls).toEqual([])
    })

    it('a move the search didn’t look at is scored after it, as before', async () => {
      const engine = lowVisits()
      const c = make({}, engine)
      await c.start()
      await c.ownerPlay(at('R10'))
      expect(c.state.lastVerdict).toEqual({ type: 'mistake', inBook: false, better: at('O17'), pointsLost: 3, big: false })
      expect(engine.scoreCalls).toHaveLength(1)
    })

    it('Play elsewhere lands on the engine’s point elsewhere and is judged from the same analysis', async () => {
      const engine = new FakeEngine({
        analyze: (pos, _komi, region) =>
          pos.toMove === 'black' && pos.history.length === 1
            ? analysisOf('black', [['O17', 0]], ['K4', 1])
            : defaultAnalysis(pos, region),
        score: () => -5,
      })
      const c = make({}, engine)
      await c.start()
      await c.ownerPlay('tenuki')
      expect(stoneAt(c, 'K4')).toBe('black')
      expect(c.state.log[1].verdict).toEqual({ type: 'fine-offbook', pointsLost: 0, bookMove: at('Q14') })
      expect(engine.scoreCalls).toEqual([])
    })
  })

  it('a big off-book loss stops play; play on lets the engine answer', async () => {
    let score = -5
    const engine = new FakeEngine({ score: () => score })
    const c = make({}, engine)
    await c.start()
    await c.ownerPlay(at('R17'))
    expect(c.state.lastVerdict).toEqual({ type: 'mistake', inBook: false, better: at('J19'), pointsLost: 5, big: true })
    expect(c.state.status).toBe('stopped')
    await c.playOn()
    expect(moves(c.state)).toEqual(['W R14', 'B R17', 'W J19'])
    expect(c.state.status).toBe('owner-to-move')
    expect(c.state.offBookMoves).toBe(2)
    score = 0
    await c.ownerPlay(at('O17'))
    await c.ownerPlay(at('O15'))
    expect(c.state.status).toBe('done')
    // The miss was at the book position after W R14.
    expect(c.state.result).toMatchObject({ clean: false, mistakes: 1, pointsLost: 5, missedKeys: ['W:R14'] })
  })

  it('a tap outside the corner is a tenuki: placed where tapped and judged against the corner when the corner is urgent', async () => {
    const engine = new FakeEngine({
      analyze: (pos, _komi, region) =>
        pos.toMove === 'black' ? analysisOf('black', [['Q14', 5]], ['K4', -1]) : defaultAnalysis(pos, region),
      score: () => -1,
    })
    const c = make({}, engine)
    await c.start()
    await c.ownerPlay(at('D10'))
    expect(stoneAt(c, 'D10')).toBe('black')
    expect(c.state.log[1]).toEqual({ move: { tenuki: 'black' }, by: 'owner', verdict: c.state.lastVerdict })
    expect(c.state.lastVerdict).toEqual({ type: 'mistake', inBook: false, better: at('Q14'), pointsLost: 6, big: true })
  })

  it('the teacher plays tenuki and ends the session when elsewhere is more than 1 point bigger', async () => {
    const engine = new FakeEngine({
      analyze: (pos, _komi, region) =>
        pos.toMove === 'white' ? analysisOf('white', [['J19', 0]], ['K4', 1.5]) : defaultAnalysis(pos, region),
    })
    const c = make({}, engine)
    await c.start()
    await c.ownerPlay(at('R17'))
    expect(stoneAt(c, 'K4')).toBe('white')
    expect(c.state.log.at(-1)).toEqual({ move: { tenuki: 'white' }, by: 'teacher' })
    expect(c.state.status).toBe('done')
  })

  it('…but answers in the corner when elsewhere is exactly 1 point bigger', async () => {
    const engine = new FakeEngine({
      analyze: (pos, _komi, region) =>
        pos.toMove === 'white' ? analysisOf('white', [['J19', 0]], ['K4', 1]) : defaultAnalysis(pos, region),
    })
    const c = make({}, engine)
    await c.start()
    await c.ownerPlay(at('R17'))
    expect(moves(c.state).at(-1)).toBe('W J19')
    expect(c.state.status).toBe('owner-to-move')
  })

  it('the teacher picks at random among moves within 0.5 points of the best', async () => {
    const engine = new FakeEngine({
      analyze: (pos, _komi, region) =>
        pos.toMove === 'white'
          ? analysisOf('white', [['J19', 0], ['K19', -0.4], ['L19', -0.6]], ['K4', -10])
          : defaultAnalysis(pos, region),
    })
    const replies = new Set<string>()
    for (let seed = 1; seed <= 30; seed++) {
      const c = make({ seed }, engine)
      await c.start()
      await c.ownerPlay(at('R17'))
      replies.add(moves(c.state)[2])
    }
    expect([...replies].sort()).toEqual(['W J19', 'W K19'])
  })
})

describe('SparController: tenuki in the book', () => {
  it('a tap outside the corner matches the book’s tenuki (attack side, sym 2)', async () => {
    const c = make({ side: 'attack', patternId: 'fixture-tenuki', sym: 2 })
    await c.start()
    await c.ownerPlay(at('R14', 2))
    await c.ownerPlay(at('D10', 2))
    expect(stoneAt(c, 'D10', 2)).toBe('white')
    expect(c.state.lastVerdict).toMatchObject({ type: 'good' })
    expect(c.state.log[2]).toMatchObject({ move: { tenuki: 'white' }, by: 'owner' })
    expect(stoneAt(c, 'R13', 2)).toBe('black')
    await c.ownerPlay(at('R15', 2))
    expect(c.state.status).toBe('done')
    expect(c.state.result).toMatchObject({ clean: true, patternIds: ['fixture-tenuki'] })
  })

  it('the Play elsewhere button uses the engine’s point, or the first big point without it', async () => {
    const withEngine = new FakeEngine({
      analyze: (pos, _komi, region) =>
        pos.toMove === 'white' ? analysisOf('white', [['R13', 0]], ['K4', 0]) : defaultAnalysis(pos, region),
    })
    const c = make({ side: 'attack', patternId: 'fixture-tenuki' }, withEngine)
    await c.start()
    await c.ownerPlay(at('R14'))
    await c.ownerPlay('tenuki')
    expect(stoneAt(c, 'K4')).toBe('white')
    expect(c.state.lastVerdict?.type).toBe('good')

    const without = make({ side: 'attack', patternId: 'fixture-tenuki', sym: 6 }, new FakeEngine({ status: 'failed' }))
    await without.start()
    await without.ownerPlay(at('R14', 6))
    await without.ownerPlay('tenuki')
    expect(stoneAt(without, 'D10', 6)).toBe('white')
    expect(without.state.lastVerdict?.type).toBe('good')
  })

  it('the teacher’s book tenuki goes to the engine’s point, or the first big point without it', async () => {
    const engine = new FakeEngine({
      analyze: (pos, _komi, region) =>
        pos.toMove === 'white' ? analysisOf('white', [['R13', 0]], ['K4', -1]) : defaultAnalysis(pos, region),
    })
    const c = make({ patternId: 'fixture-tenuki' }, engine)
    await c.start()
    await c.ownerPlay(at('Q14'))
    expect(stoneAt(c, 'K4')).toBe('white')
    expect(c.state.log[2]).toEqual({ move: { tenuki: 'white' }, by: 'teacher' })
    expect(c.state.note).toBe('White leaves the corner for now. The fight can wait.')

    const without = make({ patternId: 'fixture-tenuki' }, new FakeEngine({ status: 'loading' }))
    await without.start()
    await without.ownerPlay(at('Q14'))
    expect(stoneAt(without, 'D10')).toBe('white')
    await without.ownerPlay(at('R13'))
    expect(stoneAt(without, 'R15')).toBe('white')
    expect(without.state.status).toBe('done')
    expect(without.state.result?.clean).toBe(true)
  })
})

describe('SparController: families that start the same way share their book (R42)', () => {
  // A second family on the same start (Black Q16, four handicap stones): a 3-3 invasion, and after the
  // fixture's W R14 a knight's move O17 (joseki) and a low S14 (mistake, punished by W R15).
  const SIBLING: FamilyDef = {
    id: 'invade33',
    name: 'fixture 3-3 invasion',
    setup: 'handicap4',
    start: [{ c: 'B', at: 'Q16', note: 'The corner stone.' }],
    patterns: [
      {
        id: 'fx-invade',
        name: 'Invade',
        difficulty: 1,
        order: 10,
        line: [
          { c: 'W', at: 'R17', note: 'White invades at the 3-3 point.' },
          { c: 'B', at: 'Q17', note: 'Black blocks.' },
          { c: 'W', at: 'R16', note: 'White crawls.' },
        ],
      },
      {
        id: 'fx-wide',
        name: 'Knight’s move',
        difficulty: 1,
        order: 11,
        line: [
          { c: 'W', at: 'R14', note: '' },
          { c: 'B', at: 'O17', note: 'Black answers with a knight’s move toward O17.' },
          { c: 'W', at: 'R11', note: 'White extends to R11.' },
        ],
        branches: [
          {
            after: 1,
            move: { c: 'B', at: 'S14', kind: 'mistake', note: 'Too low. White presses from R15.' },
            then: [{ c: 'W', at: 'R15', note: 'White presses.' }],
          },
        ],
      },
    ],
  }
  const PAIR = buildBook([FIXTURE_FAMILY, SIBLING])
  const pair = (over: Partial<Config> = {}, engine: TeacherEngine = new FakeEngine(), opts: ConstructorParameters<typeof SparController>[3] = {}) =>
    new SparController(
      PAIR,
      engine,
      {
        mode: 'drill',
        family: 'star44',
        patternId: 'fixture-hane',
        side: 'defend',
        sym: 0,
        seed: 1,
        thresholds: DEFAULT_THRESHOLDS,
        missed: new Set(),
        ...over,
      },
      opts,
    )

  it.each([0, 3] as Sym[])('in a drill, the other family’s joseki is other-joseki and Switch goes to that family (sym %i)', async (sym) => {
    const engine = new FakeEngine()
    const c = pair({ sym }, engine)
    await c.start()
    await c.ownerPlay(at('O17', sym))
    expect(c.state.lastVerdict).toEqual({
      type: 'other-joseki',
      note: orientNote('Black answers with a knight’s move toward O17.', sym),
      patternIds: ['fx-wide'],
    })
    expect(c.state.status).toBe('stopped')
    // A sound book move, so the engine isn't asked to judge it.
    expect(engine.scoreCalls).toEqual([])
    c.retry()
    expect(c.state.node).toBe(PAIR.families.star44.root.children[0])
    c.retry()
    await c.ownerPlay(at('O17', sym))
    expect(c.switchTo('fx-wide')).toBeNull()
    await vi.waitFor(() => expect(c.state.status).toBe('owner-to-move'))
    expect(c.state.node).toBe(PAIR.patterns['fx-wide'].path[0])
  })

  it('in free sparring it is simply good, and play goes on in that family’s tree, which gets the credit', async () => {
    const c = pair({ mode: 'free', patternId: undefined, side: 'attack' })
    await c.start()
    await c.ownerPlay(at('R17'))
    expect(c.state.log[0].verdict).toEqual({ type: 'good', kind: 'joseki', note: 'White invades at the 3-3 point.' })
    expect(moves(c.state)).toEqual(['W R17', 'B Q17'])
    expect(c.state.note).toBe('Black blocks.')
    await c.ownerPlay(at('R16'))
    expect(c.state.status).toBe('done')
    expect(c.state.result).toMatchObject({ patternIds: ['fx-invade'], clean: true })
  })

  it('a mistake from the other family is judged as in book, with that family’s checked loss; Play on runs its punishment', async () => {
    const asked: string[] = []
    const bookLoss = (family: FamilyId, key: string) => {
      asked.push(`${family}:${key}`)
      return family === 'invade33' && key === 'W:R14/B:S14' ? 2.7 : null
    }
    const engine = new FakeEngine()
    const c = pair({}, engine, { bookLoss })
    await c.start()
    await c.ownerPlay(at('S14'))
    expect(c.state.lastVerdict).toEqual({
      type: 'mistake',
      inBook: true,
      better: at('Q14'),
      pointsLost: 2.7,
      big: false,
      note: 'Too low. White presses from R15.',
    })
    expect(asked).toEqual(['invade33:W:R14/B:S14'])
    expect(engine.scoreCalls).toEqual([])
    await c.playOn()
    expect(moves(c.state)).toEqual(['W R14', 'B S14', 'W R15'])
    expect(c.state.note).toBe('White presses.')
  })

  it('in free sparring the teacher picks from both families’ moves', async () => {
    const first = new Set<string>()
    for (let seed = 1; seed <= 40; seed++) {
      const c = pair({ mode: 'free', patternId: undefined, seed })
      await c.start()
      first.add(moves(c.state)[0])
    }
    expect([...first].sort()).toEqual(['W R14', 'W R17'])
  })

  describe('in the real book', () => {
    const real = (over: Partial<Config>, engine: TeacherEngine = new FakeEngine()) =>
      new SparController(REAL_BOOK, engine, {
        mode: 'drill',
        family: 'invade33',
        side: 'attack',
        sym: 0,
        seed: 1,
        thresholds: DEFAULT_THRESHOLDS,
        missed: new Set(),
        ...over,
      })

    it('the 3-3 slide S16 in a 3-3 invasion drill is the 4-4 point’s joseki, with a Switch to it', async () => {
      // invade33-after-knight, attacking: White R14, Black's knight's move O17, then White slides to S16.
      const drillId = 'invade33-after-knight'
      const key = 'W:R14/B:O17'
      expect(REAL_BOOK.patterns[drillId].path[1].key).toBe(key)
      const inStar = REAL_BOOK.families.star44.root.children
        .find((n) => n.key === 'W:R14')
        ?.children.find((n) => n.key === key)
        ?.children.find((n) => n.key === `${key}/W:S16`)
      expect(inStar?.kind).toBe('joseki')
      expect(REAL_BOOK.patterns[drillId].path[2].key).not.toBe(`${key}/W:S16`)

      const c = real({ patternId: drillId })
      await c.start()
      await c.ownerPlay(at('R14'))
      expect(moves(c.state)).toEqual(['W R14', 'B O17'])
      await c.ownerPlay(at('S16'))
      const v = c.state.lastVerdict
      expect(v?.type).toBe('other-joseki')
      const ids = v?.type === 'other-joseki' ? v.patternIds : []
      expect(ids.length).toBeGreaterThan(0)
      for (const id of ids) {
        expect(REAL_BOOK.patterns[id].family).toBe('star44')
        expect(REAL_BOOK.patterns[id].path).toContain(inStar)
      }
      expect(c.switchTo(ids[0])).toBeNull()
      await vi.waitFor(() => expect(c.state.status).toBe('owner-to-move'))
      expect(c.state.log).toEqual([])
    })

    it('a 3-3 invasion in a 4-4 point free spar is good and goes on as the 3-3 invasion', async () => {
      const invade = REAL_BOOK.families.invade33.root.children.find(
        (n) => n.move?.color === 'white' && !REAL_BOOK.families.star44.root.children.some((s) => s.key === n.key),
      )!
      expect(invade.key).toBe('W:R17')
      const c = real({ mode: 'free', family: 'star44' })
      await c.start()
      await c.ownerPlay(at('R17'))
      expect(c.state.log[0].verdict).toMatchObject({ type: 'good' })
      expect(c.state.status).toBe('owner-to-move')
      // The teacher answered from the 3-3 invasion's tree: its node belongs to invade33 patterns only.
      const node = c.state.node!
      expect(node.parent).toBe(invade)
      expect(node.patternIds.every((id) => REAL_BOOK.patterns[id].family === 'invade33')).toBe(true)
    })
  })
})

describe('SparController: the margin line is part of the corner (R43)', () => {
  it.each([0, 6] as Sym[])('a tap one line outside the region is a local move judged by the engine, never the book’s tenuki (sym %i)', async (sym) => {
    // fixture-tenuki: after W R14, B Q14 the book's White move is a tenuki. R8 is the line just below the region.
    const engine = new FakeEngine()
    const c = make({ side: 'attack', patternId: 'fixture-tenuki', sym }, engine)
    await c.start()
    await c.ownerPlay(at('R14', sym))
    const asked = engine.analyzeCalls.length
    await c.ownerPlay(at('R8', sym))
    expect(stoneAt(c, 'R8', sym)).toBe('white')
    expect(c.state.log[2]).toMatchObject({ move: { ...at('R8', sym), player: 'white' }, by: 'owner' })
    expect(c.state.lastVerdict?.type).toBe('fine-offbook')
    expect(c.state.node).toBeNull()
    expect(engine.analyzeCalls.length).toBeGreaterThan(asked)
  })

  it('…and judged against the best corner move: the reviewer’s R8 in the 3-3 invasion after a knight’s-move answer', async () => {
    // invade33-after-knight, defending: after W R11 the book says Black plays elsewhere. Black attacks the
    // extension with R8 instead. That's a corner move: the engine judges it, here as a mistake.
    const id = 'invade33-after-knight'
    const path = REAL_BOOK.patterns[id].path
    const k = path.findIndex((n) => n.move?.at === 'tenuki')
    expect(path[k].key).toBe('W:R14/B:O17/W:R11/B:tenuki')
    const engine = new FakeEngine({
      analyze: (pos, _komi, region) =>
        pos.toMove === 'black' && pos.history.length === 3 ? analysisOf('black', [['Q14', 1]], ['D10', 2]) : defaultAnalysis(pos, region),
      score: () => -2,
    })
    const c = new SparController(REAL_BOOK, engine, {
      mode: 'drill',
      family: 'invade33',
      patternId: id,
      side: 'defend',
      sym: 0,
      seed: 1,
      thresholds: DEFAULT_THRESHOLDS,
      missed: new Set(),
    })
    await c.start()
    await c.ownerPlay(at('O17'))
    expect(c.state.node?.key).toBe('W:R14/B:O17/W:R11')
    await c.ownerPlay(at('R8'))
    expect(c.state.lastVerdict).toEqual({ type: 'mistake', inBook: false, better: at('Q14'), pointsLost: 3, big: false })
    expect(c.state.status).toBe('stopped')
    expect(c.state.log.at(-1)?.move).toMatchObject({ ...at('R8'), player: 'black' })
    // The Play elsewhere button still plays the book's tenuki.
    c.retry()
    await c.ownerPlay('tenuki')
    expect(c.state.log[3]).toMatchObject({ move: { tenuki: 'black' }, by: 'owner', verdict: { type: 'good' } })
  })

  it('a tenuki never lands on the margin line: the engine’s point there gives way to a big point', async () => {
    const engine = new FakeEngine({
      analyze: (pos, _komi, region) =>
        pos.toMove === 'white' ? analysisOf('white', [['R13', 0]], ['R8', 3]) : defaultAnalysis(pos, region),
    })
    const c = make({ patternId: 'fixture-tenuki' }, engine)
    await c.start()
    await c.ownerPlay(at('Q14'))
    expect(stoneAt(c, 'R8')).toBeNull()
    expect(stoneAt(c, 'D10')).toBe('white')
    expect(c.state.log[2]).toEqual({ move: { tenuki: 'white' }, by: 'teacher' })
  })
})

describe('SparController: engine komi (R9)', () => {
  it('asks the engine with komi + 4 in the 4-stone setup, and keeps the setup komi in the state', async () => {
    const engine = new FakeEngine()
    const c = make({}, engine)
    await c.start()
    await c.ownerPlay(at('R17'))
    expect(c.state.komi).toBe(0.5)
    expect(engine.analyzeCalls.length).toBeGreaterThan(0)
    expect(engine.analyzeCalls.every((a) => a.komi === 4.5)).toBe(true)
    expect(engine.scoreCalls.every((a) => a.komi === 4.5)).toBe(true)
  })

  it('uses plain komi in an even setup', async () => {
    const even: FamilyDef = { ...FIXTURE_FAMILY, setup: 'even' }
    const engine = new FakeEngine()
    const c = make({}, engine, buildBook([even]))
    await c.start()
    await c.ownerPlay(at('R17'))
    expect(c.state.komi).toBe(7.5)
    expect(engine.analyzeCalls.every((a) => a.komi === 7.5)).toBe(true)
  })
})

describe('SparController: free sparring', () => {
  /** Plays the owner's first joseki move at every turn until the session ends. */
  async function playBook(c: SparController) {
    await c.start()
    while (c.state.status === 'owner-to-move') {
      const next = c.state.node!.children.find((ch) => ch.kind === 'joseki' || ch.kind === 'alternative')!
      await c.ownerPlay(next.move!.at === 'tenuki' ? 'tenuki' : next.move!.at)
    }
  }

  it('follows the book to a leaf and credits the pattern reached; the teacher never plays a mistake', async () => {
    const reached = new Set<string>()
    for (let seed = 1; seed <= 20; seed++) {
      const c = make({ mode: 'free', patternId: undefined, seed })
      await playBook(c)
      expect(c.state.status).toBe('done')
      expect(c.state.node?.children).toEqual([])
      expect(moves(c.state)).not.toContain('W T19')
      const ids = c.state.result!.patternIds
      expect(ids).toHaveLength(1)
      expect(c.state.node!.patternIds).toContain(ids[0])
      expect(c.state.result).toMatchObject({ clean: true, side: 'defend' })
      reached.add(ids[0])
    }
    expect(reached.size).toBeGreaterThan(1)
  })

  it('is repeatable for one seed', async () => {
    const a = make({ mode: 'free', patternId: undefined, seed: 11 })
    const b = make({ mode: 'free', patternId: undefined, seed: 11 })
    await playBook(a)
    await playBook(b)
    expect(moves(a.state)).toEqual(moves(b.state))
  })
})

describe('SparController: tricks and drillable sides (R14)', () => {
  // A second family (under another id) so a fixture session can try to switch into it.
  const TRICKY: FamilyDef = {
    id: 'invade33',
    name: 'tricks',
    setup: 'handicap4',
    start: [{ c: 'B', at: 'Q16', note: 'corner' }],
    patterns: [
      {
        id: 'white-trick',
        name: 'white trick',
        difficulty: 2,
        order: 1,
        line: [
          { c: 'W', at: 'R14', note: 'Approach.' },
          { c: 'B', at: 'Q14', note: 'Attach.' },
          { c: 'W', at: 'R13', kind: 'trick', note: 'White tries a trick.' },
          { c: 'B', at: 'Q13', note: 'Black stays calm.' },
        ],
      },
    ],
  }
  const book = buildBook([FIXTURE_FAMILY, TRICKY])
  const tricky = { family: 'invade33' as const, patternId: 'white-trick' }

  it('refuses to drill the trick’s own side', () => {
    expect(() => make({ ...tricky, side: 'attack' }, new FakeEngine(), book)).toThrow(/side/)
    expect(() => make({ ...tricky, side: 'defend' }, new FakeEngine(), book)).not.toThrow()
  })

  it('switchTo refuses a pattern that cannot be drilled from this side, or that does not exist', () => {
    const c = make({ side: 'attack' }, new FakeEngine(), book)
    expect(() => c.switchTo('white-trick')).toThrow(/side/)
    expect(() => c.switchTo('nope')).toThrow(/nope/)
  })

  it('in a drill of the answering side the teacher plays the trick', async () => {
    const c = make({ ...tricky }, new FakeEngine(), book)
    await c.start()
    await c.ownerPlay(at('Q14'))
    expect(stoneAt(c, 'R13')).toBe('white')
    await c.ownerPlay(at('Q13'))
    expect(c.state.status).toBe('done')
    expect(c.state.result?.clean).toBe(true)
  })

  it('needs a pattern to drill', () => {
    expect(() => make({ patternId: undefined })).toThrow(/pattern/)
  })
})

// ---------------------------------------------------------------------------------------------
// Fix round 1: Switch, tap feedback, look-ahead, retry state, result rules (R25, R26)

/** A one-family book from main lines written as "W R14, B Q14, …" (notes are filler). */
function lines(defs: Array<{ id: string; line: string; branches?: FamilyDef['patterns'][number]['branches'] }>): Book {
  const fam: FamilyDef = {
    id: 'star44',
    name: 'test lines',
    setup: 'handicap4',
    start: [{ c: 'B', at: 'Q16', note: 'corner' }],
    patterns: defs.map((d, i) => ({
      id: d.id,
      name: d.id,
      difficulty: 1,
      order: i + 1,
      line: d.line.split(', ').map((m) => {
        const [c, at, kind] = m.split(' ')
        return { c: c as 'B' | 'W', at, note: `${c} ${at}.`, ...(kind ? { kind: kind as 'trick' } : {}) }
      }),
      branches: d.branches,
    })),
  }
  return buildBook([fam])
}

const flush = () => new Promise((r) => setTimeout(r, 0))

describe('SparController: Switch only offers patterns this side can drill', () => {
  it('gives no pattern when the only main line holding the move is drilled from the other side', async () => {
    // W R13 is on 'trickline'’s main line, but that line has White’s trick, so only Black's side drills it.
    const book = lines([
      { id: 'hane', line: 'W R14, B Q14, W Q13' },
      { id: 'trickline', line: 'W R14, B Q14, W R13, B Q13, W R12 trick' },
    ])
    expect(drillableSides(book, 'trickline')).toEqual(['defend'])
    const c = make({ side: 'attack', patternId: 'hane' }, new FakeEngine(), book)
    await c.start()
    await c.ownerPlay(at('R14'))
    await c.ownerPlay(at('R13'))
    expect(c.state.status).toBe('stopped')
    expect(c.state.lastVerdict).toMatchObject({ type: 'other-joseki', patternIds: [] })
  })
})

describe('SparController: after play on leaves the drilled line', () => {
  it('judges later book moves as in free sparring, not as another joseki each time', async () => {
    // Drilling the hane from White's side, the owner pokes the 1-1 point (the crawl pattern's mistake branch).
    const c = make({ side: 'attack' })
    await c.start()
    await c.ownerPlay(at('R14'))
    await c.ownerPlay(at('T19'))
    expect(c.state.lastVerdict).toMatchObject({ type: 'mistake', inBook: true, better: at('Q13') })
    await c.playOn()
    await c.ownerPlay(at('R13'))
    expect(c.state.lastVerdict?.type).toBe('good')
    expect(c.state.status).toBe('done')
    expect(c.state.result).toMatchObject({ patternIds: ['fixture-hane'], clean: false, mistakes: 1 })
  })
})

describe('SparController: the owner’s stone shows while it is judged', () => {
  it('puts the stone on the board before the verdict comes back', async () => {
    let release = () => {}
    const gate = new Promise<void>((r) => (release = r))
    const engine = new FakeEngine({
      score: async () => {
        await gate
        return 0
      },
    })
    const c = make({}, engine)
    await c.start()
    const played = c.ownerPlay(at('R17'))
    expect(c.state.status).toBe('teacher-thinking')
    expect(stoneAt(c, 'R17')).toBe('black')
    expect(c.state.log).toHaveLength(1)
    expect(c.state.lastVerdict).toBeNull()
    release()
    await played
    expect(c.state.log).toHaveLength(3)
    expect(c.state.lastVerdict?.type).toBe('fine-offbook')
  })
})

describe('SparController: one look-ahead at a time', () => {
  function slowEngine() {
    const pending: Array<() => void> = []
    const engine = new FakeEngine({
      analyze: (pos, _komi, region) => new Promise((r) => pending.push(() => r(defaultAnalysis(pos, region)))),
    })
    return { engine, pending }
  }

  it('a newer look-ahead waits for the running one, then runs if its position is still current', async () => {
    const { engine, pending } = slowEngine()
    const c = make({}, engine)
    await c.start()
    expect(engine.analyzeCalls).toHaveLength(1)
    await c.ownerPlay(at('Q14'))
    expect(c.state.status).toBe('owner-to-move')
    expect(engine.analyzeCalls).toHaveLength(1)
    pending.shift()!()
    await vi.waitFor(() => expect(engine.analyzeCalls).toHaveLength(2))
    expect(engine.analyzeCalls[1].pos).toBe(c.state.pos)
  })

  it('…and is dropped if the game has moved on by then', async () => {
    const { engine, pending } = slowEngine()
    const c = make({}, engine)
    await c.start()
    await c.ownerPlay(at('Q14'))
    await c.ownerPlay(at('P13'))
    expect(c.state.status).toBe('done')
    pending.shift()!()
    await flush()
    expect(engine.analyzeCalls).toHaveLength(1)
  })
})

describe('SparController: retry and illegal taps around captures and ko', () => {
  it('retry after a capturing move puts the captured stone back', async () => {
    const book = lines([{ id: 'poke', line: 'W T19, B S19, W R14, B Q14' }])
    const c = make({ patternId: 'poke' }, new FakeEngine({ score: () => -5 }), book)
    await c.start()
    await c.ownerPlay(at('S19'))
    const before = c.state
    await c.ownerPlay(at('T18'))
    expect(c.state.status).toBe('stopped')
    expect(stoneAt(c, 'T19')).toBeNull()
    c.retry()
    expect(c.state.pos).toBe(before.pos)
    expect(stoneAt(c, 'T19')).toBe('white')
    expect(stoneAt(c, 'T18')).toBeNull()
  })

  // White O18 sits in Black's mouth: B P18 takes it and starts a ko.
  const KO_START = 'W P19, B O19, W O18, B N18, W Q18, B O17, W P17'
  const koBook = lines([
    { id: 'ko-quiet', line: `${KO_START}, B S17` },
    { id: 'ko-take', line: `${KO_START}, B P18, W S17` },
  ])

  it('retry after a ko take restores the stone and lifts the ko', async () => {
    const c = make({ patternId: 'ko-quiet' }, new FakeEngine(), koBook)
    await c.start()
    for (const gtp of ['O19', 'N18', 'O17']) await c.ownerPlay(at(gtp))
    const before = c.state
    await c.ownerPlay(at('P18'))
    expect(c.state.status).toBe('stopped')
    expect(stoneAt(c, 'O18')).toBeNull()
    expect(c.state.pos.ko).toEqual(at('O18'))
    c.retry()
    expect(c.state.pos).toBe(before.pos)
    expect(stoneAt(c, 'O18')).toBe('white')
    expect(c.state.pos.ko).toBeNull()
  })

  it('an immediate ko retake gets the ko message and changes nothing', async () => {
    const c = make({ side: 'attack', patternId: 'ko-take' }, new FakeEngine(), koBook)
    await c.start()
    for (const gtp of ['P19', 'O18', 'Q18', 'P17']) await c.ownerPlay(at(gtp))
    expect(stoneAt(c, 'P18')).toBe('black')
    const before = c.state
    await c.ownerPlay(at('O18'))
    expect(c.state.message).toMatch(/^Ko:/)
    expect(c.state.pos).toBe(before.pos)
    expect(c.state.log).toBe(before.log)
    expect(c.state.status).toBe('owner-to-move')
  })

  it('a suicide tap gets the liberties message', async () => {
    const book = lines([{ id: 'corner', line: 'W S19, B Q14, W T18, B R14' }])
    const c = make({ patternId: 'corner' }, new FakeEngine(), book)
    await c.start()
    await c.ownerPlay(at('Q14'))
    const before = c.state
    await c.ownerPlay(at('T19'))
    expect(c.state.message).toMatch(/no liberties/)
    expect(c.state.pos).toBe(before.pos)
    expect(c.state.log).toBe(before.log)
  })

  it('a subscriber that throws doesn’t stop the session or the other subscribers', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    const c = make()
    const seen: string[] = []
    c.subscribe(() => {
      throw new Error('listener bug')
    })
    c.subscribe((s) => seen.push(s.status))
    await c.start()
    await c.ownerPlay(at('Q14'))
    await c.ownerPlay(at('P13'))
    expect(c.state.status).toBe('done')
    expect(seen.at(-1)).toBe('done')
    expect(error).toHaveBeenCalled()
  })
})

describe('SparController: what a session counts for (R25, R26)', () => {
  it('a drill that ends on one of its own alternatives is clean', async () => {
    const book = lines([
      {
        id: 'alt',
        line: 'W R14, B Q14, W Q13, B P13',
        branches: [{ after: 3, move: { c: 'B', at: 'P12', kind: 'alternative', note: 'Also fine.' }, then: [{ c: 'W', at: 'R13', note: 'Connect.' }] }],
      },
    ])
    const c = make({ patternId: 'alt' }, new FakeEngine(), book)
    await c.start()
    await c.ownerPlay(at('Q14'))
    await c.ownerPlay(at('P12'))
    expect(c.state.status).toBe('done')
    expect(c.state.result).toMatchObject({ patternIds: ['alt'], clean: true })
  })

  it('a drill the teacher ends with a tenuki is not clean', async () => {
    const engine = new FakeEngine({
      analyze: (pos, _komi, region) =>
        pos.toMove === 'white' ? analysisOf('white', [['J19', 0]], ['K4', 1.5]) : defaultAnalysis(pos, region),
    })
    const c = make({}, engine)
    await c.start()
    await c.ownerPlay(at('R17'))
    expect(c.state.status).toBe('done')
    expect(c.state.result).toMatchObject({ clean: false, mistakes: 0, missedKeys: ['W:R14'] })
  })

  it('free sparring credits no pattern when the owner never played a book move', async () => {
    const c = make({ mode: 'free', patternId: undefined })
    await c.start()
    for (const gtp of ['R17', 'O17', 'O15']) await c.ownerPlay(at(gtp))
    expect(c.state.status).toBe('done')
    expect(c.state.result).toEqual({ patternIds: [], side: 'defend', clean: true, mistakes: 0, pointsLost: 0, missedKeys: [] })
  })

  it('switchTo reports nothing when the owner hadn’t moved, made no mistake, or the session had already ended', async () => {
    const fresh = make()
    await fresh.start()
    expect(fresh.switchTo('fixture-crawl')).toBeNull()

    // Off the book with fine moves, no mistake: no penalty for switching either.
    const fine = make()
    await fine.start()
    await fine.ownerPlay(at('R17'))
    expect(fine.state.lastVerdict?.type).toBe('fine-offbook')
    expect(fine.switchTo('fixture-crawl')).toBeNull()

    const done = make()
    await done.start()
    await done.ownerPlay(at('Q14'))
    await done.ownerPlay(at('P13'))
    expect(done.state.status).toBe('done')
    expect(done.switchTo('fixture-crawl')).toBeNull()
  })

  it('switchTo after a mistake reports it against the drilled pattern', async () => {
    const c = make({}, new FakeEngine({ score: () => -3 }))
    await c.start()
    await c.ownerPlay(at('Q14'))
    await c.ownerPlay(at('R13'))
    expect(c.switchTo('fixture-crawl')).toEqual({
      patternIds: ['fixture-hane'],
      side: 'defend',
      clean: false,
      mistakes: 1,
      pointsLost: 3,
      missedKeys: ['W:R14/B:Q14/W:Q13'],
    })
  })

  it('two different mistakes in one position count once, with the first one’s points', async () => {
    let score = -3
    const c = make({}, new FakeEngine({ score: () => score }))
    await c.start()
    await c.ownerPlay(at('Q14'))
    await c.ownerPlay(at('R13'))
    c.retry()
    score = -6
    await c.ownerPlay(at('S12'))
    expect(c.state.lastVerdict).toMatchObject({ type: 'mistake', pointsLost: 6 })
    c.retry()
    await c.ownerPlay(at('P13'))
    expect(c.state.result).toMatchObject({ clean: false, mistakes: 1, pointsLost: 3 })
  })
})

// ---------------------------------------------------------------------------------------------
// Whole-board openings (R46): the region is the board, so nothing is elsewhere.

const OPEN_EVEN_TEST: FamilyDef = {
  id: 'open-even',
  name: 'Even-game opening',
  region: 'board',
  setup: 'empty',
  start: [],
  patterns: [
    {
      id: 'even-stars',
      name: 'Three star points',
      difficulty: 1,
      order: 1,
      line: [
        { c: 'B', at: 'Q16', note: 'Black takes a corner.' },
        { c: 'W', at: 'D4', note: 'White takes the corner across from Q16.' },
        { c: 'B', at: 'Q4', note: 'Black takes a third corner, so Q4 and Q16 work together.' },
      ],
    },
  ],
}

const OPEN_H4_TEST: FamilyDef = {
  id: 'open-h4',
  name: 'Opening with four stones',
  region: 'board',
  setup: 'handicap4',
  start: [{ c: 'B', at: 'Q16', note: 'Four star points.' }],
  patterns: [
    {
      id: 'h4-approach',
      name: 'Approach and pincer',
      difficulty: 1,
      order: 1,
      line: [
        { c: 'W', at: 'R14', note: 'White approaches Q16 low.' },
        { c: 'B', at: 'Q12', note: 'Black pincers with help from Q4.' },
      ],
    },
  ],
}

const OPENINGS = buildBook([OPEN_EVEN_TEST, OPEN_H4_TEST])

function makeOpening(over: Partial<Config> = {}, engine: TeacherEngine = new FakeEngine()): SparController {
  return make({ family: 'open-even', patternId: 'even-stars', side: 'defend', ...over }, engine, OPENINGS)
}

describe('SparController: whole-board openings (R46)', () => {
  it.each([0, 3, 6] as Sym[])('open-even as Black under sym %i: the whole board, Black first, done at the leaf', async (sym) => {
    const engine = new FakeEngine()
    const c = makeOpening({ sym }, engine)
    expect(c.state.region).toEqual(BOARD_REGION)
    expect(c.state.komi).toBe(7.5)
    await c.start()
    expect(c.state.status).toBe('owner-to-move')
    expect(c.state.log).toEqual([])
    await c.ownerPlay(at('Q16', sym))
    expect(c.state.lastVerdict).toMatchObject({ type: 'good' })
    expect(stoneAt(c, 'D4', sym)).toBe('white')
    expect(c.state.note).toBe(orientNote('White takes the corner across from Q16.', sym))
    await c.ownerPlay(at('Q4', sym))
    expect(c.state.status).toBe('done')
    expect(c.state.result).toMatchObject({ patternIds: ['even-stars'], side: 'defend', clean: true })
    // Book moves need no engine.
    expect(engine.analyzeCalls.every((call) => call.region === c.state.region || isWholeBoard(call.region))).toBe(true)
  })

  it('open-even as White: the teacher plays Black’s first move from the book', async () => {
    const c = makeOpening({ side: 'attack', sym: 1 })
    await c.start()
    expect(stoneAt(c, 'Q16', 1)).toBe('black')
    await c.ownerPlay(at('D4', 1))
    expect(stoneAt(c, 'Q4', 1)).toBe('black')
    expect(c.state.status).toBe('done')
    expect(c.state.result).toMatchObject({ side: 'attack', clean: true })
  })

  it('judges a move far from every corner against the best move on the whole board, not as a tenuki', async () => {
    // The engine likes the book's Q16 (board frame) by 3 points over K10 and D10, which it also looked at.
    const engine = new FakeEngine({
      analyze: (pos) => analysisOf(pos.toMove, [['Q16', 1], ['D10', -2], ['K10', 0.5]], null),
    })
    const c = makeOpening({}, engine)
    await c.start()
    await c.ownerPlay(parseGtp('D10'))
    expect(engine.analyzeCalls.length).toBeGreaterThan(0)
    for (const call of engine.analyzeCalls) expect(call.region).toEqual(BOARD_REGION)
    expect(c.state.log[0].move).toMatchObject({ ...parseGtp('D10'), player: 'black' })
    expect(c.state.lastVerdict).toEqual({
      type: 'mistake',
      better: parseGtp('Q16'),
      pointsLost: 3,
      big: false,
      inBook: false,
    })
    expect(c.state.status).toBe('stopped')
    expect(engine.scoreCalls).toHaveLength(0) // its value came from the search before the move

    // The center, half a point behind the best: fine, and the book's move is shown.
    c.retry()
    await c.ownerPlay(parseGtp('K10'))
    expect(c.state.lastVerdict).toEqual({ type: 'fine-offbook', pointsLost: 0.5, bookMove: parseGtp('Q16') })
  })

  it('ignores Play elsewhere: an opening has no tenuki', async () => {
    const engine = new FakeEngine()
    const c = makeOpening({}, engine)
    await c.start()
    await c.ownerPlay('tenuki')
    expect(c.state.status).toBe('owner-to-move')
    expect(c.state.log).toEqual([])
    expect(c.state.pos.history).toEqual([])
  })

  it('off book the teacher answers on the board and never leaves, however big "elsewhere" looks', async () => {
    // A fake that still claims a move elsewhere 10 points bigger: in an opening the tenuki rule is off.
    const engine = new FakeEngine({
      analyze: (pos, _komi, region) => ({ ...defaultAnalysis(pos, region), tenukiBest: { pt: parseGtp('A1'), scoreLead: 10 } }),
    })
    const c = makeOpening({ mode: 'free', patternId: undefined }, engine)
    await c.start()
    await c.ownerPlay(parseGtp('K10'))
    expect(c.state.status).toBe('owner-to-move')
    const reply = c.state.log[1]
    expect(reply.by).toBe('teacher')
    expect('tenuki' in reply.move).toBe(false)
    expect(c.state.offBookMoves).toBe(2)
  })

  it('still ends after six moves off the book', async () => {
    const c = makeOpening({ mode: 'free', patternId: undefined })
    await c.start()
    for (const gtp of ['K10', 'K16', 'K4']) {
      expect(c.state.status).toBe('owner-to-move')
      await c.ownerPlay(parseGtp(gtp))
    }
    expect(c.state.offBookMoves).toBe(6)
    expect(c.state.status).toBe('done')
  })

  it('open-h4: the owner is Black, White is not drillable, and the engine gets the +4 handicap komi (R9)', async () => {
    const engine = new FakeEngine({ analyze: (pos) => analysisOf(pos.toMove, [['Q12', 0], ['C10', -3]], null) })
    expect(drillableSides(OPENINGS, 'h4-approach')).toEqual(['defend'])
    expect(() => make({ family: 'open-h4', patternId: 'h4-approach', side: 'attack' }, engine, OPENINGS)).toThrow(/attack/)
    const c = make({ family: 'open-h4', patternId: 'h4-approach', side: 'defend' }, engine, OPENINGS)
    expect(c.state.region).toEqual(BOARD_REGION)
    expect(c.state.komi).toBe(0.5)
    await c.start()
    expect(stoneAt(c, 'R14')).toBe('white')
    await c.ownerPlay(parseGtp('C10'))
    expect(c.state.lastVerdict).toMatchObject({ type: 'mistake', pointsLost: 3, better: parseGtp('Q12') })
    expect(engine.analyzeCalls.map((call) => call.komi)).toContain(4.5)
    expect(engine.analyzeCalls.every((call) => call.komi === 4.5)).toBe(true)
  })

  it('does not take the 4-4 point’s corner book as the 4-stone opening’s (different regions are not siblings)', async () => {
    const book = buildBook([FIXTURE_FAMILY, OPEN_H4_TEST])
    const engine = new FakeEngine({ analyze: (pos) => analysisOf(pos.toMove, [['Q12', 0], ['Q14', -0.4]], null) })
    const c = make({ family: 'open-h4', patternId: 'h4-approach', side: 'defend' }, engine, book)
    await c.start()
    // Q14 is book in the 4-4 corner after W R14, but not here: engine-judged, off book.
    await c.ownerPlay(parseGtp('Q14'))
    expect(c.state.lastVerdict).toMatchObject({ type: 'fine-offbook', bookMove: parseGtp('Q12') })
    expect(c.state.node).toBeNull()
  })
})

// ---------------------------------------------------------------------------------------------
// R47: a position that looks the same turned. The owner can't know which way the book is turned, so a move
// that is book with the book turned another way counts as book, and the session's sym turns with it.

/** The board point diagonally across the board from `p`. */
const across = (p: Pt): Pt => ({ x: 18 - p.x, y: 18 - p.y })

describe('SparController: the book turns with a symmetric position (R47)', () => {
  it.each(['Q16', 'D16', 'D4', 'Q4'])('empty board: Black opening on %s stays in book, and the book follows', async (gtp) => {
    const c = makeOpening({ sym: 0 })
    await c.start()
    const mine = parseGtp(gtp)
    await c.ownerPlay(mine)
    expect(c.state.lastVerdict).toMatchObject({ type: 'good' })
    // The teacher answered from the book.
    expect(c.state.node?.key).toBe('B:Q16/W:D4')
    // The book's Q16 is where the owner played; the board did not move.
    expect(transform(parseGtp('Q16'), c.state.sym)).toEqual(mine)
    expect(c.state.pos.board[mine.y][mine.x]).toBe('black')
    // The teacher's D4 is across from it, and its note names the owner's point for Q16.
    const reply = across(mine)
    expect(c.state.pos.board[reply.y][reply.x]).toBe('white')
    expect(c.state.note).toBe(orientNote('White takes the corner across from Q16.', c.state.sym))
    expect(c.state.note).toContain(gtp)
    if (gtp === 'Q16') expect(c.state.sym).toBe(0)
  })

  it('the third corner: either of the two left is book, and the drill ends clean', async () => {
    for (const third of ['D16', 'Q4']) {
      const c = makeOpening({ sym: 0 })
      await c.start()
      await c.ownerPlay(parseGtp('Q16'))
      // B Q16, W D4: the diagonal through them is a mirror, so D16 and Q4 are the same move.
      await c.ownerPlay(parseGtp(third))
      expect(c.state.lastVerdict).toMatchObject({ type: 'good' })
      expect(c.state.status).toBe('done')
      expect(c.state.result).toMatchObject({ patternIds: ['even-stars'], clean: true, mistakes: 0 })
    }
  })

  it('star44, attacking: the approach mirrored across the 4-4 point’s diagonal (O17 for R14) stays in book', async () => {
    const c = make({ side: 'attack', sym: 0 })
    await c.start()
    await c.ownerPlay(parseGtp('O17'))
    expect(c.state.lastVerdict).toMatchObject({ type: 'good' })
    expect(c.state.node?.key).toBe('W:R14/B:Q14')
    // The diagonal mirror through Q16 (sym 5 maps (x, y) to (18 - y, 18 - x)) keeps the corner where it is.
    expect(c.state.sym).toBe(5)
    expect(c.state.region).toEqual(CORNER_REGION)
    // The teacher's Q14 lands on the mirrored point, O16.
    expect(stoneAt(c, 'Q14', 5)).toBe('black')
    expect(toGtp(at('Q14', 5))).toBe('O16')

    // A book mistake from here: the better point and the note are in the turned frame too.
    await c.ownerPlay(at('T19', 5))
    expect(c.state.lastVerdict).toMatchObject({ type: 'mistake', inBook: true, better: at('Q13', 5) })
    expect(toGtp(at('Q13', 5))).toBe('N16')
    // Retry, then the drilled line in the turned frame.
    c.retry()
    expect(c.state.sym).toBe(5)
    await c.ownerPlay(at('Q13', 5))
    await c.ownerPlay(at('R13', 5))
    expect(c.state.status).toBe('done')
    expect(c.state.result).toMatchObject({ patternIds: ['fixture-hane'], side: 'attack' })
  })

  it('Retry takes a turned move back with its turn', async () => {
    // O17 matched by turning the book, but in this book it is a mistake: Retry puts the book back.
    const turnedMistake: FamilyDef = {
      ...FIXTURE_FAMILY,
      patterns: [
        {
          id: 'only',
          name: 'only',
          difficulty: 1,
          order: 1,
          line: [
            { c: 'W', at: 'R17', note: 'The 3-3 invasion.' },
            { c: 'B', at: 'Q17', note: 'Block.' },
          ],
          branches: [{ after: 0, move: { c: 'W', at: 'R14', kind: 'mistake', note: 'Too close to Q4.' } }],
        },
      ],
    }
    const c = make({ side: 'attack', sym: 0, patternId: 'only' }, new FakeEngine(), buildBook([turnedMistake]))
    await c.start()
    await c.ownerPlay(parseGtp('O17'))
    expect(c.state.sym).toBe(5)
    expect(c.state.lastVerdict).toMatchObject({ type: 'mistake', inBook: true, better: at('R17', 5), note: orientNote('Too close to Q4.', 5) })
    c.retry()
    expect(c.state.sym).toBe(0)
    await c.ownerPlay(parseGtp('R17'))
    expect(c.state.lastVerdict).toMatchObject({ type: 'good' })
  })

  it('never turns the studied corner away: a corner family only takes the turn that keeps the corner in place', async () => {
    // C14 approaches D16, which the four handicap stones make the same, but it is not the studied corner.
    // The rotation that would make it R14 also moves the corner, so it isn't tried: C14 stays a move elsewhere.
    const c = make({ side: 'attack', sym: 0 })
    await c.start()
    await c.ownerPlay(parseGtp('C14'))
    expect(c.state.sym).toBe(0)
    expect(c.state.node).toBeNull()
    expect(c.state.log[0].move).toEqual({ tenuki: 'white' })
  })

  it('does not turn when the position has no symmetry', async () => {
    const c = make({ side: 'defend', sym: 0 })
    await c.start()
    // After W R14 nothing mirrors; O16 (the mirror of the book's Q14) is just off book.
    await c.ownerPlay(parseGtp('O16'))
    expect(c.state.sym).toBe(0)
    expect(c.state.node).toBeNull()
  })
})

describe('SparController: barely searched values (R48)', () => {
  it('an opening move the search gave under 10% of its visits is judged from the search after it', async () => {
    const engine = new FakeEngine({
      analyze: (pos) => analysisOf(pos.toMove, [['Q16', 1, 70], ['K10', 0.8, 4]], null),
      score: () => -2.5,
    })
    const c = makeOpening({ sym: 0 }, engine)
    await c.start()
    await c.ownerPlay(parseGtp('K10'))
    expect(engine.scoreCalls).toHaveLength(1)
    expect(c.state.lastVerdict).toEqual({ type: 'mistake', better: parseGtp('Q16'), pointsLost: 3.5, big: false, inBook: false })
  })

  it('in a corner too', async () => {
    const engine = new FakeEngine({
      analyze: (pos) => (pos.toMove === 'black' ? analysisOf('black', [['Q14', 1, 60], ['P17', 0.9, 5]], ['D10', -10]) : defaultAnalysis(pos, CORNER_REGION)),
      score: () => -1,
    })
    const c = make({}, engine)
    await c.start()
    await c.ownerPlay(parseGtp('P17'))
    expect(engine.scoreCalls).toHaveLength(1)
    expect(c.state.lastVerdict).toMatchObject({ type: 'mistake', pointsLost: 2, inBook: false })
  })
})
