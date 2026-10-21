// The app's one teacher engine. EngineHub is itself a TeacherEngine that forwards to the engine in use,
// so a session started before "Try again" picks up the new engine without being restarted.
//
// The engine has no events, so the hub notices changes itself: when ready() settles, on every status()
// a session asks for, and every few seconds while someone is watching. A failed engine is disposed at
// once (its worker would otherwise linger). There is no automatic respawn: only the "Try again" button.

import { createTeacherEngine, type TeacherEngine } from '../engine/teacher'

export type EngineStatus = ReturnType<TeacherEngine['status']>

const POLL_MS = 2000

export class EngineHub implements TeacherEngine {
  private engine: TeacherEngine | null = null
  private readonly make: () => TeacherEngine
  private readonly listeners = new Set<() => void>()
  private seen: EngineStatus = 'loading'
  private timer: ReturnType<typeof setInterval> | null = null

  constructor(make: () => TeacherEngine) {
    this.make = make
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
    return this.current().analyzeCorner(...args)
  }

  scoreFor(...args: Parameters<TeacherEngine['scoreFor']>): ReturnType<TeacherEngine['scoreFor']> {
    return this.current().scoreFor(...args)
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
  hub ??= new EngineHub(() => createTeacherEngine()).start()
  return hub
}
