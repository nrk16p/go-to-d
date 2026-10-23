// Which colour the owner plays, and from which sides a pattern can be drilled.

import { colorOf } from '../book/color'
import { isBoardFamily } from '../book/setups'
import type { Book, FamilyDef } from '../book/types'
import { otherColor, type Color } from '../go/rules'

/** 'defend' = the owner plays the corner stone's colour; 'attack' = the owner approaches or invades it. */
export type Side = 'attack' | 'defend'

export const SIDES: readonly Side[] = ['defend', 'attack']

/**
 * The owner's colour: the corner stone's colour when defending, the other colour when attacking. On an
 * empty board (setup 'empty', no corner stone) 'defend' is Black, who moves first (R46).
 */
export function ownerColor(family: FamilyDef, side: Side): Color {
  const first = family.start[0]
  const anchor: Color = first ? colorOf(first.c) : 'black'
  return side === 'defend' ? anchor : otherColor(anchor)
}

/**
 * The sides a family is played from at all. A whole-board opening from the handicap setup is Black's
 * only: in a handicap game the owner takes Black (R46). Every other family has both sides.
 */
export function familySides(family: FamilyDef): Side[] {
  if (isBoardFamily(family) && family.setup === 'handicap4') return ['defend']
  return [...SIDES]
}

/**
 * The sides a pattern can be drilled from: the family's sides (familySides), less the side that plays a
 * `trick` on the pattern's main line, since drilling the trick's own side would teach a losing move as the answer.
 */
export function drillableSides(book: Book, patternId: string): Side[] {
  const entry = Object.hasOwn(book.patterns, patternId) ? book.patterns[patternId] : undefined
  if (!entry) throw new Error(`Unknown pattern "${patternId}"`)
  const family = book.families[entry.family].def
  const tricksters = new Set(entry.path.filter((n) => n.kind === 'trick' && n.move).map((n) => n.move!.color))
  return familySides(family).filter((side) => !tricksters.has(ownerColor(family, side)))
}
