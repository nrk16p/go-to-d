// What the Spar screen shows of a session: the controller's state plus a feed of the moves so far,
// each with its note, published at a pace a person can follow.
//
// Feed: the controller adds a log entry in the same state change that sets that move's note and book
// node, so watching every change pairs each move with its note and its confidence. Retry shortens the
// log again; the feed follows.
//
// Pace: an in-book answer comes back in the same instant as the owner's stone. A state that adds a
// teacher move is held until `gapMs` after the board last changed on screen, so the owner sees their
// stone, then the teacher's.

import { toGtp, type Pt } from '../go/coords'
import type { SparController, SparState, Verdict } from '../session/controller'

export interface FeedLine {
  by: 'owner' | 'teacher'
  /** The point played ("R14"), or null for a tenuki without a stone on the board. */
  at: string | null
  tenuki: boolean
  note: string | null
  low: boolean
  verdict?: Verdict
}

export interface SessionSnapshot {
  state: SparState
  feed: FeedLine[]
  /** The point of the last stone on the board. */
  lastMove: Pt | undefined
}

export const TEACHER_GAP_MS = 450

function lastStone(s: SparState): Pt | undefined {
  const m = s.pos.history[s.pos.history.length - 1]
  return m && { x: m.x, y: m.y }
}

export class SessionView {
  private readonly c: SparController
  private readonly gapMs: number
  private feed: FeedLine[] = []
  private shown: SessionSnapshot
  private latest: SessionSnapshot
  private boardChangedAt: number
  private timer: ReturnType<typeof setTimeout> | null = null
  private readonly listeners = new Set<() => void>()
  private unsub: (() => void) | null = null

  constructor(controller: SparController, opts: { gapMs?: number } = {}) {
    this.c = controller
    this.gapMs = opts.gapMs ?? TEACHER_GAP_MS
    this.shown = this.latest = this.snap(controller.state)
    this.boardChangedAt = Date.now()
  }

  /** Starts listening to the controller (call once, from an effect). */
  attach(): () => void {
    if (!this.unsub) this.unsub = this.c.subscribe((s) => this.onState(s))
    this.onState(this.c.state)
    return () => {
      this.unsub?.()
      this.unsub = null
      if (this.timer) clearTimeout(this.timer)
      this.timer = null
    }
  }

  subscribe = (fn: () => void): (() => void) => {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }

  snapshot = (): SessionSnapshot => this.shown

  private snap(state: SparState): SessionSnapshot {
    return { state, feed: this.feed, lastMove: lastStone(state) }
  }

  private onState(s: SparState): void {
    const before = this.feed.length
    this.track(s)
    this.latest = this.snap(s)
    const teacherMoved = this.feed.length > before && this.feed[this.feed.length - 1].by === 'teacher'
    const wait = teacherMoved ? this.boardChangedAt + this.gapMs - Date.now() : 0
    if (this.timer) return // already holding: the latest state goes out when the hold ends
    if (wait > 0) this.timer = setTimeout(() => this.release(), wait)
    else this.publish()
  }

  private release(): void {
    this.timer = null
    this.publish()
  }

  private publish(): void {
    if (this.latest.state.pos !== this.shown.state.pos) this.boardChangedAt = Date.now()
    this.shown = this.latest
    for (const fn of [...this.listeners]) fn()
  }

  /** Brings the feed in line with the log: new entries get this state's note, a shorter log cuts the feed. */
  private track(s: SparState): void {
    const n = s.log.length
    if (n < this.feed.length) this.feed = this.feed.slice(0, n)
    if (n > this.feed.length) {
      const added = s.log.slice(this.feed.length).map((entry, i, all): FeedLine => {
        const newest = i === all.length - 1
        const tenuki = 'tenuki' in entry.move
        const stone = tenuki ? (newest ? lastStone(s) : undefined) : (entry.move as Pt)
        return {
          by: entry.by,
          at: stone ? toGtp(stone) : null,
          tenuki,
          // Only the newest entry's note and node are in this state.
          note: newest ? s.note : null,
          low: newest ? s.node?.confidence === 'low' : false,
          verdict: entry.verdict,
        }
      })
      this.feed = [...this.feed, ...added]
    }
  }
}
