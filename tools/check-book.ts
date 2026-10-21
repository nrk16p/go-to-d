// Checks the joseki book against native KataGo and writes the result next to the book.
//
//   npx tsx tools/check-book.ts [--family <id>] [--fixture] [--visits N]
//
// Setup and what the flags mean: tools/README.md.

import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildBook, familyHash } from '../src/book/build'
import { ALL_FAMILIES } from '../src/book/data'
import type { FamilyDef } from '../src/book/types'
import { validateBook } from '../src/book/validate'
import { FIXTURE_FAMILY } from '../tests/book/fixture'
import {
  analyseFamily,
  checkCache,
  formatFlagTable,
  type VerifyFile,
} from './book-check'
import { DEFAULT_VISITS } from './katago-protocol'
import { KataGoEngine } from './katago.ts'

const USAGE = `Usage: npx tsx tools/check-book.ts [--family <id>] [--fixture] [--visits N]

  --family <id>  only this family (default: every family that has patterns)
  --fixture      check the small test family from tests/book/fixture.ts and write tests/book/fixture-verify.json
  --visits N     KataGo visits per position (default ${DEFAULT_VISITS})`

interface Args {
  family?: string
  fixture: boolean
  visits: number
}

function parseArgs(argv: string[]): Args | string {
  const args: Args = { fixture: false, visits: DEFAULT_VISITS }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--fixture') args.fixture = true
    else if (a === '--family' || a === '--visits') {
      const value = argv[++i]
      if (value === undefined || value.startsWith('--')) return `${a} needs a value`
      if (a === '--family') args.family = value
      else {
        const n = Number(value)
        if (!Number.isInteger(n) || n < 1) return `--visits needs a whole number of 1 or more, got "${value}"`
        args.visits = n
      }
    } else if (a === '--help' || a === '-h') return ''
    else return `Unknown argument "${a}"`
  }
  return args
}

const root = fileURLToPath(new URL('..', import.meta.url))

function outputPath(args: Args, family: string): string {
  const rel = args.fixture ? 'tests/book/fixture-verify.json' : `src/book/verify/${family}.json`
  return fileURLToPath(new URL(`../${rel}`, import.meta.url))
}

function showTime(ms: number): string {
  const s = Math.round(ms / 1000)
  return s < 90 ? `${s} s` : `${Math.round(s / 60)} min`
}

async function main(): Promise<number> {
  const args = parseArgs(process.argv.slice(2))
  if (typeof args === 'string') {
    console.error(args === '' ? USAGE : `${args}\n\n${USAGE}`)
    return args === '' ? 0 : 2
  }

  let families: FamilyDef[] = args.fixture ? [FIXTURE_FAMILY] : ALL_FAMILIES.filter((f) => f.patterns.length > 0)
  if (args.family !== undefined) {
    families = families.filter((f) => f.id === args.family)
    if (families.length === 0) {
      console.error(`No family "${args.family}" with patterns${args.fixture ? ' in the fixture' : ' in src/book/data/index.ts'}.`)
      return 2
    }
  }
  if (families.length === 0) {
    console.log('No family with patterns yet, nothing to check.')
    return 0
  }

  // Validate before spending engine time on a book that is broken anyway.
  const books = new Map(families.map((def) => [def.id, buildBook([def])]))
  let exit = 0
  for (const def of families) {
    const errors = validateBook(books.get(def.id)!)
    if (errors.length > 0) {
      console.error(`${def.id}: the book is not valid, fix this first (npm test shows the same):`)
      for (const e of errors) console.error(`  ${e}`)
      exit = 1
    }
  }
  if (exit !== 0) return exit

  process.on('SIGINT', () => process.exit(130)) // lets katago.ts's exit hook stop the engine
  console.error('Starting KataGo (loading the network takes a few seconds)...')
  const engine = await KataGoEngine.start()
  try {
    for (const def of families) {
      const book = books.get(def.id)!
      const started = Date.now()
      let lastShown = 0
      const analyseAll = (reqs: Parameters<typeof engine.analyseAll>[0]) =>
        engine.analyseAll(reqs, (done, total) => {
          const now = Date.now()
          if (process.stderr.isTTY && (done === total || now - lastShown > 500)) {
            lastShown = now
            process.stderr.write(`\r  ${done}/${total} positions, ${showTime(now - started)}  `)
            if (done === total) process.stderr.write('\n')
          }
        })

      const result = await analyseFamily(book, def.id, analyseAll, {
        visits: args.visits,
        log: (m) => console.error(m),
      })
      const file: VerifyFile = {
        familyHash: familyHash(book, def.id),
        model: engine.model,
        visits: args.visits,
        nodes: result.nodes,
      }
      const path = outputPath(args, def.id)
      mkdirSync(dirname(path), { recursive: true })
      writeFileSync(path, `${JSON.stringify(file, null, 2)}\n`)

      const check = checkCache(book, def.id, file)
      const nodeCount = Object.keys(file.nodes).length
      console.log(`\n${def.id}: ${nodeCount} nodes at ${args.visits} visits in ${showTime(Date.now() - started)}, ${check.flagged.length} flagged`)
      console.log(formatFlagTable(check.flagged))
      for (const [key, move] of Object.entries(result.substitutes)) {
        console.log(`Later positions replay the tenuki at ${key} as ${move}.`)
      }
      console.log(`Wrote ${relative(root, path)}`)
      if (check.flagged.length > 0 && !args.fixture) exit = 1
    }
  } finally {
    await engine.close()
  }
  return exit
}

main().then(
  (code) => process.exit(code),
  (err: unknown) => {
    console.error(err instanceof Error ? err.message : err)
    process.exit(1)
  },
)
