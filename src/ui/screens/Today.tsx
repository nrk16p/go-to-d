// The home screen: what to play today, in order. Reviews that are due come first, then the day's new
// patterns in course order (R32): newPerDay less the ones already started today (R44), so the list runs
// out and the day is done. One more stays a tap away. Then the day's new opening (R46), counted the same
// way on its own (newOpeningsPerDay). The very first item carries the Play button so the next step is
// never in doubt. Below: the streak, how much is mastered, and free sparring ("Teacher's choice").

import { useState } from 'react'
import { BOOK } from '../shownBook'
import { isBoardFamily } from '../../book/setups'
import type { FamilyId } from '../../book/types'
import {
  currentStreak,
  dueItems,
  masteredCount,
  newItems,
  newOpeningsToday,
  newToday,
  openingOrder,
  type CourseItem,
} from '../../progress/course'
import { loadProgress, saveProgress, todayLocal } from '../../progress/store'
import { familySides, ownerColor, type Side } from '../../session/sides'
import { CornerThumb } from '../CornerThumb'
import { COPY } from '../copy'
import { isInAppBrowser, needsIosInstallHint } from '../install'
import { Pips } from '../Pips'
import { href, phaseHref, sparHref } from '../router'
import { sideLabel } from '../seat'

const T = COPY.today

const FAMILIES = Object.keys(BOOK.families) as FamilyId[]
const CORNERS = FAMILIES.filter((f) => !isBoardFamily(BOOK.families[f].def))
const OPENINGS = FAMILIES.filter((f) => isBoardFamily(BOOK.families[f].def))
const HAS_OPENINGS = openingOrder(BOOK).length > 0

