import { describe, expect, it } from 'vitest'
import { buildBook, familyHash } from '../../src/book/build'
import type { Book, BookNode, FamilyDef } from '../../src/book/types'
import type { Analysis, AnalysisMove, AnalysisRequest, Letter } from '../../tools/katago-protocol'
import {
  analyseFamily,
  checkCache,
  childVerdict,
  cornerVerdict,
  describeCheck,
  flagFor,
  formatFlagTable,
  MAX_LOSS_JOSEKI,
  MIN_LOSS_MISTAKE,
  nodeTasks,
  positionRequest,
  substituteKey,
  tenukiVerdict,
  verifyKey,
  type VerifyFile,
} from '../../tools/book-check'
import { FIXTURE_FAMILY } from '../book/fixture'

function clone<T>(x: T): T {
  return JSON.parse(JSON.stringify(x)) as T
}

function walk(node: BookNode, out: BookNode[] = []): BookNode[] {
  for (const c of node.children) {
    out.push(c)
    walk(c, out)
  }
  return out
}

function find(book: Book, key: string): BookNode {
  const node = walk(book.families.star44.root).find((n) => n.key === key)
  if (!node) throw new Error(`no node ${key}`)
  return node
}

/** An Analysis as the engine client returns it: moves best first, scores from the mover's view. */
function an(toMove: Letter, moves: Array<[string, number, number?]>, visits = 400): Analysis {
  return {
    id: 'x',
    toMove,
    visits,
    scoreLead: moves[0][1],
    winrate: 0.5,
    moves: moves.map(([move, scoreLead, v], order) => ({
      move,
      order,
      visits: v ?? 100,
      scoreLead,
      winrate: 0.5,
      prior: 0.1,
      pv: [],
    })) as AnalysisMove[],
  }
}

/** A verify file for a book where every node is fine (mistakes lose 5, the rest 0.4) except the overrides. */
function fileFor(book: Book, overrides: Record<string, number> = {}): VerifyFile {
  const nodes: VerifyFile['nodes'] = {}
  for (const n of walk(book.families.star44.root)) {
    const fine = n.kind === 'mistake' ? 5 : 0.4
    nodes[verifyKey('star44', n.key)] = { loss: overrides[n.key] ?? fine, bestAt: 'K10', kind: n.kind }
  }
  return { familyHash: familyHash(book, 'star44'), model: 'test-model', visits: 400, nodes }
}

describe('flagFor', () => {
  it('flags joseki and alternative nodes that lose more than 2.0, not at exactly 2.0', () => {
    expect(MAX_LOSS_JOSEKI).toBe(2.0)
    for (const kind of ['joseki', 'alternative'] as const) {
      expect(flagFor(kind, 0)).toBeNull()
      expect(flagFor(kind, 2.0)).toBeNull()
      expect(flagFor(kind, 2.01)).toBe('too-lossy')
      expect(flagFor(kind, 9)).toBe('too-lossy')
    }
  })

  it('flags mistake nodes that lose less than 1.5, not at exactly 1.5', () => {
    expect(MIN_LOSS_MISTAKE).toBe(1.5)
    expect(flagFor('mistake', 1.5)).toBeNull()
    expect(flagFor('mistake', 1.49)).toBe('not-a-mistake')
    expect(flagFor('mistake', 0)).toBe('not-a-mistake')
    expect(flagFor('mistake', 12)).toBeNull()
  })

  it('does not judge tricks', () => {
    expect(flagFor('trick', 0)).toBeNull()
    expect(flagFor('trick', 30)).toBeNull()
  })
})

