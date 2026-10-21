// The app shell: the top bar with the main links, and whichever screen the hash names.
// Task 8 swaps the placeholders for the real Today, Library, Pattern and Settings screens.

import { useEffect } from 'react'
import { COPY } from './ui/copy'
import type { EngineHub } from './ui/engine'
import { href, parseRoute, useHash, type Route } from './ui/router'
import { LibraryPlaceholder, NotFound, PatternPlaceholder, SettingsPlaceholder, TodayPlaceholder } from './ui/screens/Placeholders'
import { Report } from './ui/screens/Report'
import { Spar } from './ui/screens/Spar'

function Screen({ route, hash, engine }: { route: Route; hash: string; engine: EngineHub }) {
  switch (route.name) {
    case 'today':
      return <TodayPlaceholder />
    case 'spar':
      // A new address is a new session.
      return <Spar key={hash} params={route.params} engine={engine} />
    case 'report':
      return <Report key={hash} />
    case 'library':
      return <LibraryPlaceholder />
    case 'pattern':
      return <PatternPlaceholder id={route.id} />
    case 'settings':
      return <SettingsPlaceholder />
    case 'not-found':
      return <NotFound />
  }
}

const NAV = [
  { name: 'today', to: href.today, label: COPY.nav.today },
  { name: 'library', to: href.library, label: COPY.nav.library },
  { name: 'settings', to: href.settings, label: COPY.nav.settings },
] as const

export default function App({ engine }: { engine: EngineHub }) {
  const hash = useHash()
  const route = parseRoute(hash)

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [hash])

  const section = route.name === 'pattern' ? 'library' : route.name
  return (
    <div className="app">
      <header className="shell">
        <a className="wordmark" href={href.today}>
          {COPY.appName}
        </a>
        <nav aria-label={COPY.nav.label}>
          {NAV.map((n) => (
            <a key={n.name} href={n.to} aria-current={section === n.name ? 'page' : undefined}>
              {n.label}
            </a>
          ))}
        </nav>
      </header>
      <main className="screen">
        <Screen route={route} hash={hash} engine={engine} />
      </main>
    </div>
  )
}
