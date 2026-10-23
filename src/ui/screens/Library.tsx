// Every pattern in the book, family by family in course order. Each row opens the pattern's page, and
// under it each drillable side has its level and two ways in (R45): Watch (the line played through once,
// then the test) and Test (straight to the drill).

import { useState } from 'react'
import { BOOK } from '../shownBook'
import type { FamilyId } from '../../book/types'
import { reviewKey } from '../../progress/srs'
import { loadProgress } from '../../progress/store'
import { drillableSides, ownerColor } from '../../session/sides'
import { CornerThumb } from '../CornerThumb'
import { COPY } from '../copy'
import { Pips } from '../Pips'
import { href, phaseHref } from '../router'

const L = COPY.library
const W = COPY.watch

const byOrder = Object.keys(BOOK.patterns).sort((a, b) => BOOK.patterns[a].def.order - BOOK.patterns[b].def.order)

export function Library() {
  const [progress] = useState(loadProgress)

  return (
    <section className="page library">
      <header className="page-head">
        <h1>{L.title}</h1>
        <p className="lead">{L.lead(byOrder.length)}</p>
        <p className="muted small">{L.legend}</p>
      </header>

      {(Object.keys(BOOK.families) as FamilyId[]).map((family) => {
        const ids = byOrder.filter((id) => BOOK.patterns[id].family === family)
        if (ids.length === 0) return null
        const def = BOOK.families[family].def
        return (
          <section key={family} className="family" aria-labelledby={`family-${family}`}>
            <h2 id={`family-${family}`}>{def.name}</h2>
            <ul className="queue-list">
              {ids.map((id) => (
                <li key={id} className="lib-row">
                  <a className="queue-item" href={href.pattern(id)}>
                    <CornerThumb patternId={id} />
                    <span className="queue-text">
                      <span className="queue-name">{BOOK.patterns[id].def.name}</span>
                    </span>
                  </a>
                  <div className="lib-sides">
                    {drillableSides(BOOK, id).map((side) => {
                      const box = progress.reviews[reviewKey(id, side)]?.box ?? 0
                      const drill = { family, pattern: id, side }
                      return (
                        <div key={side} className="lib-side" role="group" aria-label={COPY.pattern.drill(side, ownerColor(def, side))}>
                          <span className="side-level">
                            {L.sideShort(side)}
                            <Pips box={box} />
                          </span>
                          <a className="btn btn-small" href={phaseHref(drill, 'watch')}>
                            {W.watch}
                          </a>
                          <a className="btn btn-small" href={phaseHref(drill, 'test')}>
                            {W.test}
                          </a>
                        </div>
                      )
                    })}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )
      })}
    </section>
  )
}
