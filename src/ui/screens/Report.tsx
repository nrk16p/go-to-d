// After a session: how it went, the corner as it ended, when this pattern comes back, what else is due.

import { useState } from 'react'
import { BOOK } from '../shownBook'
import { dueItems } from '../../progress/course'
import { reviewKey } from '../../progress/srs'
import { loadProgress, todayLocal } from '../../progress/store'
import { Board } from '../Board'
import { COPY, points } from '../copy'
import { getLastReport, type SessionReport } from '../reportStore'
import { href, sparHref } from '../router'

/** Whole days from `from` to `to`, both "YYYY-MM-DD". */
function daysBetween(from: string, to: string): number {
  const utc = (d: string) => {
    const [y, m, day] = d.split('-').map(Number)
    return Date.UTC(y, m - 1, day)
  }
  return Math.round((utc(to) - utc(from)) / 86_400_000)
}

function headline(r: SessionReport): string {
  if (r.result.clean) return COPY.report.clean
  if (r.result.mistakes > 0) return COPY.report.mistakes(r.result.mistakes)
  return COPY.report.unfinished
}

export function Report() {
  const [report] = useState(getLastReport)
  const [progress] = useState(loadProgress)
  const today = todayLocal()

  if (!report) {
    return (
      <section className="screen-msg">
        <h1>{COPY.report.none}</h1>
        <a className="btn btn-primary" href={href.today}>
          {COPY.report.pickDrill}
        </a>
      </section>
    )
  }

  const R = COPY.report
  const { result } = report
  const scheduled = result.patternIds[0]
  const due = scheduled ? progress.reviews[reviewKey(scheduled, report.side)]?.due : undefined
  const days = due ? daysBetween(today, due) : null
  const next = days === null ? null : days <= 0 ? R.nextToday : days === 1 ? R.nextTomorrow : R.nextIn(days)

  // The same list as Today's (M4): sides the book can no longer drill are left out.
  const dueList = dueItems(BOOK, progress, today).map((d) => ({ ...d, id: d.patternId, entry: BOOK.patterns[d.patternId] }))

  const again = sparHref({
    family: report.family,
    ...(report.mode === 'drill' && report.patternId ? { pattern: report.patternId } : { mode: 'free' }),
    side: report.side,
  })

  return (
    <div className="report">
      <header className="report-head">
        <h1>{headline(report)}</h1>
        <p className="who">{R.subtitle(report.title, report.side)}</p>
      </header>

      <div className="report-board">
        <Board board={report.board} region={report.region} lastMove={report.lastMove} />
        {report.note && <p className="report-note">{report.note}</p>}
        {report.note && report.noteLow && <p className="low">{COPY.spar.lowConfidence}</p>}
      </div>

      <div className="report-body">
        <dl className="stats">
          <div>
            <dt>{R.right}</dt>
            <dd>{report.right}</dd>
          </div>
          <div>
            <dt>{R.wrong}</dt>
            <dd>{result.mistakes}</dd>
          </div>
          <div>
            <dt>{R.lost}</dt>
            <dd aria-label={points(result.pointsLost)}>{result.pointsLost}</dd>
          </div>
          {report.unchecked > 0 && (
            <div>
              <dt>{R.unchecked}</dt>
              <dd>{report.unchecked}</dd>
            </div>
          )}
        </dl>

        {report.message && <p className="notice">{report.message}</p>}
        {!report.saved && <p className="notice">{COPY.spar.saveFailed}</p>}
        {report.saved && report.mode === 'free' && scheduled && BOOK.patterns[scheduled] && (
          <p>{R.countedFor(BOOK.patterns[scheduled].def.name)}</p>
        )}
        {report.saved && (scheduled ? next && <p>{next}</p> : <p>{R.nothingScheduled}</p>)}

        <section className="due" aria-labelledby="due-title">
          <h2 id="due-title">{R.dueTitle}</h2>
          {dueList.length === 0 ? (
            <p className="muted">{R.dueNone}</p>
          ) : (
            <ul className="link-list">
              {dueList.map((d) => (
                <li key={d.key}>
                  <a href={sparHref({ family: d.entry.family, pattern: d.id, side: d.side })}>
                    {d.entry.def.name}
                    <span className="muted">{R.dueSide(d.side)}</span>
                  </a>
                </li>
              ))}
            </ul>
          )}
        </section>

        <div className="actions">
          <a className="btn btn-primary" href={again}>
            {R.again}
          </a>
          <a className="btn" href={href.today}>
            {R.today}
          </a>
        </div>
      </div>
    </div>
  )
}
