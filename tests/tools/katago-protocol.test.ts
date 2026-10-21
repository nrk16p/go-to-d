import { describe, expect, it } from 'vitest'
import { buildBook } from '../../src/book/build'
import { startPosition } from '../../src/book/setups'
import {
  buildQuery,
  nextPlayer,
  normalizeResponse,
  parseReportedAs,
  stonesFromBoard,
  type AnalysisRequest,
  type RawResponse,
} from '../../tools/katago-protocol'
import { FIXTURE_FAMILY } from '../book/fixture'

const stones: AnalysisRequest['initialStones'] = [
  ['B', 'Q16'],
  ['B', 'D4'],
]

function request(extra: Partial<AnalysisRequest> = {}): AnalysisRequest {
  return { initialStones: stones, initialPlayer: 'W', moves: [], komi: 0.5, ...extra }
}

describe('nextPlayer', () => {
  it('is the initial player with no moves, otherwise the colour after the last move', () => {
    expect(nextPlayer(request())).toBe('W')
    expect(nextPlayer(request({ moves: [['W', 'R14']] }))).toBe('B')
    expect(nextPlayer(request({ moves: [['W', 'R14'], ['B', 'pass']] }))).toBe('W')
  })
})

describe('buildQuery', () => {
  it('writes the position fields KataGo expects, with chinese rules and 19x19 by default', () => {
    const q = buildQuery(
      request({ moves: [['W', 'R14'], ['B', 'Q14']], komi: 7.5, maxVisits: 400 }),
      'node-1',
    )
    expect(q).toEqual({
      id: 'node-1',
      initialStones: [['B', 'Q16'], ['B', 'D4']],
      initialPlayer: 'W',
      moves: [['W', 'R14'], ['B', 'Q14']],
      rules: 'chinese',
      komi: 7.5,
      boardXSize: 19,
      boardYSize: 19,
      maxVisits: 400,
      analyzeTurns: [2],
    })
  })

  it('lets the caller pick the rules and falls back to 400 visits', () => {
    const q = buildQuery(request({ rules: 'japanese' }), 'x')
    expect(q.rules).toBe('japanese')
    expect(q.maxVisits).toBe(400)
    expect(q.analyzeTurns).toEqual([0])
  })

  it('restricts the side to move after the moves, for the first ply only (allowMoves)', () => {
    const q = buildQuery(request({ moves: [['W', 'R14']], allowMoves: ['Q14', 'R13'] }), 'x')
    expect(q.allowMoves).toEqual([{ player: 'B', moves: ['Q14', 'R13'], untilDepth: 1 }])
    expect(q.avoidMoves).toBeUndefined()
  })

  it('writes avoidMoves the same way, and uses the initial player when no move was played', () => {
    const q = buildQuery(request({ avoidMoves: ['R14'] }), 'x')
    expect(q.avoidMoves).toEqual([{ player: 'W', moves: ['R14'], untilDepth: 1 }])
    expect(q.allowMoves).toBeUndefined()
  })

  it('leaves out empty restriction lists instead of sending an empty allowMoves', () => {
    const q = buildQuery(request({ allowMoves: [], avoidMoves: [] }), 'x')
    expect('allowMoves' in q).toBe(false)
    expect('avoidMoves' in q).toBe(false)
  })

  it('does not share arrays with the request', () => {
    const req = request({ moves: [['W', 'R14']] })
    const q = buildQuery(req, 'x')
    ;(q.moves as unknown[]).push(['B', 'Q14'])
    expect(req.moves).toHaveLength(1)
  })
})

describe('stonesFromBoard', () => {
  it('lists the setup stones of a start position as colour letter + GTP point', () => {
    const book = buildBook([FIXTURE_FAMILY])
    const { pos } = startPosition(book, 'star44', 'fixture-hane', 0)
    const list = stonesFromBoard(pos.board)
    expect(list).toHaveLength(4)
    expect(list).toEqual(
      expect.arrayContaining([['B', 'Q16'], ['B', 'D4'], ['B', 'D16'], ['B', 'Q4']]),
    )
  })

  it('writes white stones as W', () => {
    const board = Array.from({ length: 19 }, () => Array<'black' | 'white' | null>(19).fill(null))
    board[3][15] = 'white'
    expect(stonesFromBoard(board)).toEqual([['W', 'Q16']])
  })
})

