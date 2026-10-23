// The teacher's brain: KataGo (web-katrain's TF.js port) answering two questions about a position.
//
//   analyzeCorner — the best moves inside the studied corner, and the best move elsewhere
//   scoreFor      — how many points a colour is ahead
//
// createTeacherEngine runs the engine in a Web Worker (the app). createInProcessEngine runs the very
// same code on the calling thread (node tests). Both serialise their searches.
//
// Scores: web-katrain reports everything from Black's point of view; everything here is from the
// point of view of the colour asked about (analyzeCorner: the side to move). Rules are Chinese,
// with the komi the caller passes, like the native book check (tools/book-check.ts).
//
// History: the engine is shown the moves since the last pass. A book `tenuki` is a pass() in the
// Position (nothing goes into `history`), and the network was never trained on a pass in the
// opening, so a tenuki is not fed as a pass: the engine sees the position after it as freshly set
// up, the same as the setup position itself. Ko is unaffected because a pass clears it anyway.

import { inRegion, type Board, type Color, type Pt, type Region } from '../go/coords'
import type { Position } from '../go/rules'
import type { KataGoAnalyzeRequest } from './katago/types'
import { DEFAULT_MAX_TIME_MS, DEFAULT_VISITS, MODEL_URL } from './model'
import { compactSearch, failureOf, type Backend, type EngineFailure, type EngineSearch, type SearchRunner } from './search'
import { workerRunner } from './workerRunner'

export type { Backend, EngineFailure, EngineSearch, SearchRunner } from './search'

export interface CornerAnalysis {
  toMove: Color
  cornerBest: { pt: Pt; scoreLead: number }
  tenukiBest: { pt: Pt; scoreLead: number } | null
  candidates: Array<{ pt: Pt; scoreLead: number; prior: number }>
}

export interface TeacherEngine {
  /** 'failed' is for good: the engine could not load, crashed, missed a deadline, or was disposed. */
  status(): 'loading' | 'ready' | 'failed'
  /** Resolves once the network is loaded; rejects if it never will be. */
  ready(): Promise<{ backend: string; model: string }>
  /**
   * The best moves inside `region` for the side to move (`pos.toMove`), and the best move outside it.
   * Every `scoreLead` is from the side to move's point of view (positive = the side to move leads).
   * `visits` is per search (two searches); `maxTimeMs` is the budget for both together.
   *
   * Rejects when the engine has failed or stopped (status 'failed'), when the worker missed its
   * deadline (the engine then goes to 'failed'), or when there is no legal move inside the region.
   * Callers should treat any rejection as "no engine judgement" (an unjudged verdict).
   */
  analyzeCorner(pos: Position, komi: number, region: Region, opts?: { visits?: number; maxTimeMs?: number }): Promise<CornerAnalysis>
  /**
   * How many points `color` leads by in `pos` (negative = behind), whoever is to move.
   * Rejects like analyzeCorner (engine failed or stopped, deadline missed); treat it as unjudged.
   */
  scoreFor(pos: Position, komi: number, color: Color, opts?: { visits?: number }): Promise<number>
  /** Stops the engine (terminates the worker) and sets status to 'failed'. Safe to call twice. */
  dispose(): void
  /** Why the engine stopped (the first reason), or null while it hasn't. Optional: test engines leave it out. */
  failure?(): EngineFailure | null
}

type PositionRequest = Pick<
  KataGoAnalyzeRequest,
  'board' | 'previousBoard' | 'previousPreviousBoard' | 'currentPlayer' | 'moveHistory'
>

function sameBoard(a: Board, b: Board): boolean {
  if (a === b) return true
  if (a.length !== b.length) return false
  for (let y = 0; y < a.length; y++) {
    const ra = a[y]
    const rb = b[y]
    if (ra.length !== rb.length) return false
    for (let x = 0; x < ra.length; x++) if (ra[x] !== rb[x]) return false
  }
  return true
}

/**
 * The position as the engine wants it. The side to move is always `pos.toMove`. The recent
 * moves and passes are rebuilt from `pos.boards` (a pass leaves the board unchanged) and
 * `pos.history`; only the moves after the last pass are passed on (see the header).
 */
export function engineRequestFor(pos: Position): PositionRequest {
  const bare: PositionRequest = { board: pos.board, currentPlayer: pos.toMove, moveHistory: [] }
  const boards = pos.boards
  const n = boards.length
  // boards[i] is the board before action i; action i was a pass if the board after it is the same.
  let lastPass = -1
  let moveCount = 0
  for (let i = 0; i < n; i++) {
    if (sameBoard(boards[i], i + 1 < n ? boards[i + 1] : pos.board)) lastPass = i
    else moveCount++
  }
  if (moveCount > pos.history.length) return bare // boards and history disagree: show no history
  const kept = n - 1 - lastPass // every action after the last pass is a move
  if (kept === 0) return bare
  const moves = pos.history.slice(pos.history.length - kept)
  // Moves alternate and the last one was by the other colour.
  for (let i = 0; i < kept; i++) {
    const expected: Color = (kept - i) % 2 === 1 ? (pos.toMove === 'black' ? 'white' : 'black') : pos.toMove
    if (moves[i].player !== expected) return bare
  }
  return {
    board: pos.board,
    previousBoard: boards[n - 1],
    previousPreviousBoard: kept >= 2 ? boards[n - 2] : undefined,
    currentPlayer: pos.toMove,
    moveHistory: moves.map((m) => ({ x: m.x, y: m.y, player: m.player })),
  }
}

