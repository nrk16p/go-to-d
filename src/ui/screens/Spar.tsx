// The sparring screen: the board, what the teacher says about the last moves, and the buttons that
// go with each verdict. The session itself is a SparController; this screen only shows it and passes
// taps on. When the session ends it is saved and the Report screen takes over.
//
// Phone layout, top to bottom: the board, then a bar with what's happening now and the button for it
// (the touch confirm "Play O17", or Play elsewhere), then the teacher's words. The bar sits right under
// the board so its button is on screen on a small phone.

import { Component, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react'
import { checkedLoss } from '../../book/checkedLoss'
import { BOOK } from '../shownBook'
import { toGtp, type Board as Grid, type Color, type Pt } from '../../go/coords'
import { otherColor } from '../../go/rules'
import { loadProgress } from '../../progress/store'
import { SparController, type SparConfig, type SparState, type Verdict } from '../../session/controller'
import { ownerColor } from '../../session/sides'
import { Board, type BoardMarker } from '../Board'
import { COPY } from '../copy'
import { EngineChip } from '../EngineChip'
import type { EngineHub } from '../engine'
import { setLastReport } from '../reportStore'
import { href, navigate, replaceQuietly, sparHref, type SparParams } from '../router'
import { saveSession } from '../saveSession'
import { SessionView, type FeedLine } from '../sessionView'
import { resolveSpar } from '../sparSetup'

export interface SparProps {
  params: SparParams
  engine: EngineHub
  /** Pause before the teacher's answer appears (tests pass 0). */
  gapMs?: number
}

export function Spar({ params, engine, gapMs }: SparProps) {
  const [setup] = useState(() => resolveSpar(params, BOOK, loadProgress()))
  // The board turn and seed picked for a link without them go into the address, so a reload
  // replays the same session instead of a freshly turned board.
  const [address] = useState(() =>
    setup.ok ? sparHref({ ...params, sym: String(setup.config.sym), seed: String(setup.config.seed) }) : null,
  )
  useEffect(() => {
    if (address) replaceQuietly(address)
  }, [address])
  // "Start again" after an error mounts a fresh session with the same setup.
  const [run, setRun] = useState(0)
  if (!setup.ok) {
    return (
      <section className="screen-msg">
        <h1>{setup.error}</h1>
        <a className="btn" href={href.today}>
          {COPY.spar.backToToday}
        </a>
      </section>
    )
  }
  const restart = () => setRun((r) => r + 1)
  return (
    <SessionBoundary key={run} onRestart={restart}>
      <Session config={setup.config} engine={engine} gapMs={gapMs} onRestart={restart} />
    </SessionBoundary>
  )
}

function SessionError({ onRestart }: { onRestart: () => void }) {
  return (
    <section className="screen-msg" role="alert">
      <h1>{COPY.spar.failed}</h1>
      <div className="actions">
        <button type="button" className="btn btn-primary" onClick={onRestart}>
          {COPY.spar.startAgain}
        </button>
        <a className="btn" href={href.today}>
          {COPY.spar.backToToday}
        </a>
      </div>
    </section>
  )
}

/** A session that throws while drawing shows SessionError instead of blanking the app. */
class SessionBoundary extends Component<{ onRestart: () => void; children: ReactNode }, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true }
  }

  componentDidCatch(err: unknown): void {
    console.error('[spar] the session screen failed', err)
  }

  render(): ReactNode {
    return this.state.failed ? <SessionError onRestart={this.props.onRestart} /> : this.props.children
  }
}

const FULL_BOARD_KEY = 'go-to-d:full-board'

function readFullBoard(): boolean {
  try {
    return localStorage.getItem(FULL_BOARD_KEY) === '1'
  } catch {
    return false
  }
}

function writeFullBoard(on: boolean): void {
  try {
    localStorage.setItem(FULL_BOARD_KEY, on ? '1' : '0')
  } catch {
    // Just not remembered.
  }
}

interface SessionProps {
  config: SparConfig
  engine: EngineHub
  gapMs?: number
  onRestart: () => void
}

