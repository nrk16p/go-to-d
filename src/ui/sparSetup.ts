// Turns the Spar route's parameters into a session config (R28): side defaults to defend (and to a side
// the family is played from, R46), mode to drill when a pattern is named (free otherwise), and sym and
// seed are random unless given.

import { bookIndex } from '../book/siblings'
import type { Book, FamilyId } from '../book/types'
import { DEFAULT_THRESHOLDS, type SparConfig } from '../session/controller'
import { drillableSides, familySides, type Side } from '../session/sides'
import { reviewKey, type Progress } from '../progress/srs'
import type { Sym } from '../go/coords'
import { COPY } from './copy'
import type { SparParams } from './router'

export type SparSetup = { ok: true; config: SparConfig } | { ok: false; error: string }

function intIn(s: string | undefined, min: number, max: number): number | null {
  if (s === undefined || !/^\d+$/.test(s)) return null
  const n = Number(s)
  return n >= min && n <= max ? n : null
}

/**
 * The positions the reviews on `side` list as missed, in this family and the ones that start the same way
 * (R42: free sparring walks their trees too). Free sparring steers toward them.
 */
export function missedKeys(book: Book, progress: Progress | null, family: FamilyId, side: Side): Set<string> {
  const out = new Set<string>()
  if (!progress) return out
  const group = bookIndex(book).group(family)
  for (const [id, entry] of Object.entries(book.patterns)) {
    if (!group.includes(entry.family)) continue
    const r = progress.reviews[reviewKey(id, side)]
    for (const k of r?.missedKeys ?? []) out.add(k)
  }
  return out
}

export function resolveSpar(
  params: SparParams,
  book: Book,
  progress: Progress | null,
  random: () => number = Math.random,
): SparSetup {
  const patternId = params.pattern
  const entry = patternId !== undefined && Object.hasOwn(book.patterns, patternId) ? book.patterns[patternId] : undefined
  if (patternId !== undefined && !entry) return { ok: false, error: COPY.spar.unknownPattern(patternId) }

  const family = (entry?.family ?? params.family) as FamilyId | undefined
  if (!family || !Object.hasOwn(book.families, family)) return { ok: false, error: COPY.spar.unknownFamily }

  const mode: 'drill' | 'free' = params.mode === 'free' || !entry ? 'free' : 'drill'
  let side: Side = params.side === 'attack' ? 'attack' : 'defend'
  // A family played from one side only (the 4-stone opening is Black's, R46) takes that side, free sparring too.
  const allowed = familySides(book.families[family].def)
  if (!allowed.includes(side)) side = allowed[0]
  if (mode === 'drill') {
    const sides = drillableSides(book, patternId!)
    if (sides.length === 0) return { ok: false, error: COPY.spar.noSide }
    if (!sides.includes(side)) side = sides[0]
  }
  const sym = (intIn(params.sym, 0, 7) ?? Math.floor(random() * 8)) as Sym
  const seed = intIn(params.seed, 0, 0xffffffff) ?? Math.floor(random() * 0x100000000)

  return {
    ok: true,
    config: {
      mode,
      family,
      ...(mode === 'drill' ? { patternId } : {}),
      side,
      sym,
      seed,
      thresholds: progress?.settings.thresholds ?? DEFAULT_THRESHOLDS,
      missed: missedKeys(book, progress, family, side),
    },
  }
}