/** Reads one corner search (region only) and one whole-board search into a CornerAnalysis. */
export function cornerAnalysisFrom(corner: EngineSearch, anywhere: EngineSearch, toMove: Color, region: Region): CornerAnalysis {
  // + 0 turns -0 into 0.
  const mine = (blackScore: number) => (toMove === 'black' ? blackScore : -blackScore) + 0
  const byOrder = (a: { order: number }, b: { order: number }) => a.order - b.order
  const isPoint = (m: { x: number; y: number }) => m.x >= 0 && m.y >= 0

  const candidates = corner.moves
    .filter((m) => isPoint(m) && inRegion(m, region))
    .sort(byOrder)
    .map((m) => ({ pt: { x: m.x, y: m.y }, scoreLead: mine(m.scoreLead), prior: m.prior }))
  if (candidates.length === 0) throw new Error('The engine found no move inside the region')

  const outside = anywhere.moves.filter((m) => isPoint(m) && !inRegion(m, region)).sort(byOrder)[0]
  return {
    toMove,
    cornerBest: { pt: candidates[0].pt, scoreLead: candidates[0].scoreLead },
    tenukiBest: outside ? { pt: { x: outside.x, y: outside.y }, scoreLead: mine(outside.scoreLead) } : null,
    candidates,
  }
}

/** The settings every teacher search uses. wideRootNoise 0 matches tools/katago/analysis.cfg. */
const SEARCH_SETTINGS = {
  rules: 'chinese',
  wideRootNoise: 0,
  ownershipMode: 'none',
  analysisPvLen: 0,
  topK: 10,
} as const satisfies Partial<KataGoAnalyzeRequest>

/** The shortest time a search is given, even when the budget is spent. */
const MIN_SEARCH_MS = 100

/** How many whole-board searches are kept, so scoreFor and a following analyzeCorner share one. */
const CACHE_SIZE = 8

function now(): number {
  return globalThis.performance?.now() ?? Date.now()
}

/** This many searches in a row answered with an error (a lost GPU device, say) and the engine counts as stopped (M2). */
export const MAX_SEARCH_ERRORS = 3

