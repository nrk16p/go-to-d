// The app's one teacher engine. EngineHub is itself a TeacherEngine that forwards to the engine in use,
// so a session started before "Try again" picks up the new engine without being restarted.
//
// The engine has no events, so the hub notices changes itself: when ready() settles, on every status()
// a session asks for, and every few seconds while someone is watching. A failed engine is disposed at
// once (its worker would otherwise linger).
//
// A new engine starts on "Try again", and once by itself (R41) when an engine stopped by a deadline (or
// by search after search failing) is likely the phone's doing: the owner switched apps and came back.
// It respawns when the page shows again, or at once if it failed after the page had been hidden. Never
// twice in a row without the new engine getting going, so a broken engine can't restart forever.
//
// "Try again" after a worker that never started reloads the page once (M1): after an app update, a page
// loaded before it can ask for a worker file the update removed, and only a reload gets the new one.
//
// The hub also applies the owner's visits setting to every search that doesn't name its own, so the
// sessions don't have to carry it.

import { pageVisibility, type PageVisibility } from '../engine/deadline'
import { createTeacherEngine, type EngineFailure, type TeacherEngine } from '../engine/teacher'
import { loadProgress } from '../progress/store'

export type EngineStatus = ReturnType<TeacherEngine['status']>

const POLL_MS = 2000

/** Failures an app switch can cause, so a new engine is worth starting without being asked. */
const SWITCH_FAILURES: ReadonlySet<EngineFailure> = new Set(['deadline', 'errors'])

export interface EngineHubOptions {
  /** Read at every search, so a change in Settings counts from the next move. */
  visits?: () => number | undefined
  visibility?: PageVisibility
  /** Reloads the page for this build's files. Returns false when it won't (it just did). */
  reload?: () => boolean
}

export class EngineHub implements TeacherEngine {
  private engine: TeacherEngine | null = null
  private readonly make: () => TeacherEngine
  private readonly listeners = new Set<() => void>()
  private seen: EngineStatus = 'loading'
  private timer: ReturnType<typeof setInterval> | null = null
  private readonly visits: (() => number | undefined) | undefined
  private readonly vis: PageVisibility
  private readonly reload: (() => boolean) | undefined
  private unwatch: (() => void) | null = null
  /** About the current engine: the page was hidden since it started; it loaded; it was started without asking. */
  private hiddenSinceSpawn = false
  private loaded = false
  private automatic = false

  constructor(make: () => TeacherEngine, opts: EngineHubOptions = {}) {
    this.make = make
    this.visits = opts.visits
    this.vis = opts.visibility ?? pageVisibility
    this.reload = opts.reload
  }

  /** Starts loading the engine if it hasn't started yet. */
  start(): this {
    if (!this.engine) {
      this.spawn(false)
      this.unwatch = this.vis.onChange(() => this.visibilityChanged())
    }
    return this
  }

  /**
   * "Try again": a fresh engine after a failure. Does nothing while the current one is loading or ready.
   * A worker that never started reloads the page instead, once (M1).
   */
  retry(): void {
    if (this.engine && this.engine.status() !== 'failed') return
    if (this.engine?.failure?.() === 'start' && this.reload?.()) return
    this.engine?.dispose()
    this.spawn(false)
  }

  failure(): EngineFailure | null {
    return this.engine?.failure?.() ?? null
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
    this.unwatch?.()
    this.unwatch = null
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

  private spawn(automatic: boolean): void {
    const e = this.make()
    this.engine = e
    this.hiddenSinceSpawn = this.vis.hidden()
    this.loaded = false
    this.automatic = automatic
    e.ready().then(
      () => {
        if (this.engine !== e) return
        this.loaded = true
        this.check()
      },
      () => {
        if (this.engine === e) this.check()
      },
    )
    this.check()
  }

  private visibilityChanged(): void {
    if (this.vis.hidden()) {
      this.hiddenSinceSpawn = true
      return
    }
    this.check(true)
  }

  /**
   * Whether a failed engine gets a new one without being asked (R41): it failed the way an app switch
   * makes it fail, the page is showing, and either it just came back (`shown`) or it was hidden while
   * this engine ran. Not when the last automatic one never loaded.
   */
  private respawnsItself(e: TeacherEngine, shown: boolean): boolean {
    const why = e.failure?.() ?? null
    if (!why || !SWITCH_FAILURES.has(why) || this.vis.hidden()) return false
    if (!shown && !this.hiddenSinceSpawn) return false
    return !(this.automatic && !this.loaded)
  }

  /** `shown`: the page has just come back into view. */
  private check(shown = false): void {
    const e = this.engine
    const s = e ? e.status() : 'loading'
    if (s === 'failed' && e) {
      // A failed engine still holds its worker until disposed. dispose() is safe to call twice.
      e.dispose()
      if (this.respawnsItself(e, shown)) {
        console.warn(`[teacher] starting the engine again after it stopped (${e.failure?.()})`)
        this.spawn(true)
        return
      }
    }
    if (s === this.seen) return
    this.seen = s
    for (const fn of [...this.listeners]) fn()
  }
}

/** Where the last reload for a missing worker file was noted, so it happens at most once in a while. */
const RELOAD_KEY = 'go-to-d:engine-reload'
const RELOAD_GAP_MS = 10 * 60_000

/** Reloads the page unless it already did in the last few minutes (then a reload wouldn't help). */
function reloadForNewFiles(): boolean {
  try {
    const last = Number(sessionStorage.getItem(RELOAD_KEY))
    if (Number.isFinite(last) && Date.now() - last < RELOAD_GAP_MS) return false
    sessionStorage.setItem(RELOAD_KEY, String(Date.now()))
    location.reload()
    return true
  } catch {
    return false
  }
}

let hub: EngineHub | null = null

/** The shared engine. The first call starts loading it; call it at app start, not during render. */
export function appEngine(): EngineHub {
  hub ??= new EngineHub(() => createTeacherEngine(), {
    visits: () => loadProgress().settings.visits,
    reload: reloadForNewFiles,
  }).start()
  return hub
}
