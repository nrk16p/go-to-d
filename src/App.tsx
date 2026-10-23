// The app shell: the top bar with the main links, and whichever screen the hash names.

import { useEffect } from 'react'
import { COPY } from './ui/copy'
import type { EngineHub } from './ui/engine'
import { LangSwitch } from './ui/LangSwitch'
import { href, parseRoute, useHash, wantsWatch, type Route } from './ui/router'
import { Library } from './ui/screens/Library'
import { NotFound } from './ui/screens/NotFound'
import { Pattern } from './ui/screens/Pattern'
import { Report } from './ui/screens/Report'
import { Settings } from './ui/screens/Settings'
import { Spar } from './ui/screens/Spar'
import { Today } from './ui/screens/Today'
import { Watch } from './ui/screens/Watch'

function Screen({ route, hash, engine }: { route: Route; hash: string; engine: EngineHub }) {
  switch (route.name) {
    case 'today':
      return <Today />
    case 'spar':
      // A new address is a new session. phase=watch plays the line through first (R45).
      if (wantsWatch(route.params)) return <Watch key={hash} params={route.params} />
      return <Spar key={hash} params={route.params} engine={engine} />
    case 'report':
      return <Report key={hash} />
    case 'library':
      return <Library />
    case 'pattern':
      return <Pattern id={route.id} />
    case 'settings':
      return <Settings engine={engine} />
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
        <div className="shell-end">
          <nav aria-label={COPY.nav.label}>
            {NAV.map((n) => (
              <a key={n.name} href={n.to} aria-current={section === n.name ? 'page' : undefined}>
                {n.label}
              </a>
            ))}
          </nav>
          <LangSwitch />
        </div>
      </header>
      <main className="screen">
        <Screen route={route} hash={hash} engine={engine} />
      </main>
    </div>
  )
}