function Session({ config, engine, gapMs, onRestart }: SessionProps) {
  const [{ controller, view }] = useState(() => {
    const c = new SparController(BOOK, engine, config, { bookLoss: checkedLoss })
    return { controller: c, view: new SessionView(c, { gapMs }) }
  })
  const { state, feed, lastMove } = useSyncExternalStore(view.subscribe, view.snapshot)
  const [drill, setDrill] = useState({ mode: config.mode, family: config.family, patternId: config.patternId })
  const [saveFailed, setSaveFailed] = useState(false)
  const [failed, setFailed] = useState(false)
  const [full, setFull] = useState(readFullBoard)
  // The touch ghost, owned here so the "Play O17" button can clear it. Any new position drops it,
  // including the one Retry brings back.
  const [ghost, setGhost] = useState<Pt | null>(null)
  const [ghostBoard, setGhostBoard] = useState<Grid>(state.pos.board)
  if (ghostBoard !== state.pos.board) {
    setGhostBoard(state.pos.board)
    setGhost(null)
  }
  const reported = useRef(false)
  const pendingDispose = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => {
    // StrictMode unmounts and remounts once in development: a dispose still pending means this is that
    // remount, so the same session carries on (start() runs once). A real unmount disposes it.
    clearTimeout(pendingDispose.current)
    const detach = view.attach()
    controller.start().catch((err: unknown) => {
      console.error('[spar] the session could not start', err)
      setFailed(true)
    })
    return () => {
      detach()
      pendingDispose.current = setTimeout(() => controller.dispose(), 0)
    }
  }, [controller, view])

  const side = config.side
  const family = BOOK.families[drill.family]
  const owner = ownerColor(family.def, side)
  const title = drill.patternId ? BOOK.patterns[drill.patternId].def.name : COPY.spar.freeTitle(family.def.name)

  // The session is over: save it, hand it to the report, go there.
  useEffect(() => {
    if (state.status !== 'done' || !state.result || reported.current) return
    reported.current = true
    const saved = saveSession(state.result)
    const owned = state.log.filter((e) => e.by === 'owner')
    setLastReport({
      result: state.result,
      saved,
      title,
      family: drill.family,
      side,
      mode: drill.mode,
      ...(drill.patternId ? { patternId: drill.patternId } : {}),
      board: state.pos.board,
      region: state.region,
      ...(lastMove ? { lastMove } : {}),
      note: state.note,
      noteLow: state.node?.confidence === 'low',
      message: state.message,
      right: owned.filter((e) => e.verdict?.type === 'good' || e.verdict?.type === 'fine-offbook').length,
      unchecked: owned.filter((e) => e.verdict?.type === 'unjudged').length,
    })
    navigate(href.report)
  }, [state, lastMove, title, drill, side])

  if (failed) return <SessionError onRestart={onRestart} />

  /** A move promise that rejects stops the session with a way to start again, not a frozen "thinking". */
  function fail(err: unknown) {
    console.error('[spar] the session failed', err)
    setFailed(true)
  }

  const canPlay = state.status === 'owner-to-move'
  const shownGhost = canPlay ? ghost : null

  function play(p: Pt | 'tenuki') {
    setGhost(null)
    controller.ownerPlay(p).catch(fail)
  }

  function switchTo(id: string) {
    let abandoned
    try {
      abandoned = controller.switchTo(id)
    } catch (err) {
      console.error('[spar] switch failed', err)
      return
    }
    if (abandoned && !saveSession(abandoned)) setSaveFailed(true)
    const entry = BOOK.patterns[id]
    setDrill({ mode: 'drill', family: entry.family, patternId: id })
    reported.current = false
    replaceQuietly(sparHref({ family: entry.family, pattern: id, side, sym: String(config.sym), seed: String(config.seed) }))
  }

  function toggleFull() {
    const next = !full
    setFull(next)
    writeFullBoard(next)
  }

  const v = state.lastVerdict
  let lastOwner = feed.length - 1
  while (lastOwner >= 0 && feed[lastOwner].by !== 'owner') lastOwner--
  const ownerLine = v && lastOwner >= 0 ? feed[lastOwner] : null
  const replies = feed.slice(lastOwner + 1).filter((l) => l.by === 'teacher')
  const stopped = state.status === 'stopped'

  const status =
    state.status === 'teacher-thinking'
      ? COPY.spar.teacherThinking
      : canPlay
        ? shownGhost
          ? COPY.spar.tapAgain(toGtp(shownGhost))
          : COPY.spar.yourMove
        : state.status === 'done'
          ? COPY.spar.done
          : null

  return (
    <div className="spar">
      <header className="spar-head">
        <h1>{title}</h1>
        <p className="who">{COPY.spar.youAre(owner, side)}</p>
      </header>

      <div className="spar-board">
        <Board
          board={state.pos.board}
          region={full ? undefined : state.region}
          lastMove={lastMove}
          markers={markersFor(state, lastMove)}
          onPlay={play}
          disabled={!canPlay}
          toPlay={owner}
          ghost={shownGhost}
          onGhost={setGhost}
        />
      </div>

      <div className="spar-panel">
        <div className={`bar${status || canPlay ? '' : ' bar-empty'}`}>
          <p className="status" role="status">
            {status}
          </p>
          {canPlay &&
            (shownGhost ? (
              <button type="button" className="btn btn-primary" onClick={() => play(shownGhost)}>
                {COPY.spar.playPoint(toGtp(shownGhost))}
              </button>
            ) : (
              <button type="button" className="btn" onClick={() => play('tenuki')}>
                {COPY.spar.playElsewhere}
              </button>
            ))}
          {state.status === 'done' && (
            <a className="btn btn-primary" href={href.report}>
              {COPY.spar.seeReport}
            </a>
          )}
        </div>
        {state.message && <p className="notice">{state.message}</p>}
        {saveFailed && <p className="notice">{COPY.spar.saveFailed}</p>}

        <div className="talk" aria-live="polite">
          {ownerLine && v && (
            <VerdictView
              v={v}
              low={ownerLine.low}
              stopped={stopped}
              onRetry={() => controller.retry()}
              onPlayOn={() => controller.playOn().catch(fail)}
              onSwitch={switchTo}
            />
          )}
          {replies.map((l, i) => (
            <MoveLine key={i} line={l} color={otherColor(owner)} />
          ))}
        </div>

        <div className="tools">
          <button type="button" className="btn btn-quiet" aria-pressed={full} onClick={toggleFull}>
            {full ? COPY.spar.cornerView : COPY.spar.fullBoard}
          </button>
          <EngineChip engine={engine} />
        </div>

        {feed.length > 0 && <Feed feed={feed} owner={owner} />}
      </div>
    </div>
  )
}

