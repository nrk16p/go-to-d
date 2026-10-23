// Every pattern in the book, family by family in course order, with how far each drillable side has got.

import { useState } from 'react'
import { BOOK } from '../shownBook'
import type { FamilyId } from '../../book/types'
import { reviewKey } from '../../progress/srs'
import { loadProgress } from '../../progress/store'
import { drillableSides } from '../../session/sides'
import { CornerThumb } from '../CornerThumb'
import { COPY } from '../copy'
import { Pips } from '../Pips'
import { href } from '../router'

const L = COPY.library

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
        return (
          <section key={family} className="family" aria-labelledby={`family-${family}`}>
            <h2 id={`family-${family}`}>{BOOK.families[family].def.name}</h2>
            <ul className="queue-list">
              {ids.map((id) => (
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
                              {L.sideShort(side)}
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
          </section>
        )
      })}
    </section>
  )
}
