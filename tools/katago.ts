// A small client for KataGo's JSON analysis engine (`katago analysis`): spawns the process, sends queries
// as JSON lines on stdin, collects the answers by id from stdout.
//
//   const engine = await KataGoEngine.start()
//   const results = await engine.analyseAll([{ initialStones, initialPlayer: 'W', moves: [], komi: 0.5, allowMoves }])
//   await engine.close()
//
// Every Analysis comes back from the view of the player to move (see normalizeResponse), whatever the
// config says. Setup: see tools/README.md.

import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { basename, dirname, join } from 'node:path'
import { createInterface } from 'node:readline'
import { fileURLToPath } from 'node:url'
import {
  buildQuery,
  normalizeResponse,
  parseReportedAs,
  type Analysis,
  type AnalysisRequest,
  type RawResponse,
  type ReportedAs,
} from './katago-protocol'

export type { Analysis, AnalysisMove, AnalysisRequest, ReportedAs } from './katago-protocol'
export { stonesFromBoard } from './katago-protocol'

/** The network the book check is run with; its name goes into every verify file. */
export const MODEL_FILE = 'kata1-b18c384nbt-s9996604416-d4316597426.bin.gz'

export interface EngineOptions {
  /** KataGo executable. Default: $KATAGO_BIN or "katago" on the PATH. */
  bin?: string
  /** Network file. Default: $KATAGO_MODEL, then ~/.katago/ and the Homebrew share folder. */
  model?: string
  /** Analysis config. Default: $KATAGO_CONFIG or tools/katago/analysis.cfg. */
  config?: string
  /** Give up on a stuck engine when nothing arrives for this long while queries are open. Default 10 minutes. */
  idleTimeoutMs?: number
}

const SETUP_HINT = 'Setup is in tools/README.md (brew install katago, then download the network).'

function toolsDir(): string {
  return dirname(fileURLToPath(import.meta.url))
}

/** Resolves bin, model and config from options and environment. Throws with a pointer to the README if a file is missing. */
export function resolvePaths(opts: EngineOptions = {}): { bin: string; model: string; config: string } {
  const bin = opts.bin ?? process.env.KATAGO_BIN ?? 'katago'
  const config = opts.config ?? process.env.KATAGO_CONFIG ?? join(toolsDir(), 'katago', 'analysis.cfg')
  if (!existsSync(config)) throw new Error(`KataGo config not found: ${config}. ${SETUP_HINT}`)

  let model = opts.model ?? process.env.KATAGO_MODEL
  if (!model) {
    const candidates = [
      join(homedir(), '.katago', MODEL_FILE),
      join('/opt/homebrew/share/katago', MODEL_FILE),
      join('/usr/local/share/katago', MODEL_FILE),
    ]
    model = candidates.find((p) => existsSync(p))
    if (!model) throw new Error(`KataGo network ${MODEL_FILE} not found in ${candidates.join(' or ')}. ${SETUP_HINT}`)
  } else if (!existsSync(model)) {
    throw new Error(`KataGo network not found: ${model}. ${SETUP_HINT}`)
  }
  return { bin, model, config }
}

/** "kata1-b18c...-d4316597426" from a model path. */
export function modelName(modelPath: string): string {
  return basename(modelPath).replace(/\.bin\.gz$/, '').replace(/\.bin$/, '')
}

interface Pending {
  resolve: (a: Analysis) => void
  reject: (e: Error) => void
}

export class KataGoEngine {
  /** Network name, e.g. "kata1-b18c384nbt-s9996604416-d4316597426". */
  readonly model: string
  /** `reportAnalysisWinratesAs` of the config in use. */
  readonly reportedAs: ReportedAs

  private readonly child: ChildProcessWithoutNullStreams
  private readonly pending = new Map<string, Pending>()
  private readonly idleTimeoutMs: number
  private stderrTail = ''
  private nextId = 0
  private exited = false
  private failure: Error | null = null
  private idleTimer: NodeJS.Timeout | null = null
  private readonly exitPromise: Promise<void>
  private readonly killOnExit = () => this.child.kill('SIGKILL')

  private constructor(child: ChildProcessWithoutNullStreams, model: string, reportedAs: ReportedAs, idleTimeoutMs: number) {
    this.child = child
    this.model = model
    this.reportedAs = reportedAs
    this.idleTimeoutMs = idleTimeoutMs

    createInterface({ input: child.stdout }).on('line', (line) => this.onLine(line))
    child.stderr.on('data', (chunk: Buffer) => {
      this.stderrTail = (this.stderrTail + chunk.toString()).slice(-4000)
    })
    child.stdin.on('error', () => {
      // The process died; the exit handler reports it.
    })
    this.exitPromise = new Promise<void>((resolve) => {
      child.on('exit', (code, signal) => {
        this.exited = true
        process.off('exit', this.killOnExit)
        this.clearIdle()
        this.fail(new Error(`KataGo stopped (${signal ?? `exit code ${code}`}). Last output:\n${this.stderrTail.trim()}`))
        resolve()
      })
    })
    child.on('error', (err: NodeJS.ErrnoException) => {
      this.exited = true
      this.fail(
        new Error(
          err.code === 'ENOENT'
            ? `Could not start KataGo: "${child.spawnfile}" not found. ${SETUP_HINT}`
            : `Could not start KataGo: ${err.message}`,
        ),
      )
    })
    process.on('exit', this.killOnExit)
  }

