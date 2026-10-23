// One pattern's main line, a move at a time, with the teacher's note on each move (the same player the
// watch phase uses), then the ways into the drill from each side it can be drilled from: Watch first or
// Test straight away (R45). Shown in the book's own frame (sym 0), as notes are written.

import { useId, useState } from 'react'
import { BOOK } from '../shownBook'
import { reviewKey } from '../../progress/srs'
import { loadProgress } from '../../progress/store'
import { drillableSides, ownerColor, type Side } from '../../session/sides'
import { COPY } from '../copy'
import { LinePlayer } from '../LinePlayer'
import { href, phaseHref } from '../router'
import { watchLine } from '../watchLine'
import { NotFound } from './NotFound'

const P = COPY.pattern
const W = COPY.watch

export function Pattern({ id }: { id: string }) {
  if (!Object.hasOwn(BOOK.patterns, id)) return <NotFound />
  return <PatternView key={id} id={id} />
}

function PatternView({ id }: { id: string }) {
  const entry = BOOK.patterns[id]
  const family = BOOK.families[entry.family].def
  const sides = drillableSides(BOOK, id)
  const [progress] = useState(loadProgress)

  return (
    <div className="pattern">
      <header className="pattern-head">
        <a className="back" href={href.library}>
          {P.back}
        </a>
        <h1>{entry.def.name}</h1>
        <p className="who">{P.meta(family.name, entry.def.difficulty)}</p>
      </header>

      <LinePlayer line={watchLine(BOOK, id, 0)} boardClass="pattern-board" panelClass="pattern-panel">
        <section className="drill" aria-labelledby="drill-title">
          <h2 id="drill-title">{P.drillTitle}</h2>
          {sides.map((side) => (
            <DrillSide
              key={side}
              label={P.drill(side, ownerColor(family, side))}
              drill={{ family: entry.family, pattern: id, side }}
              played={Object.hasOwn(progress.reviews, reviewKey(id, side))}
            />
          ))}
          {sides.length === 1 && <p className="muted small">{P.oneSide}</p>}
        </section>
      </LinePlayer>
    </div>
  )
}

/** One side's two ways in. A side not played yet leads with Watch; a played one with Test. */
function DrillSide({ label, drill, played }: { label: string; drill: { family: string; pattern: string; side: Side }; played: boolean }) {
  const labelId = useId()
  return (
    <div className="drill-side" role="group" aria-labelledby={labelId}>
      <p id={labelId} className="drill-who">
        {label}
      </p>
      <div className="actions">
        <a className={`btn${played ? '' : ' btn-primary'}`} href={phaseHref(drill, 'watch')}>
          {W.watch}
        </a>
        <a className={`btn${played ? ' btn-primary' : ''}`} href={phaseHref(drill, 'test')}>
          {W.test}
        </a>
      </div>
    </div>
  )
}