function raw(current: 'B' | 'W', lead: number, win = 0.25): RawResponse {
  return {
    id: 'a',
    turnNumber: 0,
    isDuringSearch: false,
    rootInfo: { currentPlayer: current, visits: 400, winrate: win, scoreLead: lead },
    moveInfos: [
      { move: 'R14', order: 1, visits: 80, prior: 0.2, winrate: 0.3, scoreLead: lead - 1, pv: ['R14', 'Q14'] },
      { move: 'Q14', order: 0, visits: 200, prior: 0.5, winrate: 0.2, scoreLead: lead + 1 },
    ],
  }
}

describe('normalizeResponse: perspective', () => {
  it('BLACK reporting: White to move sees the negated score and the other winrate', () => {
    const a = normalizeResponse(raw('W', 46, 0.99), 'BLACK')
    expect(a.toMove).toBe('W')
    expect(a.scoreLead).toBe(-46)
    expect(a.winrate).toBeCloseTo(0.01, 10)
    expect(a.moves.map((m) => [m.move, m.scoreLead])).toEqual([
      ['Q14', -47],
      ['R14', -45],
    ])
    expect(a.moves[0].winrate).toBeCloseTo(0.8, 10)
  })

  it('BLACK reporting: Black to move keeps the numbers', () => {
    const a = normalizeResponse(raw('B', 3), 'BLACK')
    expect(a.scoreLead).toBe(3)
    expect(a.moves[0].scoreLead).toBe(4)
    expect(a.winrate).toBe(0.25)
  })

  it('WHITE reporting: Black to move sees the negated score', () => {
    const a = normalizeResponse(raw('B', 3), 'WHITE')
    expect(a.scoreLead).toBe(-3)
    expect(a.moves[0].scoreLead).toBe(-4)
    expect(a.winrate).toBeCloseTo(0.75, 10)
  })

  it('WHITE reporting: White to move keeps the numbers', () => {
    expect(normalizeResponse(raw('W', 3), 'WHITE').scoreLead).toBe(3)
  })

  it('SIDETOMOVE reporting: leaves the numbers alone for either colour', () => {
    expect(normalizeResponse(raw('W', 3), 'SIDETOMOVE').scoreLead).toBe(3)
    expect(normalizeResponse(raw('B', 3), 'SIDETOMOVE').scoreLead).toBe(3)
  })

  it('sorts moves by order and fills in a missing pv', () => {
    const a = normalizeResponse(raw('B', 0), 'SIDETOMOVE')
    expect(a.moves.map((m) => m.move)).toEqual(['Q14', 'R14'])
    expect(a.moves[0].pv).toEqual([])
    expect(a.moves[1].pv).toEqual(['R14', 'Q14'])
    expect(a.visits).toBe(400)
    expect(a.id).toBe('a')
  })

  it('does not turn 0 into -0', () => {
    const a = normalizeResponse(raw('W', 0), 'BLACK')
    expect(Object.is(a.scoreLead, -0)).toBe(false)
  })
})

describe('normalizeResponse: bad responses', () => {
  it('throws the engine error with the query id', () => {
    expect(() => normalizeResponse({ id: 'z', error: 'bad komi', field: 'komi' }, 'BLACK')).toThrow(/z.*bad komi/)
  })

  it('throws when there are no moves to report (every allowed move illegal)', () => {
    expect(() =>
      normalizeResponse(
        { id: 'z', rootInfo: { currentPlayer: 'W', visits: 0, winrate: 0.5, scoreLead: 0 }, moveInfos: [] },
        'BLACK',
      ),
    ).toThrow(/no moves/)
  })

  it('throws when rootInfo is missing', () => {
    expect(() => normalizeResponse({ id: 'z', moveInfos: [] }, 'BLACK')).toThrow(/rootInfo/)
  })
})

describe('parseReportedAs', () => {
  it('reads the setting and ignores comments and spacing', () => {
    expect(parseReportedAs('# reportAnalysisWinratesAs = WHITE\nreportAnalysisWinratesAs = BLACK  # note\n')).toBe('BLACK')
    expect(parseReportedAs('maxVisits = 5\n  reportAnalysisWinratesAs=sidetomove\n')).toBe('SIDETOMOVE')
  })

  it('defaults to SIDETOMOVE when the config does not set it (KataGo’s own default)', () => {
    expect(parseReportedAs('maxVisits = 400\n# reportAnalysisWinratesAs = BLACK\n')).toBe('SIDETOMOVE')
  })

  it('rejects a value KataGo would reject', () => {
    expect(() => parseReportedAs('reportAnalysisWinratesAs = ME\n')).toThrow(/ME/)
  })
})