  /** Starts the engine. The network loads in the background; queries sent right away just wait for it. */
  static async start(opts: EngineOptions = {}): Promise<KataGoEngine> {
    const { bin, model, config } = resolvePaths(opts)
    const reportedAs = parseReportedAs(readFileSync(config, 'utf8'))
    const child = spawn(bin, ['analysis', '-config', config, '-model', model], { stdio: ['pipe', 'pipe', 'pipe'] })
    return new KataGoEngine(child, modelName(model), reportedAs, opts.idleTimeoutMs ?? 10 * 60 * 1000)
  }

  /** Analyses one position. */
  analyse(req: AnalysisRequest): Promise<Analysis> {
    if (this.failure) return Promise.reject(this.failure)
    const id = `q${this.nextId++}`
    return new Promise<Analysis>((resolve, reject) => {
      this.pending.set(id, { resolve, reject })
      this.armIdle()
      this.child.stdin.write(`${JSON.stringify(buildQuery(req, id))}\n`)
    })
  }

  /**
   * Sends all queries at once and waits for all answers; the engine works through them in parallel.
   * Results are in the order of `reqs`. `onDone(finished, total)` is called as answers arrive.
   * If one query fails, the rest are still collected so the engine stays clean, then the first error is thrown.
   */
  async analyseAll(reqs: AnalysisRequest[], onDone?: (finished: number, total: number) => void): Promise<Analysis[]> {
    let finished = 0
    const settled = await Promise.allSettled(
      reqs.map((r) =>
        this.analyse(r).finally(() => {
          finished++
          onDone?.(finished, reqs.length)
        }),
      ),
    )
    const results: Analysis[] = []
    for (const s of settled) {
      if (s.status === 'rejected') throw s.reason instanceof Error ? s.reason : new Error(String(s.reason))
      results.push(s.value)
    }
    return results
  }

  /** Closes stdin so KataGo finishes and exits; kills it if it does not. Safe to call twice. */
  async close(): Promise<void> {
    if (!this.exited) {
      this.child.stdin.end()
      const term = setTimeout(() => this.child.kill('SIGTERM'), 10_000)
      const kill = setTimeout(() => this.child.kill('SIGKILL'), 15_000)
      await this.exitPromise
      clearTimeout(term)
      clearTimeout(kill)
    }
    this.clearIdle()
  }

  private onLine(line: string) {
    this.armIdle()
    let raw: RawResponse
    try {
      raw = JSON.parse(line) as RawResponse
    } catch {
      return // KataGo prints nothing but JSON on stdout; ignore anything else.
    }
    if (raw.warning !== undefined && raw.error === undefined) {
      console.warn(`KataGo warning${raw.id ? ` (${raw.id})` : ''}: ${raw.warning}`)
      return
    }
    if (raw.isDuringSearch) return
    if (raw.id === undefined) {
      if (raw.error !== undefined) this.fail(new Error(`KataGo error: ${raw.error}`))
      return
    }
    const waiting = this.pending.get(raw.id)
    if (!waiting) return
    this.pending.delete(raw.id)
    try {
      waiting.resolve(normalizeResponse(raw, this.reportedAs))
    } catch (e) {
      waiting.reject(e instanceof Error ? e : new Error(String(e)))
    }
    if (this.pending.size === 0) this.clearIdle()
  }

  private fail(err: Error) {
    this.failure ??= err
    const open = [...this.pending.values()]
    this.pending.clear()
    for (const p of open) p.reject(err)
  }

  private armIdle() {
    this.clearIdle()
    this.idleTimer = setTimeout(() => {
      if (this.pending.size === 0) return
      this.fail(new Error(`KataGo sent nothing for ${Math.round(this.idleTimeoutMs / 1000)} s with ${this.pending.size} queries open`))
      this.child.kill('SIGKILL')
    }, this.idleTimeoutMs)
    this.idleTimer.unref()
  }

  private clearIdle() {
    if (this.idleTimer) clearTimeout(this.idleTimer)
    this.idleTimer = null
  }
}

/** Starts an engine, runs `fn`, and always shuts the engine down. */
export async function withEngine<T>(fn: (engine: KataGoEngine) => Promise<T>, opts: EngineOptions = {}): Promise<T> {
  const engine = await KataGoEngine.start(opts)
  try {
    return await fn(engine)
  } finally {
    await engine.close()
  }
}

/** One-shot helper: analyse positions with a fresh engine (results in request order). */
export function analysePositions(reqs: AnalysisRequest[], opts: EngineOptions = {}): Promise<Analysis[]> {
  return withEngine((engine) => engine.analyseAll(reqs), opts)
}
