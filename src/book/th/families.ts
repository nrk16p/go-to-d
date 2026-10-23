// Thai for each family's own words: its name (Today, Library, the Spar title) and the note on its
// corner stone (a pattern's start position). Pattern names and node notes live in the family files.
// Terms follow the glossary at the top of invade33.ts.

import type { FamilyId } from '../types'

export interface FamilyHeadTh {
  /** The family's name. No board coordinates (R36); "4-4" is a point type, not a coordinate. */
  name: string
  /** One note per corner stone, in the order of FamilyDef.start. */
  start: string[]
}

export const TH_FAMILIES: Record<FamilyId, FamilyHeadTh> = {
  star44: { name: 'จุดดาว 4-4', start: ['หมากดำที่จุดดาว 4-4'] },
  invade33: { name: 'บุก 3-3', start: ['หมากดำที่จุดดาว 4-4'] },
  komoku34: { name: 'โคโมคุ 3-4', start: ['หมากดำที่โคโมคุ 3-4'] },
  sansan33: { name: 'จุด 3-3', start: ['หมากดำที่จุด 3-3'] },
}
