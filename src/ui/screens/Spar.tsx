// The sparring screen: the board, what the teacher says about the last moves, and the buttons that
// go with each verdict. The session itself is a SparController; this screen only shows it and passes
// taps on. When the session ends it is saved and the Report screen takes over.

import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { BOOK } from '../../book/data'
import { toGtp, type Board as Grid, type Color, type Pt } from '../../go/coords'
import { otherColor } from '../../go/rules'
import { loadProgress, todayLocal } from '../../progress/store'
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
  return <Session config={setup.config} engine={engine} gapMs={gapMs} />
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

function Session({ config, engine, gapMs }: { config: SparConfig; engine: EngineHub; gapMs?: number }) {
  const [{ controller, view }] = useState(() => {
    const c = new SparController(BOOK, engine, config)
    return { controller: c, view: new SessionView(c, { gapMs }) }
  })
  const { state, feed, lastMove } = useSyncExternalStore(view.subscribe, view.snapshot)
  const [drill, setDrill] = useState({ mode: config.mode, family: config.family, patternId: config.patternId })
  const [saveFailed, setSaveFailed] = useState(false)
  const [full, setFull] = useState(readFullBoard)
  const [preview, setPreview] = useState<{ pt: Pt; board: Grid } | null>(null)
  const reported = useRef(false)

  useEffect(() => {
    const detach = view.attach()
    controller.start().catch((err: unknown) => console.error('[spar] the session could not start', err))
    return detach
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
      day: todayLocal(),
    })
    navigate(href.report)
  }, [state, lastMove, title, drill, side])

  const canPlay = state.status === 'owner-to-move'
  const previewPt = canPlay && preview && preview.board === state.pos.board ? preview.pt : null

  function play(p: Pt | 'tenuki') {
    setPreview(null)
    controller.ownerPlay(p).catch((err: unknown) => console.error('[spar] move failed', err))
  }

  function playOn() {
    controller.playOn().catch((err: unknown) => console.error('[spar] play on failed', err))
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
    replaceQuietly(sparHref({ family: entry.family, pattern: id, side }))
  }

  function toggleFull() {
    setFull((f) => {
      writeFullBoard(!f)
      return !f
    })
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
        ? previewPt
          ? COPY.spar.tapAgain(toGtp(previewPt))
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
          onPreview={(p) => setPreview({ pt: p, board: state.pos.board })}
        />
      </div>

      <div className="spar-panel">
        <p className="status" role="status">
          {status}
        </p>
        {state.message && <p className="notice">{state.message}</p>}
        {saveFailed && <p className="notice">{COPY.spar.saveFailed}</p>}

        <div className="talk" aria-live="polite">
          {ownerLine && v && (
            <VerdictView
              v={v}
              low={ownerLine.low}
              stopped={stopped}
              onRetry={() => controller.retry()}
              onPlayOn={playOn}
              onSwitch={switchTo}
            />
          )}
          {replies.map((l, i) => (
            <MoveLine key={i} line={l} color={otherColor(owner)} />
          ))}
        </div>

        {state.status === 'done' && (
          <div className="actions">
            <a className="btn btn-primary" href={href.report}>
              {COPY.spar.seeReport}
            </a>
          </div>
        )}

        <div className="actions">
          {previewPt && (
            <button type="button" className="btn btn-primary" onClick={() => play(previewPt)}>
              {COPY.spar.playPoint(toGtp(previewPt))}
            </button>
          )}
          {/* While stopped, the verdict's own buttons are the way on. */}
          {!stopped && (
            <button type="button" className="btn" disabled={!canPlay} onClick={() => play('tenuki')}>
              {COPY.spar.playElsewhere}
            </button>
          )}
          <button type="button" className="btn btn-quiet" aria-pressed={full} onClick={toggleFull}>
            {full ? COPY.spar.cornerView : COPY.spar.fullBoard}
          </button>
        </div>

        <EngineChip engine={engine} />

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
            <strong>{C.fineOffbook}</strong> {C.fineCost(v.pointsLost)} {book}
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
          {v.note && <p>{v.note}</p>}
          {low && <Low />}
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
      return C.fineOffbook
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
