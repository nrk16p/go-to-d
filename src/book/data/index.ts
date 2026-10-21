// The real joseki book. Each family lives in its own file in this folder and is listed in ALL_FAMILIES.

import { buildBook } from '../build'
import type { FamilyDef } from '../types'

/** Families of the book. Empty until the content tasks add theirs. */
export const ALL_FAMILIES: FamilyDef[] = []

export const BOOK = buildBook(ALL_FAMILIES)
