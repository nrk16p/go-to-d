// A book line on the board, a move at a time: Previous and Next (the arrow keys too), Auto-play, and
// under the board what the teacher says about the move just played. The watch phase (R45) and the
// Pattern page both use it, so there is one way to step through a line. It only shows the book: no
// engine, no verdicts, nothing saved.
//
// Phone layout, under the board: the stepper, then Auto-play with the screen's own button beside it
// (the watch's "Try it yourself"), then the note.

import { useEffect, useState, type ReactNode } from 'react'
import { toGtp, type Color } from '../go/coords'
import { Board } from './Board'
import { COPY } from './copy'
import { AUTO_PLAY_MS, type WatchLine } from './watchLine'

const P = COPY.pattern

export interface LinePlayerProps {
  line: WatchLine
  /** Auto-play from the start. */
  autoPlay?: boolean
  /** Class names for the board's box and the panel's box, so each screen keeps its own layout. */
  boardClass: string
  panelClass: string
  /** A button next to Auto-play. It is told when the last move is on the board. */
  action?: (atEnd: boolean) => ReactNode
  /** More of the panel, under the note. */
  children?: ReactNode
}

export function LinePlayer({ line, autoPlay = false, boardClass, panelClass, action, children }: LinePlayerProps) {
  const last = line.steps.length - 1
  const [step, setStep] = useState(0)
  const [playing, setPlaying] = useState(autoPlay)
  // Auto-play rests at the end of the line; pressing it there starts the line over.
  const running = playing && step < last

  useEffect(() => {
    if (!running) return
    const timer = setTimeout(() => setStep((i) => Math.min(last, i + 1)), AUTO_PLAY_MS)
    return () => clearTimeout(timer)
  }, [running, step, last])

  // Stepping by hand stops Auto-play: the owner wants to look at this move.
  const go = (to: (i: number) => number) => {
    setPlaying(false)
    setStep((i) => Math.max(0, Math.min(last, to(i))))
  }

  // Arrow keys step too, unless the focus is somewhere that uses them.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return
      const t = e.target as HTMLElement | null
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return
      if (e.key === 'ArrowLeft') go((i) => i - 1)
      else if (e.key === 'ArrowRight') go((i) => i + 1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  function toggle() {
    if (running) {
      setPlaying(false)
      return
    }
    if (step >= last) setStep(0)
    setPlaying(true)
  }

  const s = line.steps[step]
  const atEnd = step === last
  const kind = s.node && s.node.kind !== 'joseki' ? P.kind[s.node.kind] : null

  return (
    <>
      <div className={boardClass}>
        <Board board={s.pos.board} region={line.region} lastMove={s.at ?? undefined} />
      </div>

      <div className={panelClass}>
        <div className="stepper">
          <button type="button" className="btn" disabled={step === 0} onClick={() => go((i) => i - 1)}>
            {P.prev}
          </button>
          <p className="step-count">{step === 0 ? P.start : P.step(step, last)}</p>
          <button type="button" className="btn" disabled={atEnd} onClick={() => go((i) => i + 1)}>
            {P.next}
          </button>
        </div>

        <div className="line-controls">
          <button type="button" className="btn line-auto" onClick={toggle}>
            <span className={`line-auto-icon${running ? ' is-pause' : ''}`} aria-hidden="true" />
            {running ? COPY.watch.pause : COPY.watch.autoPlay}
          </button>
          {action?.(atEnd)}
        </div>

        <div className="step" aria-live="polite">
          <p>
            {s.node && s.color ? (
              <>
                <StoneGlyph color={s.color} />
                <strong>{s.tenuki || !s.at ? P.elsewhere(s.color) : P.move(s.color, toGtp(s.at))}</strong>{' '}
                {kind && <span className={`tag tag-${s.node.kind}`}>{kind}</span>} {s.note}
              </>
            ) : (
              s.note
            )}
          </p>
          {s.low && <p className="low">{COPY.spar.lowConfidence}</p>}
        </div>

        {children}
      </div>
    </>
  )
}

function StoneGlyph({ color }: { color: Color }) {
  return (
    <svg className="glyph" viewBox="-1 -1 2 2" aria-hidden="true">
      <circle className={`stone ${color}`} r={0.86} />
    </svg>
  )
}
