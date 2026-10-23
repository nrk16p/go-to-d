// The home screen: what to play today, in order. Reviews that are due come first, then the next new
// patterns in course order (R32), and the very first item carries the Play button so the next step is
// never in doubt. Below: the streak, how much is mastered, and free sparring ("Teacher's choice").

import { useState } from 'react'
import { BOOK } from '../../book/data'
import type { FamilyId } from '../../book/types'
import { currentStreak, dueItems, masteredCount, newItems, type CourseItem } from '../../progress/course'
import { loadProgress, saveProgress, todayLocal } from '../../progress/store'
import type { Side } from '../../session/sides'
import { CornerThumb } from '../CornerThumb'
import { COPY } from '../copy'
import { isInAppBrowser, needsIosInstallHint } from '../install'
import { Pips } from '../Pips'
import { href, sparHref } from '../router'

const T = COPY.today

export function Today({ today = todayLocal() }: { today?: string }) {
  const [progress] = useState(loadProgress)
  const [hint, setHint] = useState(() => needsIosInstallHint(progress.settings.iosHintDismissed))
  const [inApp] = useState(isInAppBrowser)
  // The Home Screen app has storage of its own, so progress made here has to be carried over by hand.
  const hasProgress = Object.keys(progress.reviews).length > 0
  const [freeSide, setFreeSide] = useState<Side>('defend')

  const due = dueItems(BOOK, progress, today)
  const fresh = newItems(BOOK, progress, progress.settings.newPerDay)
  const { mastered, total } = masteredCount(BOOK, progress)
  const first = due[0]?.key ?? fresh[0]?.key

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
        <p className="lead">{T.lead(due.length, fresh.length)}</p>
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
            <p className="muted">{T.allStarted}</p>
          ) : (
            <ul className="queue-list">
              {fresh.map((item) => (
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
          {(Object.keys(BOOK.families) as FamilyId[]).map((family) => (
            <li key={family}>
              <a href={sparHref({ family, side: freeSide, mode: 'free' })}>{BOOK.families[family].def.name}</a>
            </li>
          ))}
        </ul>
      </section>
    </section>
  )
}

function QueueItem({ item, next, box }: { item: CourseItem; next: boolean; box?: number }) {
  const entry = BOOK.patterns[item.patternId]
  return (
    <li>
      <a
        className={`queue-item${next ? ' is-next' : ''}`}
        href={sparHref({ family: item.family, pattern: item.patternId, side: item.side })}
      >
        <CornerThumb patternId={item.patternId} />
        <span className="queue-text">
          <span className="queue-name">{entry.def.name}</span>
          <span className="queue-meta">
            {COPY.sideName(item.side)}
            {box !== undefined && <Pips box={box} />}
          </span>
        </span>
        {next && <span className="queue-play">{T.play}</span>}
      </a>
    </li>
  )
}
