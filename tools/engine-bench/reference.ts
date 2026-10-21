// Native KataGo's answer for the 30 benchmark positions: the top moves inside the corner region.
// The browser benchmark scores a candidate network by how often its corner move is in this top 3.
//
//   npx tsx tools/engine-bench/reference.ts [--visits 1600]
//
// Writes tools/engine-bench/reference.json (committed). Needs native KataGo, see tools/README.md.
// Rules: area scoring, simple ko, and no handicap bonus for White ("whb0"), because the browser
// port does not add one; native "chinese" would give White 4 extra points in the handicap setups.

import { writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { toGtp } from '../../src/go/coords'
import { withEngine } from '../katago.ts'
import type { AnalysisRequest, Letter } from '../katago-protocol'
import { benchPositions, type BenchPosition } from './positions'

export const REFERENCE_RULES = 'koSIMPLEscoreAREAtaxNONEsui0whb0'

export interface ReferenceFile {
  model: string
  visits: number
  rules: string
  positions: Array<{
    id: string
    /** Native KataGo's best moves in the region, best first (passes left out). */
    top: string[]
    /** Their scores, from the view of the player to move. */
    scores: number[]
  }>
}

const letter = (c: 'black' | 'white'): Letter => (c === 'black' ? 'B' : 'W')

export function nativeRequest(b: BenchPosition, visits: number): AnalysisRequest {
  const allow: string[] = []
  for (let y = b.region.yMin; y <= b.region.yMax; y++) {
    for (let x = b.region.xMin; x <= b.region.xMax; x++) allow.push(toGtp({ x, y }))
  }
  let color = b.first
  const moves: Array<[Letter, string]> = b.moves.map((m) => {
    const out: [Letter, string] = [letter(color), m === 'tenuki' ? 'pass' : m]
    color = color === 'black' ? 'white' : 'black'
    return out
  })
  return {
    initialStones: b.stones.map((s) => [letter(s.player), toGtp(s)]),
    initialPlayer: letter(b.first),
    moves,
    komi: b.komi,
    rules: REFERENCE_RULES,
    maxVisits: visits,
    allowMoves: allow,
  }
}

async function main() {
  const i = process.argv.indexOf('--visits')
  const visits = i > 0 ? Number(process.argv[i + 1]) : 1600
  const positions = benchPositions()
  const results = await withEngine(async (engine) => {
    const answers = await engine.analyseAll(
      positions.map((p) => nativeRequest(p, visits)),
      (done, total) => process.stdout.write(`\r${done}/${total}`),
    )
    process.stdout.write('\n')
    return { model: engine.model, answers }
  })
  const file: ReferenceFile = {
    model: results.model,
    visits,
    rules: REFERENCE_RULES,
    positions: positions.map((p, k) => {
      const moves = results.answers[k].moves.filter((m) => m.move.toLowerCase() !== 'pass').slice(0, 5)
      return { id: p.id, top: moves.map((m) => m.move), scores: moves.map((m) => Math.round(m.scoreLead * 100) / 100) }
    }),
  }
  const out = join(dirname(fileURLToPath(import.meta.url)), 'reference.json')
  writeFileSync(out, `${JSON.stringify(file, null, 2)}\n`)
  for (const p of file.positions) console.log(`${p.top.slice(0, 3).join(' ').padEnd(12)} ${p.id}`)
  console.log(`Wrote ${out}`)
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((e) => {
    console.error(e)
    process.exitCode = 1
  })
}