describe('nodeTasks', () => {
  const book = buildBook([FIXTURE_FAMILY])

  it('lists every non-root node once, parents before children', () => {
    const tasks = nodeTasks(book, 'star44')
    const keys = tasks.map((t) => t.node.key)
    expect(keys).toHaveLength(walk(book.families.star44.root).length)
    expect(new Set(keys).size).toBe(keys.length)
    for (const t of tasks) {
      if (t.node.parent && t.node.parent.move) expect(keys.indexOf(t.node.parent.key)).toBeLessThan(keys.indexOf(t.node.key))
      expect(t.setup).toBe('handicap4')
    }
  })

  it('makes one task per setup for a node shared by patterns with different setups', () => {
    const def = clone(FIXTURE_FAMILY)
    def.patterns[1].setup = 'even'
    const mixed = buildBook([def])
    const tasks = nodeTasks(mixed, 'star44').filter((t) => t.node.key === 'W:R14')
    expect(tasks.map((t) => [t.setup, t.patternId])).toEqual([
      ['handicap4', 'fixture-hane'],
      ['even', 'fixture-crawl'],
    ])
  })
})

describe('positionRequest', () => {
  const book = buildBook([FIXTURE_FAMILY])
  const subs = new Map<string, string>()

  it('region scope at the first move: setup stones, white to move, the corner minus occupied points', () => {
    const task = nodeTasks(book, 'star44')[0] // W:R14, parent = root
    const req = positionRequest(book, task, subs, 'region', 400)
    expect(req.initialStones).toHaveLength(4)
    expect(req.initialStones).toEqual(
      expect.arrayContaining([['B', 'Q16'], ['B', 'D4'], ['B', 'D16'], ['B', 'Q4']]),
    )
    expect(req.initialPlayer).toBe('W')
    expect(req.moves).toEqual([])
    expect(req.komi).toBe(0.5)
    expect(req.maxVisits).toBe(400)
    expect(req.allowMoves).toHaveLength(120) // 11 x 11 corner points minus the 4-4 stone
    expect(req.allowMoves).toEqual(expect.arrayContaining(['T19', 'K10', 'R14', 'Q17']))
    expect(req.allowMoves).not.toContain('Q16')
    expect(req.allowMoves).not.toContain('D4') // not in the corner
    expect(req.allowMoves).not.toContain('H11') // one column outside the corner
    expect(req.allowMoves).not.toContain('K8') // one row outside the corner
    expect(req.allowMoves).toContain('J9') // the corner's own bottom-left point
    expect(req.avoidMoves).toBeUndefined()
  })

  it('writes the moves down to the parent with colour letters and drops their points from allowMoves', () => {
    const node = find(book, 'W:R14/B:Q14/W:Q13/B:P13/W:R13')
    const task = nodeTasks(book, 'star44').find((t) => t.node === node)!
    const req = positionRequest(book, task, subs, 'region', 200)
    expect(req.moves).toEqual([['W', 'R14'], ['B', 'Q14'], ['W', 'Q13'], ['B', 'P13']])
    expect(req.maxVisits).toBe(200)
    expect(req.allowMoves).toHaveLength(116)
    for (const p of ['R14', 'Q14', 'Q13', 'P13']) expect(req.allowMoves).not.toContain(p)
    expect(req.allowMoves).toContain('R13')
  })

  it('outside scope sends the same points as avoidMoves and no allowMoves', () => {
    const node = find(book, 'W:R14/B:Q14/W:tenuki')
    const task = nodeTasks(book, 'star44').find((t) => t.node === node)!
    const region = positionRequest(book, task, subs, 'region', 400)
    const outside = positionRequest(book, task, subs, 'outside', 400)
    expect(outside.avoidMoves).toEqual(region.allowMoves)
    expect(outside.allowMoves).toBeUndefined()
  })

  it('free scope sends no restriction', () => {
    const task = nodeTasks(book, 'star44')[1]
    const req = positionRequest(book, task, subs, 'free', 400)
    expect(req.allowMoves).toBeUndefined()
    expect(req.avoidMoves).toBeUndefined()
  })

  it('a child request adds the node’s own move on top of the parent position', () => {
    const node = find(book, 'W:R14/B:Q14')
    const task = nodeTasks(book, 'star44').find((t) => t.node === node)!
    const req = positionRequest(book, task, subs, 'child', 400)
    expect(req.moves).toEqual([['W', 'R14'], ['B', 'Q14']])
    expect(req.allowMoves).toBeUndefined()
  })

  it('uses the pattern’s own setup (even game: white stones, komi 7.5)', () => {
    const def = clone(FIXTURE_FAMILY)
    def.patterns[0].setup = 'even'
    const evenBook = buildBook([def])
    const task = nodeTasks(evenBook, 'star44').find((t) => t.setup === 'even')!
    const req = positionRequest(evenBook, task, subs, 'region', 400)
    expect(req.komi).toBe(7.5)
    expect(req.initialStones).toEqual(
      expect.arrayContaining([['B', 'Q16'], ['B', 'D4'], ['W', 'D16'], ['W', 'Q4']]),
    )
  })

  it('refuses a tenuki on the path that has no substitute yet', () => {
    const node = find(book, 'W:R14/B:Q14/W:tenuki/B:R13')
    const task = nodeTasks(book, 'star44').find((t) => t.node === node)!
    expect(() => positionRequest(book, task, subs, 'region', 400)).toThrow(/tenuki/)
  })

  it('plays the substitute for a tenuki, or a pass, and leaves the points free', () => {
    const node = find(book, 'W:R14/B:Q14/W:tenuki/B:R13/W:R15')
    const task = nodeTasks(book, 'star44').find((t) => t.node === node)!
    const withStone = new Map([[substituteKey('handicap4', 'W:R14/B:Q14/W:tenuki'), 'D10']])
    const a = positionRequest(book, task, withStone, 'region', 400)
    expect(a.moves).toEqual([['W', 'R14'], ['B', 'Q14'], ['W', 'D10'], ['B', 'R13']])
    expect(a.allowMoves).toHaveLength(117) // D10 is outside the corner, so only 3 corner points are taken, plus Q16
    const withPass = new Map([[substituteKey('handicap4', 'W:R14/B:Q14/W:tenuki'), 'pass']])
    const b = positionRequest(book, task, withPass, 'region', 400)
    expect(b.moves).toEqual([['W', 'R14'], ['B', 'Q14'], ['W', 'pass'], ['B', 'R13']])
    expect(b.allowMoves).toHaveLength(117)
  })

  it('leaves out corner points that would be illegal (suicide)', () => {
    // White T19 corner stone with Black on S19 and T18: playing T19 is suicide for White.
    const def: FamilyDef = {
      id: 'star44',
      name: 't',
      setup: 'handicap4',
      start: [{ c: 'B', at: 'Q16', note: '' }],
      patterns: [
        {
          id: 'p',
          name: 'p',
          difficulty: 1,
          order: 1,
          line: [
            { c: 'W', at: 'R14', note: 'n' },
            { c: 'B', at: 'S19', note: 'n' },
            { c: 'W', at: 'R13', note: 'n' },
            { c: 'B', at: 'T18', note: 'n' },
            { c: 'W', at: 'R12', note: 'n' },
          ],
        },
      ],
    }
    const b = buildBook([def])
    const task = nodeTasks(b, 'star44').find((t) => t.node.key.endsWith('W:R12'))!
    const req = positionRequest(b, task, new Map(), 'region', 400)
    expect(req.allowMoves).not.toContain('T19')
    expect(req.allowMoves).toContain('R11')
  })
})

