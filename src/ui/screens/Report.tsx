// After a session: how it went, the corner as it ended, each mistake with the move to play instead (R51),
// when this pattern comes back, what else is due.

import { useState } from 'react'
import { BOOK } from '../shownBook'
import type { FamilyId } from '../../book/types'
import type { Side } from '../../session/sides'
import { dueItems } from '../../progress/course'
import { reviewKey } from '../../progress/srs'
import { loadProgress, todayLocal } from '../../progress/store'
import { inRegion, toGtp, withMargin } from '../../go/coords'
import type { MistakeRecord } from '../../session/controller'
import { Board, type BoardMarker } from '../Board'
import { COPY, points } from '../copy'
import { getLastReport, reviewList, type SessionReport } from '../reportStore'
import { href, sparHref } from '../router'
import { seatColor } from '../seat'

/** Whole days from `from` to `to`, both "YYYY-MM-DD". */
function daysBetween(from: string, to: string): number {
  const utc = (d: string) => {
    const [y, m, day] = d.split('-').map(Number)
    return Date.UTC(y, m - 1, day)
  }
  return Math.round((utc(to) - utc(from)) / 86_400_000)
}

/** ", defending" for a corner, ", as Black" for an opening. */
function dueWho(family: FamilyId, side: Side): string {
  const c = seatColor(BOOK.families[family].def, side)
  return c ? COPY.report.dueColor(c) : COPY.report.dueSide(side)
}

function headline(r: SessionReport): string {
  if (r.result.clean) return COPY.report.clean
  if (r.result.mistakes > 0) return COPY.report.mistakes(r.result.mistakes)
  return COPY.report.unfinished
}

/** "Best was R17." / elsewhere, or nothing when no move was named. */
function bestLine(m: MistakeRecord): string | null {
  const R = COPY.report
  if (m.better === null) return null
  if (m.better === 'tenuki') return R.reviewBestElsewhere
  return inRegion(m.better, withMargin(m.region)) ? R.reviewBest(toGtp(m.better)) : R.reviewBestElsewhereAt(toGtp(m.better))
}

function reviewMarkers(m: MistakeRecord): BoardMarker[] {
  const out: BoardMarker[] = []
  if (m.played) out.push({ pt: m.played, kind: 'mistake' })
  if (m.better && m.better !== 'tenuki') out.push({ pt: m.better, kind: 'better' })
  return out
}

/** R51: each position the owner went wrong in, biggest loss first, with a way to practise it. */
function MistakesReview({ report }: { report: SessionReport }) {
  const list = reviewList(report)
  if (list.length === 0) return null
  const R = COPY.report
  const top = list[0]
  return (
    <section className="review" aria-labelledby="review-title">
      <h2 id="review-title">{R.reviewTitle}</h2>
      {top.pointsLost !== null && <p className="review-tip">{R.reviewTip(top.moveNumber)}</p>}
      <ol className="review-list">
        {list.map((m) => {
          const best = bestLine(m)
          const played = R.reviewPlayed(m.played && toGtp(m.played), m.tenuki, m.pointsLost)
          return (
            <li key={m.moveNumber} className="review-item" data-move={m.moveNumber}>
              <div className="review-board">
                <Board board={m.before} region={m.region} markers={reviewMarkers(m)} label={R.reviewBoard(m.moveNumber)} />
              </div>
              <div className="review-text">
                <h3>{R.reviewMove(m.moveNumber)}</h3>
                <p className="review-line">{best ? `${played} ${best}` : played}</p>
                {m.note && <p className="review-note">{m.note}</p>}
              </div>
              {m.practice && (
                <a
                  className="btn review-practise"
                  href={sparHref({
                    family: m.practice.family,
                    pattern: m.practice.patternId,
                    side: report.side,
                    sym: String(m.sym),
                    ...(report.seed === undefined ? {} : { seed: String(report.seed) }),
                    from: String(m.practice.from),
                  })}
                >
                  {R.practise}
                </a>
              )}
            </li>
          )
        })}
      </ol>
    </section>
  )
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

  // An opening (R46) names the side by colour. A family the book no longer has falls back to defend/attack.
  const fam = Object.hasOwn(BOOK.families, report.family) ? BOOK.families[report.family] : undefined
  const seat = fam ? seatColor(fam.def, report.side) : null

  const again = sparHref({
    family: report.family,
    ...(report.mode === 'drill' && report.patternId ? { pattern: report.patternId } : { mode: 'free' }),
    side: report.side,
  })

  return (
    <div className="report">
      <header className="report-head">
        <h1>{headline(report)}</h1>
        <p className="who">{seat ? R.subtitleColor(report.title, seat) : R.subtitle(report.title, report.side)}</p>
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
        {report.practice && <p className="practice-note">{R.practiceRun}</p>}
        {!report.saved && !report.practice && <p className="notice">{COPY.spar.saveFailed}</p>}
        {report.saved && report.mode === 'free' && scheduled && BOOK.patterns[scheduled] && (
          <p>{R.countedFor(BOOK.patterns[scheduled].def.name)}</p>
        )}
        {report.saved && (scheduled ? next && <p>{next}</p> : <p>{R.nothingScheduled}</p>)}

        <MistakesReview report={report} />

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
                    <span className="muted">{dueWho(d.entry.family, d.side)}</span>
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
