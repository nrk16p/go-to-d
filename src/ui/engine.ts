// The app's one teacher engine. EngineHub is itself a TeacherEngine that forwards to the engine in use,
// so a session started before "Try again" picks up the new engine without being restarted.
//
// The engine has no events, so the hub notices changes itself: when ready() settles, on every status()
// a session asks for, and every few seconds while someone is watching. A failed engine is disposed at
// once (its worker would otherwise linger). There is no automatic respawn: only the "Try again" button.
//
// The hub also applies the owner's visits setting to every search that doesn't name its own, so the
// sessions don't have to carry it.

import { createTeacherEngine, type TeacherEngine } from '../engine/teacher'
import { loadProgress } from '../progress/store'

export type EngineStatus = ReturnType<TeacherEngine['status']>

const POLL_MS = 2000

export class EngineHub implements TeacherEngine {
  private engine: TeacherEngine | null = null
  private readonly make: () => TeacherEngine
  private readonly listeners = new Set<() => void>()
  private seen: EngineStatus = 'loading'
  private timer: ReturnType<typeof setInterval> | null = null
  private readonly visits: (() => number | undefined) | undefined

  /** `visits` is read at every search, so a change in Settings counts from the next move. */
  constructor(make: () => TeacherEngine, opts: { visits?: () => number | undefined } = {}) {
    this.make = make
    this.visits = opts.visits
  }

  /** Starts loading the engine if it hasn't started yet. */
  start(): this {
    if (!this.engine) this.spawn()
    return this
  }

  /** A fresh engine after a failure. Does nothing while the current one is loading or ready. */
  retry(): void {
    if (this.engine && this.engine.status() !== 'failed') return
    this.engine?.dispose()
    this.spawn()
  }

  status(): EngineStatus {
    const s = this.engine ? this.engine.status() : 'loading'
    if (s !== this.seen) queueMicrotask(() => this.check())
    return s
  }

  ready(): ReturnType<TeacherEngine['ready']> {
    return this.current().ready()
  }

  analyzeCorner(...args: Parameters<TeacherEngine['analyzeCorner']>): ReturnType<TeacherEngine['analyzeCorner']> {
    const [pos, komi, region, opts] = args
    return this.current().analyzeCorner(pos, komi, region, this.withVisits(opts))
  }

  scoreFor(...args: Parameters<TeacherEngine['scoreFor']>): ReturnType<TeacherEngine['scoreFor']> {
    const [pos, komi, color, opts] = args
    return this.current().scoreFor(pos, komi, color, this.withVisits(opts))
  }

  dispose(): void {
    this.engine?.dispose()
    this.check()
  }

  /** For useSyncExternalStore: the status as last announced. */
  snapshot = (): EngineStatus => this.seen

  subscribe = (fn: () => void): (() => void) => {
    this.listeners.add(fn)
    if (!this.timer) this.timer = setInterval(() => this.check(), POLL_MS)
    this.check()
    return () => {
      this.listeners.delete(fn)
      if (this.listeners.size === 0 && this.timer) {
        clearInterval(this.timer)
        this.timer = null
      }
    }
  }

  private withVisits<T extends { visits?: number }>(opts: T | undefined): T | undefined {
    if (opts?.visits !== undefined || !this.visits) return opts
    const visits = this.visits()
    return visits === undefined ? opts : ({ ...opts, visits } as T)
  }

  private current(): TeacherEngine {
    return this.start().engine!
  }

  private spawn(): void {
    const e = this.make()
    this.engine = e
    const settle = () => {
      if (this.engine === e) this.check()
    }
    e.ready().then(settle, settle)
    this.check()
  }

  private check(): void {
    const e = this.engine
    const s = e ? e.status() : 'loading'
    // A failed engine still holds its worker until disposed. dispose() is safe to call twice.
    if (s === 'failed') e?.dispose()
    if (s === this.seen) return
    this.seen = s
    for (const fn of [...this.listeners]) fn()
  }
}

let hub: EngineHub | null = null

/** The shared engine. The first call starts loading it; call it at app start, not during render. */
export function appEngine(): EngineHub {
  hub ??= new EngineHub(() => createTeacherEngine(), { visits: () => loadProgress().settings.visits }).start()
  return hub
}
