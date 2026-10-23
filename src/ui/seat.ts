// What the owner's side is called on screen. A corner family names it by what the owner does there
// (defending, attacking); a whole-board opening names it by colour (Black, White), since there is no
// corner to defend (R46). Under the hood both are the same Side, so progress keys don't change.

import { isBoardFamily } from '../book/setups'
import type { FamilyDef } from '../book/types'
import type { Color } from '../go/coords'
import { ownerColor, type Side } from '../session/sides'
import { COPY, type Copy } from './copy'

/** The owner's colour when the family names sides by colour (an opening); null for a corner family. */
export function seatColor(family: FamilyDef, side: Side): Color | null {
  return isBoardFamily(family) ? ownerColor(family, side) : null
}

/** "Defending" / "Attacking" for a corner, "Black" / "White" for an opening: Today's queue, the report. */
export function sideLabel(family: FamilyDef, side: Side, copy: Copy = COPY): string {
  const c = seatColor(family, side)
  return c ? copy.colorName(c) : copy.sideName(side)
}

/** The short form for the Library: "Defend" / "Attack", or "Black" / "White". */
export function sideShortLabel(family: FamilyDef, side: Side, copy: Copy = COPY): string {
  const c = seatColor(family, side)
  return c ? copy.colorName(c) : copy.library.sideShort(side)
}

/** A drill's side as a button or group label: "Defend as Black" in a corner, "Play as Black" in an opening. */
export function drillLabel(family: FamilyDef, side: Side, copy: Copy = COPY): string {
  const c = ownerColor(family, side)
  return seatColor(family, side) ? copy.pattern.drillColor(c) : copy.pattern.drill(side, c)
}