export function Today({ today = todayLocal() }: { today?: string }) {
  const [progress] = useState(loadProgress)
  const [hint, setHint] = useState(() => needsIosInstallHint(progress.settings.iosHintDismissed))
  const [inApp] = useState(isInAppBrowser)
  // The Home Screen app has storage of its own, so progress made here has to be carried over by hand.
  const hasProgress = Object.keys(progress.reviews).length > 0
  const [freeSide, setFreeSide] = useState<Side>('defend')

  const due = dueItems(BOOK, progress, today)
  const fresh = newToday(BOOK, progress, today)
  // Today's share is done: the next new one, for "Learn one more".
  const more = fresh.length === 0 ? newItems(BOOK, progress, 1)[0] : undefined
  const openings = newOpeningsToday(BOOK, progress, today)
  const moreOpening = openings.length === 0 ? newItems(BOOK, progress, 1, 'openings')[0] : undefined
  const { mastered, total } = masteredCount(BOOK, progress)
  const first = due[0]?.key ?? fresh[0]?.key ?? openings[0]?.key

  function dismissHint() {
    setHint(false)
    // Read again first, so a session saved in another tab since this screen opened isn't lost.
    const p = loadProgress()
    saveProgress({ ...p, settings: { ...p.settings, iosHintDismissed: true } })
  }

  return (
    <section className="page today">
      <header className="page-head">
        <h1>{T.title}</h1>
        <p className="lead">{T.lead(due.length, fresh.length, openings.length)}</p>
      </header>

      {hint && (
        <aside className="install-hint" aria-labelledby="install-title">
          <h2 id="install-title">{T.iosHintTitle}</h2>
          <p>{inApp ? T.iosHintInApp : T.iosHintBody}</p>
          {hasProgress && <p>{T.iosHintMove}</p>}
          <div className="actions">
            {hasProgress && (
              <a className="btn" href={href.settings}>
                {T.iosHintExport}
              </a>
            )}
            <button type="button" className={hasProgress ? 'btn btn-quiet' : 'btn'} onClick={dismissHint}>
              {T.iosHintDismiss}
            </button>
          </div>
        </aside>
      )}

      <dl className="stats stats-small">
        <div>
          <dt>{T.streak}</dt>
          <dd>{currentStreak(progress, today)}</dd>
        </div>
        <div>
          <dt>{T.mastered}</dt>
          <dd>{T.masteredValue(mastered, total)}</dd>
        </div>
      </dl>

      {due.length > 0 && (
        <section className="queue" aria-labelledby="due-title">
          <h2 id="due-title">{T.dueTitle}</h2>
          <ul className="queue-list">
            {due.map((item) => (
              <QueueItem key={item.key} item={item} next={item.key === first} box={progress.reviews[item.key].box} />
            ))}
          </ul>
        </section>
      )}

      {(fresh.length > 0 || progress.settings.newPerDay > 0) && (
        <section className="queue" aria-labelledby="new-title">
          <h2 id="new-title">{T.newTitle}</h2>
          {fresh.length === 0 ? (
            more ? (
              <p className="muted">
                {T.doneNew}{' '}
                {/* A new one too, so it is watched first (R45). */}
                <a href={phaseHref({ family: more.family, pattern: more.patternId, side: more.side }, 'watch')}>{T.learnOneMore}</a>
              </p>
            ) : (
              <p className="muted">{T.allStarted}</p>
            )
          ) : (
            <ul className="queue-list">
              {fresh.map((item) => (
                <QueueItem key={item.key} item={item} next={item.key === first} />
              ))}
            </ul>
          )}
        </section>
      )}

      {HAS_OPENINGS && (openings.length > 0 || progress.settings.newOpeningsPerDay > 0) && (
        <section className="queue" aria-labelledby="openings-title">
          <h2 id="openings-title">{T.openingsTitle}</h2>
          {openings.length === 0 ? (
            moreOpening ? (
              <p className="muted">
                {T.doneOpenings}{' '}
                {/* A new one, so it is watched first (R45). */}
                <a href={phaseHref({ family: moreOpening.family, pattern: moreOpening.patternId, side: moreOpening.side }, 'watch')}>
                  {T.learnOneMore}
                </a>
              </p>
            ) : (
              <p className="muted">{T.allOpeningsStarted}</p>
            )
          ) : (
            <ul className="queue-list">
              {openings.map((item) => (
                <QueueItem key={item.key} item={item} next={item.key === first} />
              ))}
            </ul>
          )}
        </section>
      )}

      <section className="free" aria-labelledby="free-title">
        <h2 id="free-title">{T.freeTitle}</h2>
        <p className="muted">{T.freeBody}</p>
        <div className="segmented" role="radiogroup" aria-label={T.sideGroup}>
          {(['defend', 'attack'] as const).map((side) => (
            <label key={side}>
              <input
                type="radio"
                name="free-side"
                value={side}
                checked={freeSide === side}
                onChange={() => setFreeSide(side)}
              />
              <span>{side === 'defend' ? T.sideDefend : T.sideAttack}</span>
            </label>
          ))}
        </div>
        <ul className="link-list">
          {CORNERS.map((family) => (
            <li key={family}>
              <a href={sparHref({ family, side: freeSide, mode: 'free' })}>{BOOK.families[family].def.name}</a>
            </li>
          ))}
        </ul>
        {OPENINGS.length > 0 && (
          <>
            <h3 id="free-openings">{T.freeOpenings}</h3>
            {/* An opening names its side by colour; the 4-stone one is Black's only (R46). */}
            <ul className="link-list" aria-labelledby="free-openings">
              {OPENINGS.flatMap((family) => {
                const def = BOOK.families[family].def
                return familySides(def).map((side) => (
                  <li key={`${family}:${side}`}>
                    <a href={sparHref({ family, side, mode: 'free' })}>{T.freeOpening(def.name, ownerColor(def, side))}</a>
                  </li>
                ))
              })}
            </ul>
          </>
        )}
      </section>
    </section>
  )
}

function QueueItem({ item, next, box }: { item: CourseItem; next: boolean; box?: number }) {
  const entry = BOOK.patterns[item.patternId]
  // A new pattern (no review box yet) is watched once, then tested; a review goes straight to the test (R45).
  const drill = { family: item.family, pattern: item.patternId, side: item.side }
  return (
    <li>
      <a className={`queue-item${next ? ' is-next' : ''}`} href={phaseHref(drill, box === undefined ? 'watch' : 'test')}>
        <CornerThumb patternId={item.patternId} />
        <span className="queue-text">
          <span className="queue-name">{entry.def.name}</span>
          <span className="queue-meta">
            {sideLabel(BOOK.families[item.family].def, item.side)}
            {box !== undefined && <Pips box={box} />}
          </span>
        </span>
        {next && <span className="queue-play">{T.play}</span>}
      </a>
    </li>
  )
}
