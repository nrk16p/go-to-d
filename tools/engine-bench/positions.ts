// The 30 positions the engine benchmark judges candidate networks on (canonical frame: the
// studied corner is the upper right, Black's corner stone on Q16, region = CORNER_REGION).
// Every position of the test family (tests/book/fixture.ts), then the usual first moves against
// a 4-4 stone in a 4-stone handicap game, then two even-game positions.
// Used by tools/engine-bench/reference.ts (native KataGo) and by the in-browser bench page.

import { patternSequences } from '../../src/book/build'
import { SETUPS } from '../../src/book/setups'
import type { SetupId } from '../../src/book/types'
import { CORNER_REGION, parseGtp, type Color, type Move, type Region } from '../../src/go/coords'
import { emptyPosition, otherColor, pass, placeSetup, play, type Position } from '../../src/go/rules'
import { FIXTURE_FAMILY } from '../../tests/book/fixture'

export interface BenchPosition {
  /** "handicap4: W R14, B Q14, W tenuki" */
  id: string
  setup: SetupId
  /** Setup stones, the corner stone included. */
  stones: Move[]
  /** Who moves first after the setup. */
  first: Color
  /** GTP points or 'tenuki', alternating from `first`. */
  moves: string[]
  pos: Position
  komi: number
  region: Region
}

const CORNER_STONES: Move[] = FIXTURE_FAMILY.start.map((s) => ({ ...parseGtp(s.at), player: s.c === 'B' ? 'black' : 'white' }))

function build(setup: SetupId, moves: string[]): BenchPosition {
  const s = SETUPS[setup](CORNER_STONES)
  let pos = placeSetup(emptyPosition(), s.stones, s.toMove)
  for (const m of moves) {
    if (m === 'tenuki') {
      pos = pass(pos)
      continue
    }
    const r = play(pos, parseGtp(m), pos.toMove)
    if ('illegal' in r) throw new Error(`bench position ${moves.join(' ')}: ${m} is ${r.illegal}`)
    pos = r.pos
  }
  let color = s.toMove
  const named = moves.map((m) => {
    const out = `${color === 'black' ? 'B' : 'W'} ${m}`
    color = otherColor(color)
    return out
  })
  return {
    id: `${setup}: ${named.join(', ') || 'start'}`,
    setup,
    stones: s.stones,
    first: s.toMove,
    moves,
    pos,
    komi: s.komi,
    region: CORNER_REGION,
  }
}

/** Every distinct position along the test family's lines and branches, the start included. */
function fixtureLines(): string[][] {
  const seen = new Set<string>()
  const out: string[][] = []
  for (const p of FIXTURE_FAMILY.patterns) {
    for (const seq of patternSequences(p)) {
      const moves = seq.moves.map((m) => m.spec.at)
      for (let n = 0; n <= moves.length; n++) {
        const prefix = moves.slice(0, n)
        const key = prefix.join(' ')
        if (seen.has(key)) continue
        seen.add(key)
        out.push(prefix)
      }
    }
  }
  return out
}

/** Common first moves against the 4-4 stone (3-3 invasion, approaches, a pincer). */
const STANDARD_LINES: string[][] = [
  ['R17'],
  ['R17', 'Q17'],
  ['R17', 'Q17', 'R16'],
  ['R17', 'Q17', 'R16', 'Q15'],
  ['R17', 'R16'],
  ['O17'],
  ['R14', 'R11'],
  ['R14', 'R11', 'R17'],
  ['O16'],
]

export function benchPositions(): BenchPosition[] {
  const out = [
    ...fixtureLines().map((m) => build('handicap4', m)),
    ...STANDARD_LINES.map((m) => build('handicap4', m)),
    build('even', []),
    build('even', ['R14']),
  ]
  if (out.length !== 30) throw new Error(`expected 30 bench positions, got ${out.length}`)
  return out
}
