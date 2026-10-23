// The SearchRunner the app uses: the engine in a Web Worker (teacher.worker.ts), driven by messages.
//
// The engine honours a search's time cap itself, but nothing guarantees the worker answers at all:
// a WebGPU start-up, a model download or a GPU read-back can hang (a known iOS Safari failure).
// So every round trip has a deadline here. When one passes, the worker is stopped, everything
// pending is rejected and the engine is reported as stopped, so the teacher's queue drains with
// errors instead of waiting forever, and the app carries on with the book alone.
//
// The deadlines don't count time the page spends hidden (R41, deadline.ts): a phone suspends the
// worker with the page, and a worker that was asleep hasn't missed anything.

import { deadline, pageVisibility, type PageVisibility } from './deadline'
import { EngineError, failureOf, type Backend, type EngineSearch, type SearchRunner, type WorkerRequest, type WorkerResponse } from './search'

/** Longest wait for the model to download, parse and warm up (3.8 MB on a slow 3G link is about a minute). */
export const LOAD_TIMEOUT_MS = 90_000

/** How long past a search's own time cap the worker may take before it is given up on. */
export const SEARCH_SLACK_MS = 8_000

/** The engine's own cap when a request gives none (src/engine/katago/engine.ts). */
const ENGINE_DEFAULT_MAX_TIME_MS = 800

/** Starts the worker. Tests pass a fake. */
export type WorkerFactory = () => Worker

function defaultWorker(): Worker {
  // A browser without workers won't get them on a second try: that is a 'load' failure, not a 'start'.
  if (typeof Worker !== 'function') throw new EngineError('This browser cannot run Web Workers', 'load')
  return new Worker(new URL('./teacher.worker.ts', import.meta.url), { type: 'module' })
}

function absoluteUrl(url: string): string {
  // A relative URL would be read against the worker's own URL.
  const base = globalThis.location?.href
  return base ? new URL(url, base).href : url
}

export function workerRunner(
  modelUrl: string,
  backend: Backend | undefined,
  opts: { createWorker?: WorkerFactory; visibility?: PageVisibility } = {},
): SearchRunner {
  const visibility = opts.visibility ?? pageVisibility
  let worker: Worker | null = null
  let nextId = 1
  let dead: Error | null = null
  /** The worker has sent something: an error after this is a crash, before it the worker never started. */
  let heard = false
  let cancelLoad: (() => void) | null = null
  let pendingLoad: { resolve: (v: { backend: string; model: string }) => void; reject: (e: Error) => void } | null = null
  const pending = new Map<number, { resolve: (s: EngineSearch) => void; reject: (e: Error) => void; cancel: () => void }>()
  let crashed: (err: Error) => void = () => {}

  /** Stops the worker for good and rejects everything waiting on it. */
  const stop = (err: Error, report: boolean) => {
    if (dead) return
    dead = err
    cancelLoad?.()
    cancelLoad = null
    pendingLoad?.reject(err)
    pendingLoad = null
    for (const p of pending.values()) {
      p.cancel()
      p.reject(err)
    }
    pending.clear()
    try {
      worker?.terminate()
    } catch {
      // Already gone.
    }
    if (report) crashed(err)
  }

  const post = (msg: WorkerRequest) => {
    if (!worker || dead) throw dead ?? new Error('The engine worker is not running')
    worker.postMessage(msg)
  }

  return {
    load(onCrash) {
      crashed = onCrash
      return new Promise((resolve, reject) => {
        pendingLoad = { resolve, reject }
        try {
          worker = (opts.createWorker ?? defaultWorker)()
        } catch (err) {
          pendingLoad = null
          const why = err instanceof Error ? err.message : String(err)
          reject(new EngineError(`The engine worker did not start: ${why}`, failureOf(err, 'start')))
          return
        }
        cancelLoad = deadline(
          LOAD_TIMEOUT_MS,
          () => stop(new EngineError(`The engine did not load within ${LOAD_TIMEOUT_MS / 1000} s`, 'deadline'), true),
          visibility,
        )
        worker.onmessage = (ev: MessageEvent<WorkerResponse>) => {
          heard = true
          const msg = ev.data
          if (msg.type === 'loaded') {
            const p = pendingLoad
            pendingLoad = null
            cancelLoad?.()
            cancelLoad = null
            if (!p) return
            if (msg.ok) {
              if (msg.note) console.warn(`[teacher] ${msg.note}`)
              p.resolve({ backend: msg.backend, model: msg.model })
            } else {
              p.reject(new EngineError(msg.error, 'load'))
            }
            return
          }
          const p = pending.get(msg.id)
          if (!p) return
          pending.delete(msg.id)
          p.cancel()
          if (msg.ok) p.resolve(msg.search)
          else p.reject(new Error(msg.error))
        }
        worker.onerror = (ev) => {
          ev.preventDefault?.()
          // Before the worker has said anything, its script didn't run: most likely the file couldn't be
          // fetched (a page from before an app update asks for a worker file the update removed).
          const kind = heard ? 'crash' : 'start'
          stop(new EngineError(`The engine worker ${heard ? 'crashed' : 'did not start'}: ${ev.message || 'unknown error'}`, kind), true)
        }
        worker.onmessageerror = () =>
          stop(new EngineError('The engine worker sent a message that could not be read', 'crash'), true)
        try {
          post({ type: 'load', modelUrl: absoluteUrl(modelUrl), backend })
        } catch (err) {
          stop(new EngineError(err instanceof Error ? err.message : String(err), 'start'), true)
        }
      })
    },

    search(req) {
      return new Promise((resolve, reject) => {
        if (dead) {
          reject(dead)
          return
        }
        const id = nextId++
        const limitMs = (req.maxTimeMs ?? ENGINE_DEFAULT_MAX_TIME_MS) + SEARCH_SLACK_MS
        const cancel = deadline(
          limitMs,
          () => stop(new EngineError(`The engine did not answer within ${Math.round(limitMs / 1000)} s`, 'deadline'), true),
          visibility,
        )
        pending.set(id, { resolve, reject, cancel })
        try {
          post({ type: 'search', id, req })
        } catch (err) {
          cancel()
          pending.delete(id)
          reject(err instanceof Error ? err : new Error(String(err)))
        }
      })
    },

    dispose() {
      stop(new EngineError('The engine was shut down', 'disposed'), false)
    },
  }
}
