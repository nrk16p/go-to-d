import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { buildBook } from '../../src/book/build'
import { startPosition } from '../../src/book/setups'
import { CORNER_REGION, inRegion, parseGtp, type Color, type Pt } from '../../src/go/coords'
import { pass, play, type Position } from '../../src/go/rules'
import {
  cornerAnalysisFrom,
  createInProcessEngine,
  engineRequestFor,
  type EngineSearch,
  type TeacherEngine,
} from '../../src/engine/teacher'
import { FIXTURE_FAMILY } from '../book/fixture'
// The tiny g170 6-block net, the same one KataGo's own tests use, as a data: URL (fetch reads those in Node).
import TEST_MODEL from '../../public/models/g170-b6c96-s175395328-d26788732.bin.gz?inline'

function move(pos: Position, gtp: string): Position {
  const r = play(pos, parseGtp(gtp), pos.toMove)
  if ('illegal' in r) throw new Error(`${gtp} is ${r.illegal}`)
  return r.pos
}

function handicap4Start() {
  const book = buildBook([FIXTURE_FAMILY])
  return startPosition(book, 'star44', null, 0)
}

describe('engineRequestFor', () => {
  it('a set-up position has no history and the side to move from the position', () => {
    const { pos } = handicap4Start()
    const req = engineRequestFor(pos)
    expect(req.currentPlayer).toBe('white')
    expect(req.moveHistory).toEqual([])
    expect(req.previousBoard).toBeUndefined()
    expect(req.previousPreviousBoard).toBeUndefined()
    expect(req.board).toBe(pos.board)
  })

  it('passes the recent moves and the boards before the last two', () => {
    const { pos: start } = handicap4Start()
    const a = move(start, 'R14')
    const b = move(a, 'Q14')
    const c = move(b, 'Q13')
    const req = engineRequestFor(c)
    expect(req.currentPlayer).toBe('black')
    expect(req.moveHistory).toEqual([
      { ...parseGtp('R14'), player: 'white' },
      { ...parseGtp('Q14'), player: 'black' },
      { ...parseGtp('Q13'), player: 'white' },
    ])
    expect(req.previousBoard).toEqual(b.board)
    expect(req.previousPreviousBoard).toEqual(a.board)
  })

  it('a tenuki cuts the history: only the moves after it are passed', () => {
    const { pos: start } = handicap4Start()
    const afterTenuki = pass(move(move(start, 'R14'), 'Q14'))
    const req1 = engineRequestFor(afterTenuki)
    expect(req1.currentPlayer).toBe('black')
    expect(req1.moveHistory).toEqual([])
    expect(req1.previousBoard).toBeUndefined()

    const next = move(afterTenuki, 'R13')
    const req2 = engineRequestFor(next)
    expect(req2.currentPlayer).toBe('white')
    expect(req2.moveHistory).toEqual([{ ...parseGtp('R13'), player: 'black' }])
    expect(req2.previousBoard).toEqual(afterTenuki.board)
    expect(req2.previousPreviousBoard).toBeUndefined()
  })
})

