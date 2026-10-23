// One pattern's main line, a move at a time, with the teacher's note on each move, then a way into the
// drill from each side it can be drilled from. Shown in the book's own frame (sym 0), as notes are written.

import { useEffect, useState } from 'react'
import { BOOK } from '../../book/data'
import { toGtp, type Color } from '../../go/coords'
import { drillableSides, ownerColor } from '../../session/sides'
import { Board } from '../Board'
import { COPY } from '../copy'
import { mainLine } from '../mainLine'
import { href, sparHref } from '../router'
import { NotFound } from './NotFound'

const P = COPY.pattern

export function Pattern({ id }: { id: string }) {
  if (!Object.hasOwn(BOOK.patterns, id)) return <NotFound />
  return <PatternView key={id} id={id} />
}

function PatternView({ id }: { id: string }) {
  const entry = BOOK.patterns[id]
  const family = BOOK.families[entry.family].def
  const line = mainLine(BOOK, id)
  const last = line.steps.length - 1
  const [step, setStep] = useState(0)
  const s = line.steps[step]
  const sides = drillableSides(BOOK, id)

  // Arrow keys step too, unless the focus is somewhere that uses them.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return
      const t = e.target as HTMLElement | null
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return
      if (e.key === 'ArrowLeft') setStep((i) => Math.max(0, i - 1))
      else if (e.key === 'ArrowRight') setStep((i) => Math.min(last, i + 1))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [last])

  const node = s.node
  const move = node?.move ?? null
  const kind = node && node.kind !== 'joseki' ? P.kind[node.kind] : null

  return (
    <div className="pattern">
      <header className="pattern-head">
        <a className="back" href={href.library}>
          {P.back}
        </a>
        <h1>{entry.def.name}</h1>
        <p className="who">{P.meta(family.name, entry.def.difficulty)}</p>
      </header>

      <div className="pattern-board">
        <Board board={s.pos.board} region={line.region} lastMove={s.at ?? undefined} />
      </div>

      <div className="pattern-panel">
        <div className="stepper">
          <button type="button" className="btn" disabled={step === 0} onClick={() => setStep(step - 1)}>
            {P.prev}
          </button>
          <p className="step-count">{step === 0 ? P.start : P.step(step, last)}</p>
          <button type="button" className="btn" disabled={step === last} onClick={() => setStep(step + 1)}>
            {P.next}
          </button>
        </div>

        <div className="step" aria-live="polite">
          <p>
            {move ? (
              <>
                <StoneGlyph color={move.color} />
                <strong>{move.at === 'tenuki' ? P.elsewhere(move.color) : P.move(move.color, toGtp(move.at))}</strong>{' '}
                {kind && <span className={`tag tag-${node!.kind}`}>{kind}</span>} {node!.note}
              </>
            ) : (
              family.start[0]?.note
            )}
          </p>
          {node?.confidence === 'low' && <p className="low">{COPY.spar.lowConfidence}</p>}
        </div>

        <section className="drill" aria-labelledby="drill-title">
          <h2 id="drill-title">{P.drillTitle}</h2>
          <div className="actions">
            {sides.map((side, i) => (
              <a
                key={side}
                className={`btn${i === 0 ? ' btn-primary' : ''}`}
                href={sparHref({ family: entry.family, pattern: id, side })}
              >
                {P.drill(side, ownerColor(family, side))}
              </a>
            ))}
          </div>
          {sides.length === 1 && <p className="muted small">{P.oneSide}</p>}
        </section>
      </div>
    </div>
  )
}

function StoneGlyph({ color }: { color: Color }) {
  return (
    <svg className="glyph" viewBox="-1 -1 2 2" aria-hidden="true">
      <circle className={`stone ${color}`} r={0.86} />
    </svg>
  )
}