describe('positionRequest and analyseFamily: a whole-board family (R46)', () => {
  const def: FamilyDef = {
    id: 'open-even',
    name: 'opening',
    region: 'board',
    setup: 'empty',
    start: [],
    patterns: [
      {
        id: 'o',
        name: 'o',
        difficulty: 1,
        order: 1,
        line: [
          { c: 'B', at: 'Q16', note: 'n' },
          { c: 'W', at: 'D4', note: 'n' },
          { c: 'B', at: 'K10', note: 'n' },
        ],
      },
    ],
  }
  const book = buildBook([def])
  const subs = new Map<string, string>()

  it('asks about the empty board, Black to move, komi 7.5, with no region restriction', () => {
    const [first, second] = nodeTasks(book, 'open-even')
    const req = positionRequest(book, first, subs, 'region', 400)
    expect(req.initialStones).toEqual([])
    expect(req.initialPlayer).toBe('B')
    expect(req.komi).toBe(7.5)
    expect(req.moves).toEqual([])
    expect(req.allowMoves).toBeUndefined()
    expect(req.avoidMoves).toBeUndefined()
    expect(positionRequest(book, second, subs, 'region', 400).moves).toEqual([['B', 'Q16']])
  })

  it('has nothing outside the region to ask about', () => {
    const task = nodeTasks(book, 'open-even')[0]
    expect(() => positionRequest(book, task, subs, 'outside', 400)).toThrow(/whole-board/)
  })

  it('judges each move against the engine’s best anywhere on the board', async () => {
    const asked: AnalysisRequest[] = []
    const analyseAll = async (reqs: AnalysisRequest[]): Promise<Analysis[]> =>
      reqs.map((req) => {
        asked.push(req)
        const moves = req.moves.map(([c, p]) => `${c}${p}`).join(' ')
        if (moves === '') return an('B', [['D16', 1.0, 300], ['Q16', 0.9, 100]])
        if (moves === 'BQ16') return an('W', [['D4', -0.9, 300]])
        if (moves === 'BQ16 WD4') return an('B', [['C3', 1.2, 300], ['K10', -1.8, 60]])
        throw new Error(`unscripted ${moves}`)
      })
    const { nodes } = await analyseFamily(book, 'open-even', analyseAll, { visits: 400 })
    expect(asked.every((r) => r.allowMoves === undefined && r.avoidMoves === undefined)).toBe(true)
    expect(nodes).toEqual({
      'open-even:B:Q16': { loss: 0.1, bestAt: 'D16', kind: 'joseki' },
      'open-even:B:Q16/W:D4': { loss: 0, bestAt: 'D4', kind: 'joseki' },
      'open-even:B:Q16/W:D4/B:K10': { loss: 3, bestAt: 'C3', kind: 'joseki' },
    })
  })

  it('leaves a corner family’s requests as they were', () => {
    const corner = buildBook([FIXTURE_FAMILY])
    const req = positionRequest(corner, nodeTasks(corner, 'star44')[0], subs, 'region', 400)
    expect(req.allowMoves).toHaveLength(120)
  })
})

