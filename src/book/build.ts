// Turns authored FamilyDefs into merged trees. Patterns that start the same way share nodes.

import { parseGtp, toGtp, type Color, type Pt } from '../go/coords'
import { colorOf } from './color'
import { SETUPS } from './setups'
import type { Book, BookNode, FamilyDef, FamilyId, MoveSpec, PatternDef, SetupId } from './types'

export { colorOf }

/** A book `at`: a GTP point or 'tenuki'. Throws like parseGtp for anything else. */
export function parseAt(at: string): Pt | 'tenuki' {
  return at === 'tenuki' ? 'tenuki' : parseGtp(at)
}

type PathMove = { color: Color; at: Pt | 'tenuki' }

function segment(m: PathMove): string {
  return `${m.color === 'black' ? 'B' : 'W'}:${m.at === 'tenuki' ? 'tenuki' : toGtp(m.at)}`
}

/** Key of a node: its moves from the root in the canonical frame, e.g. "W:R14/B:O17". Empty path = root = "". */
export function nodeKey(path: PathMove[]): string {
  return path.map(segment).join('/')
}

/** A move of a pattern's line or branch, with where the author wrote it (for error messages). */
export interface SeqMove {
  spec: MoveSpec
  /** "line[2]", "branches[0].move" or "branches[0].then[1]" */
  loc: string
}

/** A full move sequence from the setup: the line, or the line's start followed by a branch. */
export interface Sequence {
  moves: SeqMove[]
  /** Moves before this index repeat the line; only moves from here on are new. */
  from: number
}

/** The pattern's line first, then one sequence per branch. Throws if a branch's `after` is out of range. */
export function patternSequences(def: PatternDef): Sequence[] {
  const line: SeqMove[] = def.line.map((spec, i) => ({ spec, loc: `line[${i}]` }))
  const out: Sequence[] = [{ moves: line, from: 0 }]
  ;(def.branches ?? []).forEach((b, bi) => {
    if (!Number.isInteger(b.after) || b.after < 0 || b.after > def.line.length) {
      throw new Error(
        `Pattern "${def.id}" branches[${bi}]: "after" must be a whole number from 0 to ${def.line.length}, got ${b.after}`,
      )
    }
    out.push({
      moves: [
        ...line.slice(0, b.after),
        { spec: b.move, loc: `branches[${bi}].move` },
        ...(b.then ?? []).map((spec, ti) => ({ spec, loc: `branches[${bi}].then[${ti}]` })),
      ],
      from: b.after,
    })
  })
  return out
}

function parseMove(patternId: string, m: SeqMove): PathMove {
  try {
    return { color: colorOf(m.spec.c), at: parseAt(m.spec.at) }
  } catch (e) {
    throw new Error(`Pattern "${patternId}" ${m.loc}: ${(e as Error).message}`)
  }
}

/** Which pattern first set each field of a node, so later disagreements can name both. */
type Provenance = { note?: string; kind?: string; weight?: string }

function newNode(key: string, move: PathMove | null, parent: BookNode | null): BookNode {
  return { key, move, note: '', kind: 'joseki', weight: 1, children: [], patternIds: [], parent }
}

/**
 * Folds one authored move into its (shared) node.
 * Notes: the first non-empty one wins. Kind and weight: the first explicit one wins.
 * Two different explicit values for the same field are recorded in `book.issues`.
 */
function merge(book: Book, family: string, node: BookNode, patternId: string, m: SeqMove, prov: Map<BookNode, Provenance>) {
  const p = prov.get(node) ?? {}
  prov.set(node, p)
  const spec = m.spec
  const where = `${family} node "${node.key}"`
  const at = `pattern "${patternId}" ${m.loc}`

  if (spec.note.trim() !== '') {
    if (node.note.trim() === '') {
      node.note = spec.note
      p.note = patternId
    } else if (node.note.trim() !== spec.note.trim()) {
      book.issues.push(
        `${where}: two different notes. Pattern "${p.note}" says "${node.note}", ${at} says "${spec.note}"`,
      )
    }
  }
  if (spec.kind !== undefined) {
    if (p.kind === undefined) {
      node.kind = spec.kind
      p.kind = patternId
    } else if (spec.kind !== node.kind) {
      book.issues.push(`${where}: two different kinds. Pattern "${p.kind}" says ${node.kind}, ${at} says ${spec.kind}`)
    }
  }
  if (spec.weight !== undefined) {
    if (p.weight === undefined) {
      node.weight = spec.weight
      p.weight = patternId
    } else if (spec.weight !== node.weight) {
      book.issues.push(
        `${where}: two different weights. Pattern "${p.weight}" says ${node.weight}, ${at} says ${spec.weight}`,
      )
    }
  }
  if (spec.confidence === 'low') node.confidence = 'low'
}