describe('cornerAnalysisFrom', () => {
  const region = CORNER_REGION
  const m = (gtp: string | 'pass', scoreLead: number, order: number, prior = 0.1) => {
    const p = gtp === 'pass' ? { x: -1, y: -1 } : parseGtp(gtp)
    return { ...p, scoreLead, order, prior, visits: 10, winRate: 0.5 }
  }
  const search = (moves: ReturnType<typeof m>[], rootScoreLead = 0): EngineSearch => ({
    rootScoreLead,
    rootWinRate: 0.5,
    rootVisits: 100,
    moves,
  })

  it("turns Black's scores into the mover's and keeps only region moves, best first", () => {
    const corner = search([m('R14', -20, 1), m('pass', -30, 2), m('Q14', -18, 0), m('C3', -25, 3)])
    const anywhere = search([m('Q14', -18, 0), m('D10', -17.5, 1)])
    const a = cornerAnalysisFrom(corner, anywhere, 'white', region)
    expect(a.toMove).toBe('white')
    expect(a.cornerBest).toEqual({ pt: parseGtp('Q14'), scoreLead: 18 })
    expect(a.candidates.map((c) => c.pt)).toEqual([parseGtp('Q14'), parseGtp('R14')])
    expect(a.candidates[1]).toEqual({ pt: parseGtp('R14'), scoreLead: 20, prior: 0.1, visits: 10 })
    // R48: each candidate's visits, and the root's, to tell a barely searched value apart.
    expect(a.visits).toBe(100)
    expect(a.tenukiBest).toEqual({ pt: parseGtp('D10'), scoreLead: 17.5 })
  })

  it('keeps Black scores as they are when Black is to move', () => {
    const a = cornerAnalysisFrom(search([m('Q14', 3, 0)]), search([m('D4', 2, 0)]), 'black', region)
    expect(a.cornerBest.scoreLead).toBe(3)
    expect(a.tenukiBest?.scoreLead).toBe(2)
  })

  it('tenukiBest is null when no move outside the region made the top list', () => {
    const a = cornerAnalysisFrom(search([m('Q14', 3, 0)]), search([m('Q14', 3, 0), m('pass', 1, 1)]), 'black', region)
    expect(a.tenukiBest).toBeNull()
  })

  it('throws when the corner search found no move in the region', () => {
    expect(() => cornerAnalysisFrom(search([m('pass', 0, 0)]), search([]), 'black', region)).toThrow(/region/)
  })
})

// The real engine on the TF.js CPU backend, with the tiny net and 16 visits.
describe('in-process engine (tiny net, CPU)', () => {
  let engine: TeacherEngine

  beforeAll(() => {
    engine = createInProcessEngine(TEST_MODEL, { backend: 'cpu' })
  })
  afterAll(() => {
    engine = undefined as unknown as TeacherEngine
  })

  it('loads the model', async () => {
    expect(['loading', 'ready']).toContain(engine.status())
    const info = await engine.ready()
    expect(engine.status()).toBe('ready')
    expect(info).toEqual({ backend: 'cpu', model: 'g170-b6c96-s175395328-d26788732' })
  }, 60_000)

  it('analyzeCorner keeps the corner moves inside the region and the tenuki move outside', async () => {
    const { pos, komi, region } = handicap4Start()
    expect(region).toEqual(CORNER_REGION)
    const a = await engine.analyzeCorner(pos, komi, region, { visits: 16 })
    expect(a.toMove).toBe('white')
    expect(inRegion(a.cornerBest.pt, region)).toBe(true)
    expect(a.candidates.length).toBeGreaterThan(0)
    for (const c of a.candidates) {
      expect(inRegion(c.pt, region), `${c.pt.x},${c.pt.y}`).toBe(true)
      expect(Number.isFinite(c.scoreLead)).toBe(true)
      expect(c.prior).toBeGreaterThanOrEqual(0)
    }
    expect(a.candidates[0].pt).toEqual(a.cornerBest.pt)
    if (a.tenukiBest) expect(inRegion(a.tenukiBest.pt, region)).toBe(false)
    // White is well behind against four handicap stones, and the scores are White's.
    expect(a.cornerBest.scoreLead).toBeLessThan(0)
  }, 120_000)

  it('scoreFor gives the same score from both sides, with opposite signs', async () => {
    const { pos, komi } = handicap4Start()
    const forBlack = await engine.scoreFor(pos, komi, 'black', { visits: 16 })
    const forWhite = await engine.scoreFor(pos, komi, 'white', { visits: 16 })
    expect(Number.isFinite(forBlack)).toBe(true)
    expect(forBlack).toBeGreaterThan(0)
    expect(Math.abs(forBlack + forWhite)).toBeLessThanOrEqual(1)
  }, 120_000)

  it('takes the side to move from the position after a tenuki', async () => {
    const { pos: start, komi, region } = handicap4Start()
    const afterTenuki = pass(move(move(start, 'R14'), 'Q14'))
    const a = await engine.analyzeCorner(afterTenuki, komi, region, { visits: 16 })
    const color: Color = 'black'
    expect(a.toMove).toBe(color)
    const taken = new Set(['R14', 'Q14', 'Q16'].map((g) => JSON.stringify(parseGtp(g))))
    const notOnStone = (p: Pt) => !taken.has(JSON.stringify(p))
    expect(a.candidates.every((c) => notOnStone(c.pt))).toBe(true)
  }, 120_000)
})