describe('verdicts', () => {
  it('cornerVerdict: loss is the best move’s score minus the move’s score, from the mover’s view', () => {
    const parent = an('W', [['Q9', 3.0, 200], ['R14', 1.4, 100], ['K10', 0.5, 20]])
    expect(cornerVerdict(parent, 'R14')).toEqual({ loss: 1.6, bestAt: 'Q9' })
    expect(cornerVerdict(parent, 'Q9')).toEqual({ loss: 0, bestAt: 'Q9' })
  })

  it('cornerVerdict: a move that looks better than the first choice counts as 0, not negative', () => {
    const parent = an('W', [['Q9', 3.0, 200], ['R14', 3.4, 100]])
    expect(cornerVerdict(parent, 'R14')).toEqual({ loss: 0, bestAt: 'Q9' })
  })

  it('cornerVerdict: needs a child analysis when the move has under 10% of the visits or is missing', () => {
    const parent = an('W', [['Q9', 3.0, 300], ['R14', 1.0, 39], ['R13', 1.0, 40]], 400)
    expect(cornerVerdict(parent, 'R14')).toBe('need-child')
    expect(cornerVerdict(parent, 'R13')).toEqual({ loss: 2, bestAt: 'Q9' }) // exactly 10% is enough
    expect(cornerVerdict(parent, 'S19')).toBe('need-child')
  })

  it('cornerVerdict rounds to two decimals', () => {
    const parent = an('W', [['Q9', 1.0], ['R14', 0.3333333]])
    expect(cornerVerdict(parent, 'R14')).toEqual({ loss: 0.67, bestAt: 'Q9' })
  })

  it('childVerdict: the child is seen by the opponent, so its score is negated', () => {
    const parent = an('W', [['Q9', 3.0, 300]])
    // opponent leads by 1.5 after the move: the mover is at -1.5, 4.5 below the best move
    expect(childVerdict(parent, an('B', [['R13', 1.5]]))).toEqual({ loss: 4.5, bestAt: 'Q9' })
    // opponent is behind by 5: the mover is at +5, better than the best move's 3 -> loss 0
    expect(childVerdict(parent, an('B', [['R13', -5]]))).toEqual({ loss: 0, bestAt: 'Q9' })
  })

  it('tenukiVerdict: corner best minus best outside, and the move to play in the tenuki’s place', () => {
    const region = an('W', [['Q13', 3.0]])
    const outside = an('W', [['D10', 0.5], ['pass', -20]])
    expect(tenukiVerdict(region, outside)).toEqual({ loss: 2.5, bestAt: 'Q13', substitute: 'D10' })
    expect(tenukiVerdict(an('W', [['Q13', 0.5]]), an('W', [['C3', 2]]))).toEqual({
      loss: 0,
      bestAt: 'Q13',
      substitute: 'C3',
    })
  })
})

