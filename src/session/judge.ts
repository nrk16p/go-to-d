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
  | { type: 'mistake'; better: Pt | 'tenuki'; pointsLost: number | null; big: boolean; note?: string; inBook: boolean }
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
  /** The engine's view of the position before the move, from the mover's side. */
  before: CornerAnalysis | null
  /** The mover's score after the move. */
  scoreAfter: number | null
  thresholds: Thresholds
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

function round1(x: number): number {
  return Math.round(x * 10) / 10
}

/**
 * Points lost by the move and the move the engine liked better, or null without engine data.
 * A corner move is measured against the best corner move. A tenuki is measured against the best
 * move elsewhere, unless the best corner move is bigger still: then not answering in the corner is the loss.
 */
function engineLoss(a: JudgeArgs): { loss: number; better: Pt } | null {
  if (!a.before || a.scoreAfter === null) return null
  const { cornerBest, tenukiBest } = a.before
  const ref = a.played === 'tenuki' && tenukiBest && tenukiBest.scoreLead > cornerBest.scoreLead ? tenukiBest : cornerBest
  return { loss: round1(Math.max(0, ref.scoreLead - a.scoreAfter)), better: ref.pt }
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
    // A book mistake, or a trick the owner tried: wrong either way, the book says why.
    const loss = engineLoss(args)
    const better = moveOf(bookAnswer(node, args)) ?? loss?.better ?? 'tenuki'
    const pointsLost = loss ? loss.loss : null
    return { type: 'mistake', better, pointsLost, big: pointsLost !== null && pointsLost > thresholds.big, note: child.note, inBook: true }
  }

  const loss = engineLoss(args)
  if (!loss) return { type: 'unjudged', reason: 'engine-failed' }
  if (loss.loss <= thresholds.fine) {
    return { type: 'fine-offbook', pointsLost: loss.loss, bookMove: node ? moveOf(bookAnswer(node, args)) : null }
  }
  return { type: 'mistake', better: loss.better, pointsLost: loss.loss, big: loss.loss > thresholds.big, inBook: false }
}
