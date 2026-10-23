// A screen that throws while drawing (a stale saved report after an update, say) shows what happened and
// a way back, instead of blanking the whole app (M3). App keys it by the address, so moving on clears it.

import { Component, type ReactNode } from 'react'
import { COPY } from './copy'
import { href } from './router'

export class ScreenBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true }
  }

  componentDidCatch(err: unknown): void {
    console.error('[app] a screen failed', err)
  }

  render(): ReactNode {
    if (!this.state.failed) return this.props.children
    return (
      <section className="screen-msg" role="alert">
        <h1>{COPY.broken.title}</h1>
        <p>{COPY.broken.body}</p>
        <a className="btn btn-primary" href={href.today}>
          {COPY.spar.backToToday}
        </a>
      </section>
    )
  }
}
