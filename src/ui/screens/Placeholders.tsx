// Stand-ins for Today, Library, Pattern and Settings until Task 8 builds them. They only link to drills.

import { BOOK } from '../../book/data'
import { drillableSides } from '../../session/sides'
import { COPY } from '../copy'
import { href, sparHref } from '../router'

const P = COPY.placeholder

const byOrder = Object.entries(BOOK.patterns).sort(([, a], [, b]) => a.def.order - b.def.order)

export function TodayPlaceholder() {
  return (
    <section className="page">
      <h1>{P.todayTitle}</h1>
      <p>{P.todayBody}</p>
      <ul className="link-list">
        {byOrder.slice(0, 4).map(([id, e]) => (
          <li key={id}>
            <a href={sparHref({ family: e.family, pattern: id, side: 'defend' })}>{e.def.name}</a>
          </li>
        ))}
        <li>
          <a href={sparHref({ family: 'star44', side: 'defend' })}>{P.free(BOOK.families.star44.def.name)}</a>
        </li>
      </ul>
    </section>
  )
}

export function LibraryPlaceholder() {
  return (
    <section className="page">
      <h1>{P.libraryTitle}</h1>
      {Object.values(BOOK.families).map((fam) => (
        <section key={fam.def.id} className="family">
          <h2>{fam.def.name}</h2>
          <ul className="link-list">
            {byOrder
              .filter(([, e]) => e.family === fam.def.id)
              .map(([id, e]) => (
                <li key={id}>
                  <a href={href.pattern(id)}>{e.def.name}</a>
                </li>
              ))}
          </ul>
        </section>
      ))}
    </section>
  )
}

export function PatternPlaceholder({ id }: { id: string }) {
  const entry = Object.hasOwn(BOOK.patterns, id) ? BOOK.patterns[id] : undefined
  if (!entry) return <NotFound />
  return (
    <section className="page">
      <h1>{entry.def.name}</h1>
      <p className="muted">{BOOK.families[entry.family].def.name}</p>
      <div className="actions">
        {drillableSides(BOOK, id).map((side) => (
          <a key={side} className="btn btn-primary" href={sparHref({ family: entry.family, pattern: id, side })}>
            {P.drill(side)}
          </a>
        ))}
      </div>
    </section>
  )
}

export function SettingsPlaceholder() {
  return (
    <section className="page">
      <h1>{P.settingsTitle}</h1>
      <p>{P.settingsBody}</p>
    </section>
  )
}

export function NotFound() {
  return (
    <section className="screen-msg">
      <h1>{P.notFoundTitle}</h1>
      <p>{P.notFoundBody}</p>
      <a className="btn" href={href.today}>
        {COPY.spar.backToToday}
      </a>
    </section>
  )
}