/** Red pen on a stopped mistake (the stone played, the better point); the book's move after a fine off-book one. */
function markersFor(state: SparState, lastMove: Pt | undefined): BoardMarker[] {
  const v = state.lastVerdict
  if (state.status === 'stopped' && v?.type === 'mistake') {
    const out: BoardMarker[] = []
    if (lastMove) out.push({ pt: lastMove, kind: 'mistake' })
    if (v.better && v.better !== 'tenuki') out.push({ pt: v.better, kind: 'better' })
    return out
  }
  if (v?.type === 'fine-offbook' && v.bookMove && v.bookMove !== 'tenuki' && state.pos.board[v.bookMove.y][v.bookMove.x] === null) {
    return [{ pt: v.bookMove, kind: 'hint' }]
  }
  return []
}

function Low() {
  return <p className="low">{COPY.spar.lowConfidence}</p>
}

interface VerdictProps {
  v: Verdict
  low: boolean
  stopped: boolean
  onRetry: () => void
  onPlayOn: () => void
  onSwitch: (patternId: string) => void
}

function VerdictView({ v, low, stopped, onRetry, onPlayOn, onSwitch }: VerdictProps) {
  const C = COPY.verdict
  switch (v.type) {
    case 'good':
      return (
        <div className="verdict verdict-good">
          <p>
            <strong>{v.kind === 'alternative' ? C.alternative : C.good}</strong> {v.note}
          </p>
          {low && <Low />}
        </div>
      )
    case 'fine-offbook': {
      const book = v.bookMove === null ? '' : v.bookMove === 'tenuki' ? C.bookPlaysElsewhere : C.bookPlays(toGtp(v.bookMove))
      return (
        <div className="verdict verdict-fine">
          <p>
            <strong>{v.bookMove === null ? C.fineNoBook : C.fineOffbook}</strong> {C.fineCost(v.pointsLost)} {book}
          </p>
        </div>
      )
    }
    case 'unjudged':
      return (
        <div className="verdict verdict-unjudged">
          <p>{C.unjudged}</p>
        </div>
      )
    case 'mistake': {
      const better =
        v.better === null
          ? v.pointsLost === null
            ? null
            : C.costOnly(v.pointsLost)
          : v.better === 'tenuki'
            ? C.betterElsewhere(v.pointsLost)
            : C.better(toGtp(v.better), v.pointsLost)
      return (
        <div className="verdict verdict-mistake">
          <p>
            <strong>{v.big ? C.bigMistake : C.mistake}</strong> {better}
          </p>
          {/* The buttons come before the note, so they stay near the board on a small phone. */}
          {stopped && (
            <div className="actions">
              <button type="button" className="btn btn-primary" onClick={onRetry}>
                {C.retry}
              </button>
              <button type="button" className="btn" onClick={onPlayOn}>
                {C.playOn}
              </button>
            </div>
          )}
          {v.note && <p>{v.note}</p>}
          {low && <Low />}
        </div>
      )
    }
    case 'other-joseki': {
      const names = v.patternIds.map((id) => BOOK.patterns[id]?.def.name ?? id)
      const body = names.length === 1 ? C.otherJosekiOne(names[0]) : names.length > 1 ? C.otherJosekiMany : C.otherJosekiNone
      return (
        <div className="verdict verdict-other">
          <p>
            <strong>{C.otherJoseki}</strong> {v.note}
          </p>
          {low && <Low />}
          <p>{body}</p>
          {stopped && (
            <div className="actions">
              <button type="button" className="btn btn-primary" onClick={onRetry}>
                {C.retryDrill}
              </button>
              {v.patternIds.map((id, i) => (
                <button key={id} type="button" className="btn" onClick={() => onSwitch(id)}>
                  {v.patternIds.length === 1 ? C.switchOne : C.switchTo(names[i])}
                </button>
              ))}
            </div>
          )}
        </div>
      )
    }
  }
}

