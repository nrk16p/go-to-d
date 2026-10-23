// Whole-board setups around the studied corner (or an empty board for an opening), and the position a
// drill starts from.

import {
  BOARD_REGION,
  CORNER_REGION,
  parseGtp,
  transform,
  transformRegion,
  type Color,
  type Move,
  type Region,
  type Sym,
} from '../go/coords'
import { emptyPosition, placeSetup, type Position } from '../go/rules'
import { colorOf } from './color'
import type { Book, FamilyDef, FamilyId, FamilyRegion, PatternDef, SetupId } from './types'

export interface SetupResult {
  stones: Move[]
  toMove: Color
  komi: number
}

function stone(gtp: string, player: Color): Move {
  return { ...parseGtp(gtp), player }
}

/**
 * Canonical frame (studied corner upper right): the corner stones plus the other three star points, White
 * moves first. 'empty' is an empty board with Black to move (R46); validateBook keeps corner stones out of it.
 */
export const SETUPS: Record<SetupId, (cornerStones: Move[]) => SetupResult> = {
  handicap4: (corner) => ({
    stones: [...corner, stone('D4', 'black'), stone('D16', 'black'), stone('Q4', 'black')],
    toMove: 'white',
    komi: 0.5,
  }),
  even: (corner) => ({
    stones: [...corner, stone('D4', 'black'), stone('D16', 'white'), stone('Q4', 'white')],
    toMove: 'white',
    komi: 7.5,
  }),
  empty: (corner) => ({
    stones: [...corner],
    toMove: 'black',
    komi: 7.5,
  }),
}

/** What the family studies (R46): its corner, or the whole board. Missing means 'corner'. */
export function familyRegion(def: Pick<FamilyDef, 'region'>): FamilyRegion {
  return def.region ?? 'corner'
}

/** True for a whole-board opening family (R46). */
export function isBoardFamily(def: Pick<FamilyDef, 'region'>): boolean {
  return familyRegion(def) === 'board'
}

/** The family's region in the canonical frame: the corner, or every point of the board. */
export function canonicalRegion(def: Pick<FamilyDef, 'region'>): Region {
  return isBoardFamily(def) ? BOARD_REGION : CORNER_REGION
}

/**
 * The start for a family (and optionally one of its patterns, which may override the setup),
 * from the definitions themselves. Throws if a corner stone is unreadable or the stones collide.
 * validateBook uses this directly so a duplicate pattern id cannot hide a pattern from it.
 */
export function startFromDef(
  family: FamilyDef,
  pattern: PatternDef | null,
  sym: Sym,
): { pos: Position; komi: number; region: Region } {
  const corner: Move[] = family.start.map((s, i) => {
    try {
      return { ...parseGtp(s.at), player: colorOf(s.c) }
    } catch (e) {
      throw new Error(`${family.id} start[${i}]: ${(e as Error).message}`)
    }
  })
  const { stones, toMove, komi } = SETUPS[pattern?.setup ?? family.setup](corner)
  const placed: Move[] = stones.map((s) => ({ ...transform(s, sym), player: s.player }))
  return {
    pos: placeSetup(emptyPosition(), placed, toMove),
    komi,
    // The whole board turns into itself.
    region: transformRegion(canonicalRegion(family), sym),
  }
}

/**
 * Where a drill or a free spar starts, under symmetry `sym`: the corner stones and the setup stones
 * transformed together. `patternId: null` is free sparring and uses the family's setup. `region` is the
 * studied corner, or the whole board for an opening family.
 */
export function startPosition(
  book: Book,
  family: FamilyId,
  patternId: string | null,
  sym: Sym,
): { pos: Position; komi: number; region: Region } {
  const fam = book.families[family]
  if (!fam) throw new Error(`Unknown family "${family}"`)
  let pattern: PatternDef | null = null
  if (patternId !== null) {
    const entry = Object.hasOwn(book.patterns, patternId) ? book.patterns[patternId] : undefined
    if (!entry) throw new Error(`Unknown pattern "${patternId}"`)
    if (entry.family !== family) throw new Error(`Pattern "${patternId}" belongs to ${entry.family}, not ${family}`)
    pattern = entry.def
  }
  return startFromDef(fam.def, pattern, sym)
}
