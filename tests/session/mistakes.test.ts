// R51: the controller keeps each mistake for the report's review, and a practice drill (`from`) starts
// with the book moves before the mistake already played.

import { describe, expect, it } from 'vitest'
import { buildBook } from '../../src/book/build'
import type { TeacherEngine } from '../../src/engine/teacher'
import { CORNER_REGION, inRegion, parseGtp, transform, transformRegion, withMargin, type Pt, type Sym } from '../../src/go/coords'
import { SparController } from '../../src/session/controller'
import { DEFAULT_THRESHOLDS } from '../../src/session/judge'
import { orientNote } from '../../src/session/orient'
import { FIXTURE_FAMILY } from '../book/fixture'
import { analysisOf, defaultAnalysis, FakeEngine } from './fakeEngine'

const BOOK = buildBook([FIXTURE_FAMILY])

type Config = ConstructorParameters<typeof SparController>[2]

function make(over: Partial<Config> = {}, engine: TeacherEngine = new FakeEngine()): SparController {
  return new SparController(BOOK, engine, {
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

const at = (gtp: string, sym: Sym = 0): Pt => transform(parseGtp(gtp), sym)
const CUT_NOTE = 'Cutting too early. The stone has two liberties and White can chase it.'

describe('SparController: mistakes kept for the review (R51)', () => {
  it.each([0, 3, 5] as Sym[])('a book mistake retried twice is kept once, in the board frame (sym %i)', async (sym) => {
    let score = -3
    const c = make({ sym }, new FakeEngine({ score: () => score }))
    await c.start()
    await c.ownerPlay(at('Q14', sym))
    const before = c.state.pos.board

    await c.ownerPlay(at('R13', sym))
    c.retry()
    // The same position again, with a different engine number: the first one stands, as in the tally.
    score = -6
    await c.ownerPlay(at('R13', sym))
    c.retry()
    await c.ownerPlay(at('P13', sym))
    expect(c.state.status).toBe('done')
    expect(c.state.result?.mistakes).toBe(1)

    expect(c.mistakes).toEqual([
      {
        moveNumber: 4,
        before,
        region: transformRegion(CORNER_REGION, sym),
        played: at('R13', sym),
        tenuki: false,
        better: at('P13', sym),
        pointsLost: 3,
        note: orientNote(CUT_NOTE, sym),
        sym,
        practice: { family: 'star44', patternId: 'fixture-hane', from: 3 },
      },
    ])
    // The board before the move: the cutting point is still empty.
    const r13 = at('R13', sym)
    expect(c.mistakes[0].before[r13.y][r13.x]).toBeNull()
  })

  it('an off-book mistake keeps the engine’s better move; one past the book has no practice start', async () => {
    const engine = new FakeEngine({
      analyze: (pos, _komi, region) => {
        if (pos.toMove !== 'black') return defaultAnalysis(pos, region)
        return pos.history.length === 1 ? analysisOf('black', [['O17', 2]], ['K4', -5]) : analysisOf('black', [['O15', 2]], ['K4', -5])
      },
      score: () => -3,
    })
    const c = make({}, engine)
    await c.start()
    await c.ownerPlay(at('R17'))
    expect(c.state.lastVerdict).toMatchObject({ type: 'mistake', inBook: false })
    expect(c.mistakes).toHaveLength(1)
    expect(c.mistakes[0]).toMatchObject({ moveNumber: 2, played: at('R17'), tenuki: false, better: at('O17'), pointsLost: 5, note: null })
    // R17 is off the book, but the position before it (after W R14) is on the line: it can be practised.
    expect(c.mistakes[0].practice).toEqual({ family: 'star44', patternId: 'fixture-hane', from: 1 })

    // After Play on, the position is off the book: there is no book line to fast-forward through.
    await c.playOn()
    expect(c.state.status).toBe('owner-to-move')
    await c.ownerPlay(at('S18'))
    expect(c.state.lastVerdict).toMatchObject({ type: 'mistake' })
    expect(c.mistakes).toHaveLength(2)
    expect(c.mistakes[1]).toMatchObject({ moveNumber: 4, practice: null })
  })

  it('a mistake on the punishment line after Play on has no practice start', async () => {
    const engine = new FakeEngine({
      analyze: (pos, _komi, region) =>
        pos.history.length === 5 ? analysisOf(pos.toMove, [['S13', 2]], ['K4', -5]) : defaultAnalysis(pos, region),
      score: () => -3,
    })
    const c = make({}, engine)
    await c.start()
    await c.ownerPlay(at('Q14'))
    await c.ownerPlay(at('R13'))
    await c.playOn()
    expect(c.state.node?.key).toBe('W:R14/B:Q14/W:Q13/B:R13/W:R12')
    await c.ownerPlay(at('S12'))
    expect(c.state.lastVerdict).toMatchObject({ type: 'mistake' })
    expect(c.mistakes).toHaveLength(2)
    expect(c.mistakes[0].practice).not.toBeNull()
    expect(c.mistakes[1].practice).toBeNull()
  })
})

describe('SparController: practice from a move (R51)', () => {
  it.each([0, 3, 5, 6] as Sym[])('from=3 plays the line up to the mistake, unjudged and out of the log (sym %i)', async (sym) => {
    // The position the owner saw in a full drill…
    const full = make({ sym })
    await full.start()
    await full.ownerPlay(at('Q14', sym))
    const seen = full.state.pos.board

    // …is where the practice run starts.
    const c = make({ sym, from: 3 })
    await c.start()
    expect(c.state.status).toBe('owner-to-move')
    expect(c.state.pos.board).toEqual(seen)
    expect(c.state.node?.key).toBe('W:R14/B:Q14/W:Q13')
    expect(c.state.log).toEqual([])
    expect(c.state.note).toBe(orientNote('Hane underneath. White gets room on the side.', sym))

    await c.ownerPlay(at('P13', sym))
    expect(c.state.status).toBe('done')
    expect(c.state.result).toMatchObject({ patternIds: ['fixture-hane'], clean: true, mistakes: 0 })
  })

  it('a mistake made in a practice run has the same move number and start as in the full drill', async () => {
    const c = make({ sym: 5, from: 3 }, new FakeEngine({ score: () => -3 }))
    await c.start()
    await c.ownerPlay(at('R13', 5))
    expect(c.mistakes[0]).toMatchObject({ moveNumber: 4, practice: { patternId: 'fixture-hane', from: 3 } })
  })

  it('ignores a start that is not before an owner move, or past the line', async () => {
    for (const from of [2, 5, 9, -1, 1.5]) {
      const c = make({ from })
      await c.start()
      // A plain drill: the teacher's first move only.
      expect(c.state.pos.history).toHaveLength(1)
      expect(c.state.node?.key).toBe('W:R14')
    }
  })

  it('a book tenuki on the way goes on a point away from the corner, with no engine asked', async () => {
    const engine = new FakeEngine({ status: 'loading' })
    const c = make({ patternId: 'fixture-tenuki', sym: 2, from: 3 }, engine)
    await c.start()
    expect(c.state.status).toBe('owner-to-move')
    expect(c.state.node?.key).toBe('W:R14/B:Q14/W:tenuki')
    const away = c.state.pos.history[2]
    expect(inRegion(away, withMargin(c.state.region))).toBe(false)
    expect(away.player).toBe('white')
  })

  it('switching to another pattern drops the practice start', async () => {
    const c = make({ from: 3 })
    await c.start()
    c.switchTo('fixture-crawl')
    await new Promise((r) => setTimeout(r, 0))
    expect(c.state.pos.history).toHaveLength(1)
  })
})