function StoneGlyph({ color }: { color: Color }) {
  return (
    <svg className="glyph" viewBox="-1 -1 2 2" aria-hidden="true">
      <circle className={`stone ${color}`} r={0.86} />
    </svg>
  )
}

function where(l: FeedLine): string {
  if (l.tenuki) return l.at ? COPY.spar.elsewhere(l.at) : COPY.spar.playElsewhere
  return l.at ?? ''
}

/** The teacher's move and its note. */
function MoveLine({ line, color }: { line: FeedLine; color: Color }) {
  return (
    <div className="move-line">
      <p>
        <StoneGlyph color={color} />
        <strong>{where(line)}</strong> {line.note}
      </p>
      {line.low && <Low />}
    </div>
  )
}

function verdictWord(v: Verdict | undefined): string {
  const C = COPY.verdict
  switch (v?.type) {
    case 'good':
      return v.kind === 'alternative' ? C.alternative : C.good
    case 'fine-offbook':
      return v.bookMove === null ? C.fineNoBook : C.fineOffbook
    case 'mistake':
      return v.big ? C.bigMistake : C.mistake
    case 'other-joseki':
      return C.otherJoseki
    case 'unjudged':
      return C.unjudged
    default:
      return ''
  }
}

function Feed({ feed, owner }: { feed: FeedLine[]; owner: Color }) {
  return (
    <details className="feed">
      <summary>{COPY.spar.movesSoFar(feed.length)}</summary>
      <ol>
        {feed.map((l, i) => (
          <li key={i}>
            <StoneGlyph color={l.by === 'owner' ? owner : otherColor(owner)} />
            <strong>{where(l)}</strong> {l.by === 'owner' && <em>{verdictWord(l.verdict)}</em>} {l.note}
          </li>
        ))}
      </ol>
    </details>
  )
}
