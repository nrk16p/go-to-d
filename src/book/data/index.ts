// The real book: corner joseki and whole-board openings (R46). Each family lives in its own file in this
// folder and is listed in ALL_FAMILIES.

import { buildBook } from '../build'
import type { FamilyDef } from '../types'
import { INVADE33 } from './invade33'
import { KOMOKU34 } from './komoku34'
import { OPEN_EVEN } from './open-even'
import { OPEN_H4 } from './open-h4'
import { SANSAN33 } from './sansan33'
import { STAR44 } from './star44'

/** Families of the book, in course order: the corners, then the whole-board openings (R46). */
export const ALL_FAMILIES: FamilyDef[] = [STAR44, INVADE33, KOMOKU34, SANSAN33, OPEN_H4, OPEN_EVEN]

export const BOOK = buildBook(ALL_FAMILIES)