describe('analyseFamily', () => {
  const def: FamilyDef = {
    id: 'star44',
    name: 'tenuki test',
    setup: 'handicap4',
    start: [{ c: 'B', at: 'Q16', note: '' }],
    patterns: [
      {
        id: 't',
        name: 't',
        difficulty: 1,
        order: 1,
        line: [
          { c: 'W', at: 'R14', note: 'n' },
          { c: 'B', at: 'Q14', note: 'n' },
          { c: 'W', at: 'tenuki', note: 'n' },
          { c: 'B', at: 'R13', note: 'n' },
          { c: 'W', at: 'R15', note: 'n' },
        ],
      },
    ],
  }
  const book = buildBook([def])

  function sig(req: AnalysisRequest): string {
    return req.moves.map(([c, p]) => `${c}${p}`).join(' ')
  }

  function scripted(outsideBest: string) {
    const calls: AnalysisRequest[][] = []
    async function analyseAll(reqs: AnalysisRequest[]): Promise<Analysis[]> {
      calls.push(reqs)
      return reqs.map((req) => {
        const scope = req.allowMoves ? 'region' : req.avoidMoves ? 'outside' : 'free'
        const key = `${scope}|${sig(req)}`
        switch (key) {
          case 'region|':
            return an('W', [['K10', 2.0, 250], ['R14', 1.0, 100]])
          case 'region|WR14':
            return an('B', [['Q14', 5.0, 300], ['R13', 4.0, 50]])
          case 'region|WR14 BQ14':
            return an('W', [['Q13', 3.0, 300], ['R13', 2.5, 30]])
          case 'outside|WR14 BQ14':
            return an('W', [[outsideBest, 0.5, 300], ['C3', -20, 1]])
          case `region|WR14 BQ14 W${outsideBest}`:
            return an('B', [['P10', 2.0, 300], ['R13', 1.0, 20]])
          case `free|WR14 BQ14 W${outsideBest} BR13`:
            return an('W', [['Q9', -0.5, 200]])
          case `region|WR14 BQ14 W${outsideBest} BR13`:
            return an('W', [['Q9', 1.5, 200], ['R15', 1.0, 100]])
          default:
            throw new Error(`unscripted query ${key}`)
        }
      })
    }
    return { calls, analyseAll }
  }

  it('walks the tree in rounds: a tenuki is replaced by the engine’s best outside move for later positions', async () => {
    const { calls, analyseAll } = scripted('D10')
    const out = await analyseFamily(book, 'star44', analyseAll, { visits: 400 })

    expect(out.nodes).toEqual({
      'star44:W:R14': { loss: 1, bestAt: 'K10', kind: 'joseki' },
      'star44:W:R14/B:Q14': { loss: 0, bestAt: 'Q14', kind: 'joseki' },
      'star44:W:R14/B:Q14/W:tenuki': { loss: 2.5, bestAt: 'Q13', kind: 'joseki' },
      'star44:W:R14/B:Q14/W:tenuki/B:R13': { loss: 1.5, bestAt: 'P10', kind: 'joseki' },
      'star44:W:R14/B:Q14/W:tenuki/B:R13/W:R15': { loss: 0.5, bestAt: 'Q9', kind: 'joseki' },
    })
    expect(Object.keys(out.nodes)).toEqual([
      'star44:W:R14',
      'star44:W:R14/B:Q14',
      'star44:W:R14/B:Q14/W:tenuki',
      'star44:W:R14/B:Q14/W:tenuki/B:R13',
      'star44:W:R14/B:Q14/W:tenuki/B:R13/W:R15',
    ])
    expect(out.substitutes).toEqual({ 'star44:W:R14/B:Q14/W:tenuki@handicap4': 'D10' })

    // Round 1: three corner parents + one outside query. Round 2: two parents. Then one child query.
    expect(calls.map((c) => c.length)).toEqual([4, 2, 1])
    const round2 = calls[1]
    expect(round2.map(sig)).toEqual(['WR14 BQ14 WD10', 'WR14 BQ14 WD10 BR13'])
    for (const req of calls.flat()) expect(JSON.stringify(req)).not.toContain('tenuki')
  })

  it('a tenuki whose best outside move is a pass is replayed as a pass', async () => {
    const { calls, analyseAll } = scripted('pass')
    const out = await analyseFamily(book, 'star44', analyseAll, { visits: 400 })
    expect(out.substitutes).toEqual({ 'star44:W:R14/B:Q14/W:tenuki@handicap4': 'pass' })
    expect(calls[1].map(sig)[0]).toBe('WR14 BQ14 Wpass')
  })

  it('sends siblings that share a parent position as one query', async () => {
    const fixtureBook = buildBook([FIXTURE_FAMILY])
    const seen: string[] = []
    // Everything is a 100-visit move with score 0 and every allowed move is listed, so no child queries are needed.
    async function analyseAll(reqs: AnalysisRequest[]): Promise<Analysis[]> {
      return reqs.map((req) => {
        seen.push(`${req.allowMoves ? 'region' : req.avoidMoves ? 'outside' : 'free'}|${sig(req)}`)
        const player = req.moves.length === 0 ? req.initialPlayer : req.moves[req.moves.length - 1][0] === 'W' ? 'B' : 'W'
        // A tenuki asks for the best move outside the corner: say D10.
        const list = req.allowMoves ?? (req.avoidMoves ? ['D10'] : ['K10'])
        return an(player, list.map((m) => [m, 0, 100] as [string, number, number]))
      })
    }
    const out = await analyseFamily(fixtureBook, 'star44', analyseAll, { visits: 400 })
    expect(new Set(seen).size).toBe(seen.length)
    expect(seen.filter((s) => s === 'region|WR14 BQ14')).toHaveLength(1) // three children share this parent
    expect(Object.keys(out.nodes)).toHaveLength(nodeTasks(fixtureBook, 'star44').length)
  })

  it('reports progress through the log callback', async () => {
    const { analyseAll } = scripted('D10')
    const lines: string[] = []
    await analyseFamily(book, 'star44', analyseAll, { visits: 400, log: (m) => lines.push(m) })
    expect(lines.length).toBeGreaterThan(0)
    expect(lines.join('\n')).toMatch(/round 1/)
  })
})

