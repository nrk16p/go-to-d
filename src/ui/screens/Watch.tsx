// The watch phase (R45): before the test, the teacher plays the pattern's main line through once, a
// move at a time, on the board the test will use (same sym, so a turned corner looks the same in both),
// with each move's note under the board. Nothing is judged or saved here and the engine isn't asked.
// "Try it yourself" goes to the test: the same address without phase=watch, same sym and seed.
//
// New patterns open here first (Today's "New today", the Watch buttons in the Library and on the Pattern
// page). Reviews open straight in the test, which offers "Watch first" before the owner's first move.

import { useEffect, useState } from 'react'
import { ownerColor } from '../../session/sides'
import { COPY } from '../copy'
import { LinePlayer } from '../LinePlayer'
import { href, phaseHref, replaceQuietly, sparHref, type SparParams } from '../router'
import { BOOK } from '../shownBook'
import { resolveSpar } from '../sparSetup'
import { prefersReducedMotion, watchLine } from '../watchLine'

const W = COPY.watch

export function Watch({ params }: { params: SparParams }) {
  // Progress only steers the test's teacher; watching needs none of it.
  const [setup] = useState(() => resolveSpar(params, BOOK, null))
  // As on the Spar screen: the board turn and seed picked for a link without them go into the address,
  // so a reload shows the same board, and the test after it keeps them.
  const [address] = useState(() =>
    setup.ok ? sparHref({ ...params, sym: String(setup.config.sym), seed: String(setup.config.seed) }) : null,
  )
  useEffect(() => {
    if (address) replaceQuietly(address)
  }, [address])
  const [autoPlay] = useState(() => !prefersReducedMotion())

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

  const { config } = setup
  const patternId = config.patternId!
  const entry = BOOK.patterns[patternId]
  const owner = ownerColor(BOOK.families[config.family].def, config.side)
  const test = phaseHref(
    { family: config.family, pattern: patternId, side: config.side, sym: String(config.sym), seed: String(config.seed) },
    'test',
  )

  return (
    <div className="spar watch">
      <header className="spar-head">
        <h1>{entry.def.name}</h1>
        <p className="who">{W.lead(owner, config.side)}</p>
      </header>

      <LinePlayer
        line={watchLine(BOOK, patternId, config.sym)}
        autoPlay={autoPlay}
        boardClass="spar-board"
        panelClass="spar-panel"
        action={(atEnd) => (
          <a className={`btn try-it${atEnd ? ' btn-primary is-end' : ''}`} href={test}>
            {W.tryIt}
          </a>
        )}
      />
    </div>
  )
}