/** The TeacherEngine logic on top of any SearchRunner. */
export function createTeacherFromRunner(runner: SearchRunner): TeacherEngine {
  let state: 'loading' | 'ready' | 'failed' = 'loading'
  let failure: EngineFailure | null = null
  let disposed = false
  const fail = (why: EngineFailure) => {
    failure ??= why
    state = 'failed'
  }
  /** Read through a call: the state changes while a search is awaited. */
  const stopped = (): boolean => state === 'failed'
  let loaded: Promise<{ backend: string; model: string }>
  try {
    loaded = runner.load((err) => {
      fail(failureOf(err, 'crash'))
      if (!disposed) console.warn(`[teacher] engine stopped: ${err.message}`)
    })
  } catch (err) {
    loaded = Promise.reject(err instanceof Error ? err : new Error(String(err)))
  }
  loaded = loaded.then(
    (info) => {
      if (state === 'loading') state = 'ready'
      return info
    },
    (err: unknown) => {
      fail(failureOf(err, 'load'))
      throw err
    },
  )
  // Nobody may ask for ready(); a failed load must not become an unhandled rejection.
  loaded.catch(() => {})

  let queue: Promise<unknown> = Promise.resolve()
  /** Searches answered with an error since the last good answer. */
  let errorsInARow = 0
  /** Queues one search. `onStart` is called when it leaves the queue. */
  const search = (req: KataGoAnalyzeRequest, onStart?: () => void): Promise<EngineSearch> => {
    const run = async () => {
      if (disposed) throw new Error('The engine was shut down')
      await loaded
      if (state === 'failed') throw new Error('The engine has stopped')
      onStart?.()
      try {
        const result = await runner.search(req)
        errorsInARow = 0
        return result
      } catch (err) {
        // An engine that answers every search with an error is as good as stopped: say so, so the
        // app offers Try again instead of "Engine ready" with nothing checked.
        if (!stopped() && ++errorsInARow >= MAX_SEARCH_ERRORS) {
          console.warn(`[teacher] engine stopped after ${errorsInARow} failed searches in a row`)
          fail('errors')
          runner.dispose?.()
        }
        throw err
      }
    }
    const p = queue.then(run, run)
    queue = p.catch(() => {})
    return p
  }

  // Whole-board searches by position, komi and visits. The time cap is not in the key; each entry
  // keeps the cap it ran with. analyzeCorner takes any entry: a scoreFor on the same position just
  // spent its half of the budget on it, and the pair is meant to fit one budget. scoreFor takes an
  // entry only if its cap was at least scoreFor's own, or if the search finished all its visits
  // before any cap bit; otherwise (analyzeCorner's whole-board search squeezed to the floor on a
  // slow device) it searches again.
  const cache = new Map<string, { search: Promise<EngineSearch>; maxTimeMs: number }>()
  const keyOf = (req: PositionRequest, komi: number, visits: number) => JSON.stringify([req, komi, visits])
  const runWholeBoard = (req: PositionRequest, komi: number, visits: number, maxTimeMs: number): Promise<EngineSearch> => {
    const key = keyOf(req, komi, visits)
    const p = search({ ...req, ...SEARCH_SETTINGS, komi, visits, maxTimeMs, regionOfInterest: null })
    const entry = { search: p, maxTimeMs }
    cache.delete(key)
    cache.set(key, entry)
    p.catch(() => {
      if (cache.get(key) === entry) cache.delete(key)
    })
    while (cache.size > CACHE_SIZE) cache.delete(cache.keys().next().value!)
    return p
  }
  const wholeBoardFor = async (req: PositionRequest, komi: number, visits: number, maxTimeMs: number): Promise<EngineSearch> => {
    const hit = cache.get(keyOf(req, komi, visits))
    if (hit) {
      if (hit.maxTimeMs >= maxTimeMs) return hit.search
      const done = await hit.search.catch(() => null)
      // rootVisits counts the root, so a search that used all its visits ends at `visits` or more.
      if (done && done.rootVisits >= visits) return done
    }
    return runWholeBoard(req, komi, visits, maxTimeMs)
  }

  return {
    status: () => state,
    ready: () => loaded,
    failure: () => failure,

    async analyzeCorner(pos, komi, region, opts = {}) {
      const req = engineRequestFor(pos)
      const visits = opts.visits ?? DEFAULT_VISITS
      const budget = opts.maxTimeMs ?? DEFAULT_MAX_TIME_MS
      const cached = cache.get(keyOf(req, komi, visits))?.search
      // Each search gets half the budget. With the whole-board search cached, a scoreFor on this
      // position already spent the other half (the controller's off-book move: scoreFor, then
      // analyzeCorner for the reply), so the pair still fits one budget.
      const cornerCap = budget / 2
      let started = now()
      const corner = await search(
        { ...req, ...SEARCH_SETTINGS, komi, visits, maxTimeMs: cornerCap, regionOfInterest: region },
        () => (started = now()),
      )
      // The whole-board search gets what the corner search left of the budget (time spent waiting
      // in the queue behind other searches does not count). A search runs past its cap by the
      // network's root evaluation and its last batch; on a slow device that is most of a second,
      // so the whole-board search is expected to overrun by as much as the corner search did.
      const cornerMs = now() - started
      const overrun = Math.max(0, cornerMs - cornerCap)
      const left = budget - cornerMs - overrun
      const anywhere = await (cached ?? runWholeBoard(req, komi, visits, Math.max(MIN_SEARCH_MS, left)))
      return cornerAnalysisFrom(corner, anywhere, pos.toMove, region)
    },

    async scoreFor(pos, komi, color, opts = {}) {
      const s = await wholeBoardFor(engineRequestFor(pos), komi, opts.visits ?? DEFAULT_VISITS, DEFAULT_MAX_TIME_MS / 2)
      return (color === 'black' ? s.rootScoreLead : -s.rootScoreLead) + 0
    },

    dispose() {
      if (disposed) return
      disposed = true
      fail('disposed')
      runner.dispose?.()
    },
  }
}

/**
 * The same engine on the calling thread: no worker. `model` is a URL or the model file's bytes.
 * TF.js and the engine are loaded with a dynamic import, so they stay out of the main bundle.
 */
export function createInProcessEngine(model: string | Uint8Array, opts: { backend?: Backend } = {}): TeacherEngine {
  const core = import('./katago/engine')
  return createTeacherFromRunner({
    async load() {
      const engine = await core
      const info = await engine.loadKataGoModel(model, opts.backend)
      if (info.backendNote) console.warn(`[teacher] ${info.backendNote}`)
      return { backend: info.backend, model: info.modelName }
    },
    async search(req) {
      const engine = await core
      // One model per realm: reload if another in-process engine swapped it out (a no-op otherwise).
      await engine.loadKataGoModel(model, opts.backend)
      return compactSearch(await engine.analyzeKataGo(req))
    },
  })
}

/**
 * The app's engine: KataGo in a Web Worker. Loading starts right away. Loading has a ceiling and
 * every search a deadline (src/engine/workerRunner.ts), not counting time the page is hidden; missing
 * one stops the worker for good (the app's EngineHub may start a new one).
 */
export function createTeacherEngine(modelUrl: string = MODEL_URL, opts: { backend?: Backend } = {}): TeacherEngine {
  return createTeacherFromRunner(workerRunner(modelUrl, opts.backend))
}
