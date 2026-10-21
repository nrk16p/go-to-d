import { describe, expect, it } from 'vitest'
import { buildBook, familyHash } from '../../src/book/build'
import { BOOK } from '../../src/book/data'
import type { BookNode, FamilyDef, FamilyId } from '../../src/book/types'
import {
  checkCache,
  describeCheck,
  flagFor,
  parseVerifyFile,
  verifyKey,
  type VerifyFile,
} from '../../tools/book-check'
import { FIXTURE_FAMILY } from './fixture'
import fixtureVerifyText from './fixture-verify.json?raw'

// The committed engine results, one file per family (written by tools/check-book.ts).
const verifyFiles = import.meta.glob<string>('../../src/book/verify/*.json', {
  eager: true,
  query: '?raw',
  import: 'default',
})

describe('the book against its committed KataGo check', () => {
  it('every family with patterns has a fresh check file with no flagged node', () => {
    const problems: string[] = []
    for (const id of Object.keys(BOOK.families) as FamilyId[]) {
      if (BOOK.families[id].def.patterns.length === 0) continue
      const text = verifyFiles[`../../src/book/verify/${id}.json`]
      if (text === undefined) {
        problems.push(`${id}: no check file at src/book/verify/${id}.json. Run: npx tsx tools/check-book.ts --family ${id}`)
        continue
      }
      const file = parseVerifyFile(text, `src/book/verify/${id}.json`)
      problems.push(...describeCheck(id, checkCache(BOOK, id, file)))
    }
    expect(problems, problems.join('\n')).toEqual([])
  })
})

// The same checks on a real engine run over the test family. Its moves are legal but not serious joseki,
// so flagged nodes are expected: the test pins which ones, so the check logic is exercised for real.

function clone<T>(x: T): T {
  return JSON.parse(JSON.stringify(x)) as T
}

function nodes(root: BookNode, out: BookNode[] = []): BookNode[] {
  for (const c of root.children) {
    out.push(c)
    nodes(c, out)
  }
  return out
}

// Which fixture nodes the run flagged. The fixture's moves are legal, not serious joseki.
const PINNED_FLAGS: string[] = [
  'W:R14/B:Q14/W:Q13/B:P13/W:R13 too-lossy',
  'W:R14/B:Q14/W:R13 too-lossy',
  'W:R14/B:Q14/W:R13/B:Q13 too-lossy',
  'W:R14/B:Q14/W:R13/B:Q13/W:R12 too-lossy',
  'W:R14/B:Q14/W:T19/B:S19 too-lossy',
  'W:R14/B:Q14/W:T19/B:S19/W:R13/B:T18 too-lossy',
]

describe('the fixture check file (a real run of tools/check-book.ts --fixture)', () => {
  const book = buildBook([FIXTURE_FAMILY])
  const file = parseVerifyFile(fixtureVerifyText, 'tests/book/fixture-verify.json')
  const all = nodes(book.families.star44.root)

  it('has the documented shape and a result for every node, and nothing else', () => {
    expect(file.model).toMatch(/^kata1-/)
    expect(file.visits).toBeGreaterThanOrEqual(1)
    expect(Object.keys(file.nodes)).toEqual(all.map((n) => verifyKey('star44', n.key)))
    for (const n of all) {
      const e = file.nodes[verifyKey('star44', n.key)]
      expect(e.kind).toBe(n.kind)
      expect(e.bestAt).toMatch(/^([A-HJ-T](?:[1-9]|1[0-9])|pass)$/)
    }
  })

  it('is fresh for the fixture and stays fresh when only notes are edited', () => {
    expect(file.familyHash).toBe(familyHash(book, 'star44'))
    const edited = clone(FIXTURE_FAMILY)
    for (const p of edited.patterns) for (const m of p.line) m.note = `${m.note} (reworded)`
    expect(checkCache(buildBook([edited]), 'star44', file).fresh).toBe(true)
  })

  it('goes stale when a move, a kind or the setup changes', () => {
    const moved = clone(FIXTURE_FAMILY)
    moved.patterns[0].line[4].at = 'R12'
    const kind = clone(FIXTURE_FAMILY)
    kind.patterns[0].line[2].kind = 'alternative'
    const setup: FamilyDef = { ...clone(FIXTURE_FAMILY), setup: 'even' }
    for (const def of [moved, kind, setup]) {
      expect(checkCache(buildBook([def]), 'star44', file).fresh).toBe(false)
    }
  })

  it('reports a node the file does not have', () => {
    const trimmed: VerifyFile = { ...file, nodes: { ...file.nodes } }
    delete trimmed.nodes['star44:W:R14/B:Q14']
    const check = checkCache(book, 'star44', trimmed)
    expect(check.missing).toEqual(['W:R14/B:Q14'])
    expect(describeCheck('star44', check).join('\n')).toContain('W:R14/B:Q14')
  })

  it('flags exactly the nodes the thresholds say, and describes them with their notes', () => {
    const check = checkCache(book, 'star44', file)
    expect(check.fresh).toBe(true)
    expect(check.missing).toEqual([])

    // Worked out by hand from the numbers in the file.
    const expected = all
      .filter((n) => flagFor(n.kind, file.nodes[verifyKey('star44', n.key)].loss) !== null)
      .map((n) => n.key)
    expect(check.flagged.map((f) => f.nodeKey)).toEqual(expected)

    // Pinned from the run that produced the file.
    expect(check.flagged.map((f) => `${f.nodeKey} ${f.reason}`)).toEqual(PINNED_FLAGS)

    const text = describeCheck('star44', check).join('\n')
    for (const f of check.flagged) {
      expect(text).toContain(f.nodeKey)
      if (f.note !== '') expect(text).toContain(f.note)
    }
  })
})
