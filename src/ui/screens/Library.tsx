// Every pattern in the book, family by family in course order, with how far each drillable side has got.
// The corner families come first, then the whole-board openings in a section of their own (R46), whose
// sides read as colours.

import { useState } from 'react'
import { BOOK } from '../shownBook'
import { isBoardFamily } from '../../book/setups'
import type { FamilyId } from '../../book/types'
import type { Progress } from '../../progress/srs'
import { reviewKey } from '../../progress/srs'
import { loadProgress } from '../../progress/store'
import { drillableSides } from '../../session/sides'
import { CornerThumb } from '../CornerThumb'
import { COPY } from '../copy'
import { Pips } from '../Pips'
import { href } from '../router'
import { sideShortLabel } from '../seat'

const L = COPY.library

const byOrder = Object.keys(BOOK.patterns).sort((a, b) => BOOK.patterns[a].def.order - BOOK.patterns[b].def.order)
const FAMILIES = (Object.keys(BOOK.families) as FamilyId[]).filter((f) => byOrder.some((id) => BOOK.patterns[id].family === f))
const CORNERS = FAMILIES.filter((f) => !isBoardFamily(BOOK.families[f].def))
const OPENINGS = FAMILIES.filter((f) => isBoardFamily(BOOK.families[f].def))

export function Library() {
  const [progress] = useState(loadProgress)

  return (
    <section className="page library">
      <header className="page-head">
        <h1>{L.title}</h1>
        <p className="lead">{L.lead(byOrder.length)}</p>
        <p className="muted small">{L.legend}</p>
      </header>

      {CORNERS.map((family) => (
        <section key={family} className="family" aria-labelledby={`family-${family}`}>
          <h2 id={`family-${family}`}>{BOOK.families[family].def.name}</h2>
          <PatternList family={family} progress={progress} />
        </section>
      ))}

      {OPENINGS.length > 0 && (
        <section className="openings" aria-labelledby="openings-title">
          <header className="page-head">
            <h2 id="openings-title">{L.openingsTitle}</h2>
            <p className="muted small">{L.openingsBody}</p>
          </header>
          {OPENINGS.map((family) => (
            <section key={family} className="family" aria-labelledby={`family-${family}`}>
              <h3 id={`family-${family}`}>{BOOK.families[family].def.name}</h3>
              <PatternList family={family} progress={progress} />
            </section>
          ))}
        </section>
      )}
    </section>
  )
}

function PatternList({ family, progress }: { family: FamilyId; progress: Progress }) {
  const def = BOOK.families[family].def
  return (
    <ul className="queue-list">
      {byOrder
        .filter((id) => BOOK.patterns[id].family === family)
        .map((id) => (
          <li key={id}>
            <a className="queue-item" href={href.pattern(id)}>
              <CornerThumb patternId={id} />
              <span className="queue-text">
                <span className="queue-name">{BOOK.patterns[id].def.name}</span>
                <span className="queue-meta sides">
                  {drillableSides(BOOK, id).map((side) => {
                    const box = progress.reviews[reviewKey(id, side)]?.box ?? 0
                    return (
                      <span key={side} className="side-level">
                        {sideShortLabel(def, side)}
                        <Pips box={box} />
                      </span>
                    )
                  })}
                </span>
              </span>
            </a>
          </li>
        ))}
    </ul>
  )
}