function addPattern(book: Book, family: FamilyDef, root: BookNode, def: PatternDef, prov: Map<BookNode, Provenance>) {
  const path: BookNode[] = []
  patternSequences(def).forEach((seq, si) => {
    let node = root
    seq.moves.forEach((m, i) => {
      const move = parseMove(def.id, m)
      const key = node.key === '' ? segment(move) : `${node.key}/${segment(move)}`
      let child = node.children.find((c) => c.key === key)
      if (i >= seq.from) {
        if (!child) {
          child = newNode(key, move, node)
          node.children.push(child)
        }
        merge(book, family.id, child, def.id, m, prov)
        if (!child.patternIds.includes(def.id)) child.patternIds.push(def.id)
      }
      if (!child) throw new Error(`Pattern "${def.id}" ${m.loc}: prefix node ${key} is missing`)
      node = child
      if (si === 0) path.push(child)
    })
  })

  if (Object.hasOwn(book.patterns, def.id)) {
    book.issues.push(
      `Duplicate pattern id "${def.id}" (in ${family.id}, already used in ${book.patterns[def.id].family})`,
    )
  } else {
    book.patterns[def.id] = { def, family: family.id, path }
  }
}

/**
 * Merges the families' patterns into one tree per family. Throws on what cannot be represented
 * (an unreadable point, a branch `after` out of range, two families with one id);
 * everything else is left for validateBook. Only the given families appear in `families`.
 */
export function buildBook(defs: FamilyDef[]): Book {
  const book: Book = { families: {} as Book['families'], patterns: {}, issues: [] }
  const prov = new Map<BookNode, Provenance>()
  for (const def of defs) {
    if (Object.hasOwn(book.families, def.id)) throw new Error(`Duplicate family id "${def.id}"`)
    const root = newNode('', null, null)
    book.families[def.id] = { def, root }
    for (const pattern of def.patterns) addPattern(book, def, root, pattern, prov)
  }
  return book
}

/**
 * The setups a node is played under: one entry per distinct setup, with the first pattern
 * (in `node.patternIds` order) that uses it. Nearly always one entry; a node that two patterns
 * with different setup overrides share has two, and the engine has to judge it under both.
 */
export function nodeSetups(book: Book, family: FamilyId, node: BookNode): Array<{ setup: SetupId; patternId: string }> {
  const fam = book.families[family]
  if (!fam) throw new Error(`Unknown family "${family}"`)
  const byId = new Map<string, PatternDef>()
  for (const p of fam.def.patterns) if (!byId.has(p.id)) byId.set(p.id, p)
  const out: Array<{ setup: SetupId; patternId: string }> = []
  for (const patternId of node.patternIds) {
    const setup = byId.get(patternId)?.setup ?? fam.def.setup
    if (!out.some((o) => o.setup === setup)) out.push({ setup, patternId })
  }
  return out
}

/** 53-bit string hash (cyrb53). Plenty for telling two versions of a family apart; no crypto needed in the browser bundle. */
function hash53(text: string): number {
  let h1 = 0xdeadbeef
  let h2 = 0x41c6ce57
  for (let i = 0; i < text.length; i++) {
    const ch = text.charCodeAt(i)
    h1 = Math.imul(h1 ^ ch, 2654435761)
    h2 = Math.imul(h2 ^ ch, 1597334677)
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909)
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909)
  return 4294967296 * (2097151 & h2) + (h1 >>> 0)
}

function describeSetup(id: string): string {
  if (!Object.hasOwn(SETUPS, id)) return `${id}=unknown`
  const { stones, toMove, komi } = SETUPS[id as SetupId]([])
  const list = stones.map((s) => `${s.player === 'black' ? 'B' : 'W'}${s.x},${s.y}`).sort()
  return `${id}=${toMove}/${komi}/${list.join(' ')}`
}

function collectNodes(node: BookNode, out: BookNode[]): BookNode[] {
  for (const child of node.children) {
    out.push(child)
    collectNodes(child, out)
  }
  return out
}

/**
 * Fingerprint of everything the engine check depends on for one family: the corner stones, every node
 * (its path and kind), the setup each node is played under and what those setups contain (stones, komi).
 * Note text, confidence, weights, names, pattern ids and pattern order are left out on purpose, so
 * copy-editing a note never forces a new engine run.
 */
export function familyHash(book: Book, family: FamilyId): string {
  const fam = book.families[family]
  if (!fam) throw new Error(`Unknown family "${family}"`)
  const used = new Set<string>([fam.def.setup])
  const nodes = collectNodes(fam.root, []).map((node) => {
    const setups = nodeSetups(book, family, node).map((s) => s.setup)
    for (const s of setups) used.add(s)
    return `${node.key}|${node.kind}|${setups.sort().join(',')}`
  })
  const text = [
    `setup:${fam.def.setup}`,
    `start:${fam.def.start.map((s) => `${s.c}${s.at}`).sort().join(' ')}`,
    ...[...used].sort().map(describeSetup),
    ...nodes.sort(),
  ].join('\n')
  return hash53(text).toString(16).padStart(14, '0')
}
