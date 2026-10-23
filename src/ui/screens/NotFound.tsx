// Any address the app doesn't know.

import { COPY } from '../copy'
import { href } from '../router'

export function NotFound() {
  return (
    <section className="screen-msg">
      <h1>{COPY.notFound.title}</h1>
      <p>{COPY.notFound.body}</p>
      <a className="btn" href={href.today}>
        {COPY.spar.backToToday}
      </a>
    </section>
  )
}
