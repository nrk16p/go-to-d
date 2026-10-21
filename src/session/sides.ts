// Which colour the owner plays, and from which sides a pattern can be drilled.

import { colorOf } from '../book/color'
import type { Book, FamilyDef } from '../book/types'
import { otherColor, type Color } from '../go/rules'

/** 'defend' = the owner plays the corner stone's colour; 'attack' = the owner approaches or invades it. */
export type Side = 'attack' | 'defend'

export const SIDES: readonly Side[] = ['defend', 'attack']

/** The owner's colour: the corner stone's colour when defending, the other colour when attacking. */
export function ownerColor(family: FamilyDef, side: Side): Color {
  const corner = colorOf(family.start[0].c)
  return side === 'defend' ? corner : otherColor(corner)
}

/**
 * The sides a pattern can be drilled from: both, unless its main line holds a `trick`. Then only the
 * side that answers the trick, since drilling the trick's own side would teach a losing move as the answer.
 */
export function drillableSides(book: Book, patternId: string): Side[] {
  const entry = Object.hasOwn(book.patterns, patternId) ? book.patterns[patternId] : undefined
  if (!entry) throw new Error(`Unknown pattern "${patternId}"`)
  const family = book.families[entry.family].def
  const tricksters = new Set(entry.path.filter((n) => n.kind === 'trick' && n.move).map((n) => n.move!.color))
  return SIDES.filter((side) => !tricksters.has(ownerColor(family, side)))
}
