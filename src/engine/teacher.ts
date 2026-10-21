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
import { compactSearch, type Backend, type EngineSearch, type WorkerRequest, type WorkerResponse } from './search'

export type { Backend, EngineSearch } from './search'

export interface CornerAnalysis {
  toMove: Color
  cornerBest: { pt: Pt; scoreLead: number }
  tenukiBest: { pt: Pt; scoreLead: number } | null
  candidates: Array<{ pt: Pt; scoreLead: number; prior: number }>
}

export interface TeacherEngine {
  status(): 'loading' | 'ready' | 'failed'
  ready(): Promise<{ backend: string; model: string }>
  analyzeCorner(pos: Position, komi: number, region: Region, opts?: { visits?: number; maxTimeMs?: number }): Promise<CornerAnalysis>
  scoreFor(pos: Position, komi: number, color: Color, opts?: { visits?: number }): Promise<number>
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

/** Loads a network and runs one search at a time. A worker or the calling thread provides it. */
export interface SearchRunner {
  /** `onCrash` is called if the engine dies after loading. */
  load(onCrash: (err: Error) => void): Promise<{ backend: string; model: string }>
  search(req: KataGoAnalyzeRequest): Promise<EngineSearch>
}

function now(): number {
  return globalThis.performance?.now() ?? Date.now()
}

/** The TeacherEngine logic on top of any SearchRunner. */
export function createTeacherFromRunner(runner: SearchRunner): TeacherEngine {
  let state: 'loading' | 'ready' | 'failed' = 'loading'
  let loaded: Promise<{ backend: string; model: string }>
  try {
    loaded = runner.load((err) => {
      state = 'failed'
      console.warn(`[teacher] engine stopped: ${err.message}`)
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
      state = 'failed'
      throw err
    },
  )
  // Nobody may ask for ready(); a failed load must not become an unhandled rejection.
  loaded.catch(() => {})

  let queue: Promise<unknown> = Promise.resolve()
  /** Queues one search. `onStart` is called when it leaves the queue. */
  const search = (req: KataGoAnalyzeRequest, onStart?: () => void): Promise<EngineSearch> => {
    const run = async () => {
      await loaded
      if (state === 'failed') throw new Error('The engine has stopped')
      onStart?.()
      return runner.search(req)
    }
    const p = queue.then(run, run)
    queue = p.catch(() => {})
    return p
  }

  const cache = new Map<string, Promise<EngineSearch>>()
  const keyOf = (req: PositionRequest, komi: number, visits: number) => JSON.stringify([req, komi, visits])
  const wholeBoard = (req: PositionRequest, komi: number, visits: number, maxTimeMs: number): Promise<EngineSearch> => {
    const key = keyOf(req, komi, visits)
    const hit = cache.get(key)
    if (hit) return hit
    const p = search({ ...req, ...SEARCH_SETTINGS, komi, visits, maxTimeMs, regionOfInterest: null })
    cache.set(key, p)
    p.catch(() => cache.delete(key))
    while (cache.size > CACHE_SIZE) cache.delete(cache.keys().next().value!)
    return p
  }

  return {
    status: () => state,
    ready: () => loaded,

    async analyzeCorner(pos, komi, region, opts = {}) {
      const req = engineRequestFor(pos)
      const visits = opts.visits ?? DEFAULT_VISITS
      const budget = opts.maxTimeMs ?? DEFAULT_MAX_TIME_MS
      const cached = cache.get(keyOf(req, komi, visits))
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
      const anywhere = await (cached ?? wholeBoard(req, komi, visits, Math.max(MIN_SEARCH_MS, left)))
      return cornerAnalysisFrom(corner, anywhere, pos.toMove, region)
    },

    async scoreFor(pos, komi, color, opts = {}) {
      const s = await wholeBoard(engineRequestFor(pos), komi, opts.visits ?? DEFAULT_VISITS, DEFAULT_MAX_TIME_MS / 2)
      return (color === 'black' ? s.rootScoreLead : -s.rootScoreLead) + 0
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

/** The app's engine: KataGo in a Web Worker. Loading starts right away. */
export function createTeacherEngine(modelUrl: string = MODEL_URL, opts: { backend?: Backend } = {}): TeacherEngine {
  return createTeacherFromRunner(workerRunner(modelUrl, opts.backend))
}

function workerRunner(modelUrl: string, backend: Backend | undefined): SearchRunner {
  let worker: Worker | null = null
  let nextId = 1
  let dead: Error | null = null
  let pendingLoad: { resolve: (v: { backend: string; model: string }) => void; reject: (e: Error) => void } | null = null
  const pending = new Map<number, { resolve: (s: EngineSearch) => void; reject: (e: Error) => void }>()
  let crashed: (err: Error) => void = () => {}

  const failAll = (err: Error) => {
    dead ??= err
    pendingLoad?.reject(err)
    pendingLoad = null
    for (const p of pending.values()) p.reject(err)
    pending.clear()
    crashed(err)
  }

  const post = (msg: WorkerRequest) => {
    if (!worker || dead) throw dead ?? new Error('The engine worker is not running')
    worker.postMessage(msg)
  }

  return {
    load(onCrash) {
      crashed = onCrash
      return new Promise((resolve, reject) => {
        if (typeof Worker !== 'function') {
          reject(new Error('This browser cannot run Web Workers'))
          return
        }
        pendingLoad = { resolve, reject }
        try {
          worker = new Worker(new URL('./teacher.worker.ts', import.meta.url), { type: 'module' })
        } catch (err) {
          pendingLoad = null
          reject(new Error(`The engine worker did not start: ${err instanceof Error ? err.message : String(err)}`))
          return
        }
        worker.onmessage = (ev: MessageEvent<WorkerResponse>) => {
          const msg = ev.data
          if (msg.type === 'loaded') {
            const p = pendingLoad
            pendingLoad = null
            if (!p) return
            if (msg.ok) {
              if (msg.note) console.warn(`[teacher] ${msg.note}`)
              p.resolve({ backend: msg.backend, model: msg.model })
            } else {
              p.reject(new Error(msg.error))
            }
            return
          }
          const p = pending.get(msg.id)
          if (!p) return
          pending.delete(msg.id)
          if (msg.ok) p.resolve(msg.search)
          else p.reject(new Error(msg.error))
        }
        worker.onerror = (ev) => {
          ev.preventDefault?.()
          failAll(new Error(`The engine worker crashed: ${ev.message || 'unknown error'}`))
        }
        worker.onmessageerror = () => failAll(new Error('The engine worker sent a message that could not be read'))
        // A relative URL would be read against the worker's own URL.
        const absolute = new URL(modelUrl, globalThis.location?.href).href
        post({ type: 'load', modelUrl: absolute, backend })
      })
    },
    search(req) {
      return new Promise((resolve, reject) => {
        const id = nextId++
        pending.set(id, { resolve, reject })
        try {
          post({ type: 'search', id, req })
        } catch (err) {
          pending.delete(id)
          reject(err instanceof Error ? err : new Error(String(err)))
        }
      })
    },
  }
}
