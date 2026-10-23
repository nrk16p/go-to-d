// A review box (0-5) as five dots. Mastered boxes turn green.

import { MASTERED_BOX } from '../progress/srs'
import { COPY } from './copy'

export function Pips({ box }: { box: number }) {
  const mastered = box >= MASTERED_BOX
  return (
    <span className={`pips${mastered ? ' mastered' : ''}`} role="img" aria-label={COPY.level(box, mastered)}>
      {[1, 2, 3, 4, 5].map((i) => (
        <i key={i} className={i <= box ? 'on' : undefined} />
      ))}
    </span>
  )
}
