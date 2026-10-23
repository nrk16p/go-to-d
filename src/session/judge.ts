// Judges one owner move: from the book when the move is in it, from the engine when it is not.
// Everything here is in the canonical frame (studied corner upper right); the controller converts.

import type { BookNode } from '../book/types'
import type { CornerAnalysis } from '../engine/teacher'
import type { Pt } from '../go/coords'

/** Points lost: up to `fine` is fine, above `big` is a big mistake. */
export interface Thresholds {
  fine: number
  big: number
}

export const DEFAULT_THRESHOLDS: Thresholds = { fine: 1.5, big: 4.0 }

export type Verdict =
  | { type: 'good'; note: string; kind: 'joseki' | 'alternative' }
  | { type: 'other-joseki'; note: string; patternIds: string[] }
  | {
      type: 'mistake'
      /** The move to play instead; null when neither the book nor the engine names one. */
      better: Pt | 'tenuki' | null
      pointsLost: number | null
      big: boolean
      note?: string
      inBook: boolean
    }
  | { type: 'fine-offbook'; pointsLost: number; bookMove: Pt | 'tenuki' | null }
  | { type: 'unjudged'; reason: 'engine-failed' | 'engine-loading' }

export interface JudgeArgs {
  /** The book node before the move (its children are the book answers); null once off book. */
  node: BookNode | null
  played: Pt | 'tenuki'
  mode: 'drill' | 'free'
  drillPatternId?: string
  /** The drilled pattern's main line, so "the drilled path's move" is exact. Optional: without it the pattern id decides. */
  drillPath?: BookNode[]
  /** For a tenuki: the point its stone went on, when the board has one (the Play elsewhere button, or a far tap). */
  tenukiAt?: Pt
  /** The engine's view of the position before the move, from the mover's side. */
  before: CornerAnalysis | null
  /**
   * The mover's score after the move, from a second search. Only needed when `before` has no value for the
   * move itself (scoreAfterNeeded); the controller doesn't ask for it otherwise.
   */
  scoreAfter: number | null
  thresholds: Thresholds
  /**
   * R29: the native book check's points lost for the book move played, when the book has it. An in-book
   * mistake reports this rather than the browser engine's (weaker) number.
   */
  checkedLoss?: number | null
}

function samePt(a: Pt | 'tenuki', b: Pt | 'tenuki'): boolean {
  if (a === 'tenuki' || b === 'tenuki') return a === b
  return a.x === b.x && a.y === b.y
}

/** The book child of `node` that `played` matches (a book `tenuki` matches 'tenuki'), or null. */
export function bookChild(node: BookNode, played: Pt | 'tenuki'): BookNode | null {
  return node.children.find((c) => c.move !== null && samePt(c.move.at, played)) ?? null
}

/** Joseki and alternative moves are fine to play; mistakes and tricks are not. */
export const isSound = (n: BookNode): boolean => n.kind === 'joseki' || n.kind === 'alternative'

/** The heaviest joseki/alternative child; on a tie joseki first, then book order. */
function heaviestSound(node: BookNode): BookNode | null {
  let best: BookNode | null = null
  for (const c of node.children) {
    if (!isSound(c)) continue
    if (!best || c.weight > best.weight || (c.weight === best.weight && c.kind === 'joseki' && best.kind !== 'joseki')) best = c
  }
  return best
}

/** The move the book wants at `node`: the drilled path's move in a drill, else the heaviest sound move. */
function bookAnswer(node: BookNode, a: JudgeArgs): BookNode | null {
  if (a.mode === 'drill') {
    const onPath = a.drillPath
      ? node.children.find((c) => a.drillPath!.includes(c))
      : node.children.find((c) => isSound(c) && a.drillPatternId !== undefined && c.patternIds.includes(a.drillPatternId))
    if (onPath) return onPath
  }
  return heaviestSound(node)
}

/** Points are shown, summed and compared with the thresholds at one decimal. */
export function round1(x: number): number {
  return Math.round(x * 10) / 10
}

