// Structural and replay checks for a built book. Every message names the family, the pattern id,
// where the move sits in the pattern's arrays (line[2], branches[0].then[1]) and the node key.

import { CORNER_REGION, inRegion, parseGtp, toGtp, type Color, type Pt } from '../go/coords'
import { pass, play, type Position } from '../go/rules'
import { colorOf, nodeKey, parseAt, patternSequences, type Sequence } from './build'
import { startFromDef } from './setups'
import type { Book, BookNode, FamilyDef, FamilyId, PatternDef } from './types'

const REGION_NAME = `${toGtp({ x: CORNER_REGION.xMin, y: CORNER_REGION.yMax })}..${toGtp({
  x: CORNER_REGION.xMax,
  y: CORNER_REGION.yMin,
})}`

function message(e: unknown): string {
  return e instanceof Error ? e.message : String(e)
}

/** Corner stones: readable, inside the corner region. Returns false if the family's own setup cannot be placed. */
function checkStart(def: FamilyDef, errors: string[]): boolean {
  def.start.forEach((s, i) => {
    try {
      const p = parseGtp(s.at)
      colorOf(s.c)
      if (!inRegion(p, CORNER_REGION)) {
        errors.push(`${def.id}: start[${i}] "${s.at}" is outside the corner region ${REGION_NAME}`)
      }
    } catch (e) {
      errors.push(`${def.id}: start[${i}] "${s.at}" is not a point on the board (${message(e)})`)
    }
  })
  try {
    startFromDef(def, null, 0)
    return true
  } catch (e) {
    errors.push(`${def.id}: setup "${def.setup}" cannot be placed: ${message(e)}`)
    return false
  }
}

/** Checks that need the merged tree: a note on every node, a usable weight. One message per node. */
function checkNodes(familyId: string, node: BookNode, errors: string[]) {
  if (node.move !== null) {
    const ids = node.patternIds.map((id) => `"${id}"`).join(', ')
    const depth = node.key.split('/').length
    if (node.note.trim() === '') {
      errors.push(`${familyId} node "${node.key}" (move ${depth}) has no note; used by pattern ${ids}`)
    }
    if (!(Number.isFinite(node.weight) && node.weight > 0)) {
      errors.push(`${familyId} node "${node.key}" (move ${depth}): weight must be a positive number, got ${node.weight}; pattern ${ids}`)
    }
  }
  for (const child of node.children) checkNodes(familyId, child, errors)
}

/**
 * Plays one sequence from `start`. Stops at the first problem. A problem in the part that repeats
 * the line (before `seq.from`) was already reported with the line, so it is not reported again.
 */
function checkSequence(familyId: string, pattern: PatternDef, seq: Sequence, start: Position, errors: string[]) {
  let pos = start
  const trail: Array<{ color: Color; at: Pt | 'tenuki' }> = []
  for (let i = 0; i < seq.moves.length; i++) {
    const { spec, loc } = seq.moves[i]
    const report = i >= seq.from
    const color = colorOf(spec.c)
    const at = parseAt(spec.at)
    trail.push({ color, at })
    const fail = (problem: string) => {
      if (report) {
        errors.push(
          `${familyId}: pattern "${pattern.id}" ${loc} (${spec.c} ${spec.at}, node "${nodeKey(trail)}"): ${problem}`,
        )
      }
    }

    if (at !== 'tenuki' && toGtp(at) !== spec.at) fail(`write the point as "${toGtp(at)}", not "${spec.at}"`)
    if (color !== pos.toMove) {
      fail(`${color} plays, but ${pos.toMove} is to move (colours must alternate, tenuki included)`)
      return
    }
    if (at === 'tenuki') {
      pos = pass(pos)
      continue
    }
    if (!inRegion(at, CORNER_REGION)) {
      fail(`outside the corner region ${REGION_NAME}`)
      return
    }
    const result = play(pos, at, color)
    if ('illegal' in result) {
      fail(`illegal move (${result.illegal})`)
      return
    }
    pos = result.pos
  }
}

function checkPattern(def: FamilyDef, pattern: PatternDef, errors: string[]) {
  if (pattern.line.length === 0) {
    errors.push(`${def.id}: pattern "${pattern.id}" has an empty line`)
    return
  }
  let start: Position
  try {
    start = startFromDef(def, pattern, 0).pos
  } catch (e) {
    // The family's own setup problem is already reported by checkStart.
    if (pattern.setup !== undefined) {
      errors.push(`${def.id}: pattern "${pattern.id}" setup "${pattern.setup}" cannot be placed: ${message(e)}`)
    }
    return
  }
  for (const seq of patternSequences(pattern)) checkSequence(def.id, pattern, seq, start, errors)
}

/** All problems with the book, one string each. Empty means the book is valid. */
export function validateBook(book: Book): string[] {
  const errors = [...book.issues]
  for (const id of Object.keys(book.families) as FamilyId[]) {
    const { def, root } = book.families[id]
    checkStart(def, errors)
    checkNodes(def.id, root, errors)
    for (const pattern of def.patterns) checkPattern(def, pattern, errors)
  }
  return errors
}
