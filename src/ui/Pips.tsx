// A review box (0-5) as five dots. Four and up is mastered and turns green.

import { COPY } from './copy'

export function Pips({ box }: { box: number }) {
  return (
    <span className={`pips${box >= 4 ? ' mastered' : ''}`} role="img" aria-label={COPY.level(box)}>
      {[1, 2, 3, 4, 5].map((i) => (
        <i key={i} className={i <= box ? 'on' : undefined} />
      ))}
    </span>
  )
}
