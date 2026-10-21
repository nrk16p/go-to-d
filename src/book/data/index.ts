// The real joseki book. Each family lives in its own file in this folder and is listed in ALL_FAMILIES.

import { buildBook } from '../build'
import type { FamilyDef } from '../types'
import { STAR44 } from './star44'

/** Families of the book, in course order. */
export const ALL_FAMILIES: FamilyDef[] = [STAR44]

export const BOOK = buildBook(ALL_FAMILIES)
