// How a session talks to the engine. Every call is capped at ENGINE_TIMEOUT_MS, every rejection is
// handled (and logged), at most one look-ahead analysis runs at a time, and a tenuki without a point
// gets one here.

import { deadline, pageVisibility, type PageVisibility } from '../engine/deadline'
import type { CornerAnalysis, TeacherEngine } from '../engine/teacher'
import { BOARD_SIZE, inRegion, parseGtp, transform, withMargin, type Pt, type Region, type Sym } from '../go/coords'
import { play, type Color, type Position } from '../go/rules'

/** The longest any engine call is waited for; after that the move is unjudged (or the teacher stops). */
export const ENGINE_TIMEOUT_MS = 8000

/** Big points away from the studied corner (canonical frame): where a tenuki goes when the engine has none. */
const BIG_POINTS: Pt[] = ['D10', 'K4', 'C14', 'N3', 'C6', 'F3', 'F17', 'R7', 'G10', 'K7'].map(parseGtp)

/**
 * The value, or null if the call rejects or takes longer than ENGINE_TIMEOUT_MS. Time the page spends
 * hidden doesn't count (R41): the engine is asleep with it, and wakes up with it.
 */
export function timed<T>(p: Promise<T>, what: string, vis: PageVisibility = pageVisibility): Promise<T | null> {
  return new Promise((resolve) => {
    const cancel = deadline(
      ENGINE_TIMEOUT_MS,
      () => {
        console.warn(`[spar] ${what} took longer than ${ENGINE_TIMEOUT_MS} ms`)
        resolve(null)
      },
      vis,
    )
    const done = (v: T | null) => {
      cancel()
      resolve(v)
    }
    p.then(done, () => done(null))
  })
}

/** Starts an engine call. A throw becomes a rejection; every rejection is logged, so none goes unhandled. */
export function ask<T>(what: string, call: () => Promise<T>): Promise<T> {
  let p: Promise<T>
  try {
    p = call()
  } catch (err) {
    p = Promise.reject(err)
  }
  p.catch((err: unknown) => console.warn(`[spar] ${what} failed:`, err))
  return p
}

export function legal(pos: Position, p: Pt, color: Color): boolean {
  return !('illegal' in play(pos, p, color))
}

/** One session's view of the engine: its komi, its corner and its frame. */
export class EngineAccess {
  private readonly engine: TeacherEngine
  private readonly komi: number
  private readonly region: Region
  private sym: Sym
  private readonly isCurrent: (pos: Position) => boolean
  /** The latest analysis asked for, by position. */
  private cached: { pos: Position; analysis: Promise<CornerAnalysis> } | null = null
  private lookingAhead = false
  private queued: Position | null = null

  /** `isCurrent` says whether a queued look-ahead is still worth running when its turn comes. */
  constructor(engine: TeacherEngine, komi: number, region: Region, sym: Sym, isCurrent: (pos: Position) => boolean) {
    this.engine = engine
    this.komi = komi
    this.region = region
    this.sym = sym
    this.isCurrent = isCurrent
  }

  /** The book turned on the board (R47). Analyses are of board positions, so the ones kept stay good. */
  setSym(sym: Sym): void {
    this.sym = sym
  }

  /**
   * Analyses `pos` ahead of time while the owner thinks. The engine runs one search at a time, so
   * looking ahead on every turn could pile up stale searches in front of the one that matters: only
   * one look-ahead runs; a newer one waits for it and is dropped if the game has moved on by then.
   */
  lookAhead(pos: Position): void {
    if (this.engine.status() !== 'ready' || this.cached?.pos === pos) return
    if (this.lookingAhead) {
      this.queued = pos
      return
    }
    this.lookingAhead = true
    const settle = () => {
      this.lookingAhead = false
      const next = this.queued
      this.queued = null
      if (next && this.isCurrent(next)) this.lookAhead(next)
    }
    this.start(pos).then(settle, settle)
  }

  /** The analysis of `pos` (board frame, from the side to move), or null: engine not ready, failed or too slow. */
  analysis(pos: Position): Promise<CornerAnalysis | null> {
    if (this.engine.status() !== 'ready') return Promise.resolve(null)
    if (this.queued === pos) this.queued = null
    return timed(this.cached?.pos === pos ? this.cached.analysis : this.start(pos), 'analyzeCorner')
  }

  /** How many points `color` leads by in `pos`, or null like `analysis`. */
  score(pos: Position, color: Color): Promise<number | null> {
    if (this.engine.status() !== 'ready') return Promise.resolve(null)
    return timed(
      ask('scoreFor', () => this.engine.scoreFor(pos, this.komi, color)),
      'scoreFor',
    )
  }

  /**
   * Where a tenuki goes: the engine's move elsewhere, else the first free big point, else any free point
   * away from the corner. Never on the corner's margin line, which counts as the corner (R43).
   */
  tenukiPoint(pos: Position, a: CornerAnalysis | null, color: Color): Pt {
    const near = withMargin(this.region)
    const ok = (p: Pt) => !inRegion(p, near) && legal(pos, p, color)
    if (a?.tenukiBest && ok(a.tenukiBest.pt)) return a.tenukiBest.pt
    const big = BIG_POINTS.map((p) => transform(p, this.sym)).find(ok)
    if (big) return big
    for (let y = 0; y < BOARD_SIZE; y++) for (let x = 0; x < BOARD_SIZE; x++) if (ok({ x, y })) return { x, y }
    throw new Error('No free point outside the corner')
  }

  private start(pos: Position): Promise<CornerAnalysis> {
    const analysis = ask('analyzeCorner', () => this.engine.analyzeCorner(pos, this.komi, this.region))
    this.cached = { pos, analysis }
    return analysis
  }
}