/**
 * The move's own value in the analysis before it (R40): a corner move the search looked at (one of its
 * candidates), or a tenuki on the very point the search picked elsewhere. Null when the search has none.
 */
function ownValue(a: Pick<JudgeArgs, 'before' | 'played' | 'tenukiAt'>): number | null {
  if (!a.before) return null
  const { cornerBest, tenukiBest, candidates } = a.before
  if (a.played === 'tenuki') return a.tenukiAt && tenukiBest && samePt(a.tenukiAt, tenukiBest.pt) ? tenukiBest.scoreLead : null
  const played = a.played
  if (samePt(played, cornerBest.pt)) return cornerBest.scoreLead
  return candidates.find((c) => samePt(c.pt, played))?.scoreLead ?? null
}

/** Whether judging this move needs the second search, the score after it: only when the first one has no value for it. */
export function scoreAfterNeeded(a: Pick<JudgeArgs, 'before' | 'played' | 'tenukiAt'>): boolean {
  return a.before !== null && ownValue(a) === null
}

/**
 * Points lost by the move and the move the engine liked better (null when that would be the move played),
 * or null without engine data. The reference is the best corner move; for a tenuki it is the best move
 * elsewhere, unless the best corner move is bigger still (R19). When the search before the move has a value
 * for the move itself, the loss comes from that one search (R40): two short searches don't agree closely
 * enough to subtract, and a slow phone made the owner's own best move look like a mistake. Otherwise the
 * score after the move stands in for its value.
 */
function engineLoss(a: JudgeArgs): { loss: number; better: Pt | null } | null {
  if (!a.before) return null
  const { cornerBest, tenukiBest } = a.before
  const ref = a.played === 'tenuki' && tenukiBest && tenukiBest.scoreLead > cornerBest.scoreLead ? tenukiBest : cornerBest
  const value = ownValue(a) ?? a.scoreAfter
  if (value === null) return null
  const at = a.played === 'tenuki' ? a.tenukiAt : a.played
  return { loss: round1(Math.max(0, ref.scoreLead - value)), better: at && samePt(at, ref.pt) ? null : ref.pt }
}

function moveOf(n: BookNode | null): Pt | 'tenuki' | null {
  return n?.move?.at ?? null
}

export function judgeMove(args: JudgeArgs): Verdict {
  const { node, played, thresholds } = args
  const child = node ? bookChild(node, played) : null

  if (node && child) {
    if (child.kind === 'joseki' || child.kind === 'alternative') {
      const drilled = args.mode === 'drill' && (args.drillPath !== undefined || args.drillPatternId !== undefined)
      const onDrill =
        (args.drillPath?.includes(child) ?? false) ||
        (args.drillPatternId !== undefined && child.patternIds.includes(args.drillPatternId))
      if (drilled && !onDrill) return { type: 'other-joseki', note: child.note, patternIds: [...child.patternIds] }
      return { type: 'good', note: child.note, kind: child.kind }
    }
    // A book mistake, or a trick the owner tried: wrong either way, the book says why. Its points come
    // from the book check when there are any (R29), else from the engine.
    const loss = engineLoss(args)
    const better = moveOf(bookAnswer(node, args)) ?? loss?.better ?? null
    const checked = args.checkedLoss ?? null
    const pointsLost = checked !== null ? round1(Math.max(0, checked)) : loss ? loss.loss : null
    return { type: 'mistake', better, pointsLost, big: pointsLost !== null && pointsLost > thresholds.big, note: child.note, inBook: true }
  }

  const loss = engineLoss(args)
  if (!loss) return { type: 'unjudged', reason: 'engine-failed' }
  if (loss.loss <= thresholds.fine) {
    return { type: 'fine-offbook', pointsLost: loss.loss, bookMove: node ? moveOf(bookAnswer(node, args)) : null }
  }
  return { type: 'mistake', better: loss.better, pointsLost: loss.loss, big: loss.loss > thresholds.big, inBook: false }
}
