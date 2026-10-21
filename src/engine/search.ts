// The small result the teacher reads from one engine search, and the messages between
// src/engine/teacher.ts and its worker. Kept apart from both so the worker bundle does not
// pull in the worker-creating code, and the main bundle does not pull in TF.js.

import type { KataGoAnalysisPayload, KataGoAnalyzeRequest } from './katago/types'

/** One search, from Black's point of view like web-katrain's payload. Moves are best first by `order`. */
export interface EngineSearch {
  rootScoreLead: number
  rootWinRate: number
  rootVisits: number
  /** x, y < 0 is a pass. */
  moves: Array<{ x: number; y: number; scoreLead: number; winRate: number; prior: number; visits: number; order: number }>
}

/** Drops the big arrays (policy, ownership, PVs) the teacher does not use. */
export function compactSearch(p: KataGoAnalysisPayload): EngineSearch {
  return {
    rootScoreLead: p.rootScoreLead,
    rootWinRate: p.rootWinRate,
    rootVisits: p.rootVisits,
    moves: p.moves.map((m) => ({
      x: m.x,
      y: m.y,
      scoreLead: m.scoreLead,
      winRate: m.winRate,
      prior: m.prior,
      visits: m.visits,
      order: m.order,
    })),
  }
}

export type Backend = 'webgpu' | 'wasm' | 'cpu'

export type WorkerRequest =
  | { type: 'load'; modelUrl: string; backend?: Backend }
  | { type: 'search'; id: number; req: KataGoAnalyzeRequest }

export type WorkerResponse =
  | { type: 'loaded'; ok: true; backend: string; model: string; note: string | null }
  | { type: 'loaded'; ok: false; error: string }
  | { type: 'searched'; id: number; ok: true; search: EngineSearch }
  | { type: 'searched'; id: number; ok: false; error: string }