describe('checkCache', () => {
  const book = buildBook([FIXTURE_FAMILY])

  it('a fresh file with sane losses has nothing to report', () => {
    const check = checkCache(book, 'star44', fileFor(book))
    expect(check.fresh).toBe(true)
    expect(check.missing).toEqual([])
    expect(check.flagged).toEqual([])
    expect(describeCheck('star44', check)).toEqual([])
  })

  it('flags a joseki node over 2.0 and a mistake under 1.5, with the pattern ids and the note', () => {
    const check = checkCache(
      book,
      'star44',
      fileFor(book, { 'W:R14/B:Q14/W:Q13': 3.2, 'W:R14/B:Q14/W:Q13/B:R13': 0.8 }),
    )
    expect(check.flagged.map((f) => [f.nodeKey, f.reason])).toEqual([
      ['W:R14/B:Q14/W:Q13', 'too-lossy'],
      ['W:R14/B:Q14/W:Q13/B:R13', 'not-a-mistake'],
    ])
    const [lossy, soft] = check.flagged
    expect(lossy).toMatchObject({
      family: 'star44',
      kind: 'joseki',
      loss: 3.2,
      bestAt: 'K10',
      patternIds: ['fixture-hane'],
      note: 'Hane underneath. White gets room on the side.',
    })
    expect(soft.kind).toBe('mistake')
    const text = describeCheck('star44', check).join('\n')
    expect(text).toContain('W:R14/B:Q14/W:Q13')
    expect(text).toContain('Hane underneath. White gets room on the side.')
    expect(text).toContain('Cutting too early')
  })

  it('judges a node by the kind it has now, not the kind the file was written with', () => {
    const file = fileFor(book, { 'W:R14/B:Q14/W:Q13/B:R13': 0.8 })
    file.nodes['star44:W:R14/B:Q14/W:Q13/B:R13'].kind = 'joseki'
    expect(checkCache(book, 'star44', file).flagged.map((f) => f.nodeKey)).toEqual(['W:R14/B:Q14/W:Q13/B:R13'])
  })

  it('reports a stale file (the family changed) and nodes the file does not have', () => {
    const file = fileFor(book)
    file.familyHash = '00000000000000'
    delete file.nodes['star44:W:R14/B:Q14']
    const check = checkCache(book, 'star44', file)
    expect(check.fresh).toBe(false)
    expect(check.missing).toEqual(['W:R14/B:Q14'])
    const text = describeCheck('star44', check).join('\n')
    expect(text).toMatch(/out of date/)
    expect(text).toContain('npx tsx tools/check-book.ts --family star44')
    expect(text).toContain('W:R14/B:Q14')
  })
})

describe('formatFlagTable', () => {
  it('prints family, patterns, node, kind, loss, engine move, and the note under each row', () => {
    const book = buildBook([FIXTURE_FAMILY])
    const file = fileFor(book, { 'W:R14/B:Q14/W:Q13': 3.25 })
    file.nodes['star44:W:R14/B:Q14/W:Q13'].bestAt = 'P12'
    const check = checkCache(book, 'star44', file)
    const table = formatFlagTable(check.flagged)
    const [header, row, noteLine] = table.split('\n')
    expect(header).toMatch(/FAMILY\s+PATTERNS\s+NODE\s+KIND\s+LOSS\s+ENGINE/)
    expect(row).toMatch(/star44\s+fixture-hane\s+W:R14\/B:Q14\/W:Q13\s+joseki\s+3\.25\s+P12/)
    expect(noteLine.trim()).toBe('Hane underneath. White gets room on the side.')
  })

  it('says so when nothing is flagged', () => {
    expect(formatFlagTable([])).toMatch(/nothing flagged/i)
  })
})
