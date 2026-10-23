// A scripted TeacherEngine for the session tests: no network, no worker, no TF.js.
// By default it is 'ready', says the first legal point of the region is best (score 0) with a much
// worse move elsewhere, and scores every position 0 for everyone, so off-book moves come out "fine".

import { BOARD_SIZE, inRegion, parseGtp, type Color, type Pt, type Region } from '../../src/go/coords'
import { play, type Position } from '../../src/go/rules'
import type { CornerAnalysis, EngineFailure, TeacherEngine } from '../../src/engine/teacher'

export type EngineStatus = 'loading' | 'ready' | 'failed'

export interface FakeScript {
  status?: EngineStatus
  analyze?: (pos: Position, komi: number, region: Region) => CornerAnalysis | Promise<CornerAnalysis>
  score?: (pos: Position, komi: number, color: Color) => number | Promise<number>
}

function legal(pos: Position, p: Pt): boolean {
  return !('illegal' in play(pos, p, pos.toMove))
}

/** The first empty, legal point (row by row from the top left) that `want` accepts. */
export function firstLegal(pos: Position, want: (p: Pt) => boolean): Pt {
  for (let y = 0; y < BOARD_SIZE; y++) {
    for (let x = 0; x < BOARD_SIZE; x++) {
      const p = { x, y }
      if (want(p) && legal(pos, p)) return p
    }
  }
  throw new Error('no legal point')
}

/** First legal point in the region is best (score `corner`); first legal point outside it scores `tenuki`. */
export function defaultAnalysis(pos: Position, region: Region, corner = 0, tenuki = -20): CornerAnalysis {
  const best = firstLegal(pos, (p) => inRegion(p, region))
  const away = firstLegal(pos, (p) => !inRegion(p, region))
  return {
    toMove: pos.toMove,
    cornerBest: { pt: best, scoreLead: corner },
    tenukiBest: { pt: away, scoreLead: tenuki },
    candidates: [{ pt: best, scoreLead: corner, prior: 0.5 }],
  }
}

/** A hand-written analysis; points are GTP strings in the board frame. */
export function analysisOf(
  toMove: Color,
  corner: Array<[string, number]>,
  tenuki: [string, number] | null,
): CornerAnalysis {
  const candidates = corner.map(([at, scoreLead]) => ({ pt: parseGtp(at), scoreLead, prior: 0.1 }))
  return {
    toMove,
    cornerBest: { pt: candidates[0].pt, scoreLead: candidates[0].scoreLead },
    tenukiBest: tenuki ? { pt: parseGtp(tenuki[0]), scoreLead: tenuki[1] } : null,
    candidates,
  }
}

export class FakeEngine implements TeacherEngine {
  current: EngineStatus
  /** Why it stopped, for the engine hub's respawn rules (R41). */
  failedBy: EngineFailure | null = null
  readonly analyzeCalls: Array<{ pos: Position; komi: number; region: Region }> = []
  readonly scoreCalls: Array<{ pos: Position; komi: number; color: Color }> = []
  private readonly script: FakeScript

  constructor(script: FakeScript = {}) {
    this.script = script
    this.current = script.status ?? 'ready'
  }

  status(): EngineStatus {
    return this.current
  }

  ready(): Promise<{ backend: string; model: string }> {
    if (this.current === 'failed') return Promise.reject(new Error('fake engine failed to load'))
    if (this.current === 'loading') return new Promise(() => {})
    return Promise.resolve({ backend: 'fake', model: 'fake-net' })
  }

  async analyzeCorner(pos: Position, komi: number, region: Region): Promise<CornerAnalysis> {
    this.analyzeCalls.push({ pos, komi, region })
    if (this.current !== 'ready') throw new Error(`fake engine is ${this.current}`)
    return this.script.analyze ? this.script.analyze(pos, komi, region) : defaultAnalysis(pos, region)
  }

  async scoreFor(pos: Position, komi: number, color: Color): Promise<number> {
    this.scoreCalls.push({ pos, komi, color })
    if (this.current !== 'ready') throw new Error(`fake engine is ${this.current}`)
    return this.script.score ? this.script.score(pos, komi, color) : 0
  }

  /** Stops it the way a real engine stops: status 'failed', with a reason. */
  fail(why: EngineFailure): void {
    this.failedBy ??= why
    this.current = 'failed'
  }

  failure(): EngineFailure | null {
    return this.failedBy
  }

  dispose(): void {
    this.fail('disposed')
  }
}
