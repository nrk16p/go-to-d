// A small picture of a pattern's settled shape: the studied corner at the end of the main line, in the
// book's frame. It helps tell apart patterns whose names are long and alike. Decoration only: the name
// next to it says what it is.

import { BOOK } from './shownBook'
import { mainLine, thumbSize } from './mainLine'

const PAD = 0.75

export function CornerThumb({ patternId }: { patternId: string }) {
  const line = mainLine(BOOK, patternId)
  const board = line.steps[line.steps.length - 1].pos.board
  const n = thumbSize(line.steps[line.steps.length - 1].pos)
  const xMin = 19 - n
  const last = n - 1
  const span = last + 2 * PAD

  const stones = []
  for (let y = 0; y < n; y++) {
    for (let x = xMin; x <= 18; x++) {
      const c = board[y][x]
      if (c) stones.push(<circle key={`${x},${y}`} className={`stone ${c}`} cx={x - xMin} cy={y} r={0.47} />)
    }
  }

  return (
    <svg className="thumb" viewBox={`${-PAD} ${-PAD} ${span} ${span}`} aria-hidden="true" focusable="false">
      <rect className="board-surface" x={-PAD} y={-PAD} width={span} height={span} rx={0.5} />
      <g className="grid">
        {Array.from({ length: n }, (_, i) => (
          <line key={`h${i}`} className={i === 0 ? 'edge' : undefined} x1={-PAD} x2={last} y1={i} y2={i} />
        ))}
        {Array.from({ length: n }, (_, i) => (
          <line key={`v${i}`} className={i === last ? 'edge' : undefined} x1={i} x2={i} y1={0} y2={last + PAD} />
        ))}
        {/* The 4-4 point (Q16); thumbSize never shows fewer than 6 lines, so it is always in view. */}
        <circle className="star" cx={15 - xMin} cy={3} r={0.12} />
      </g>
      <g>{stones}</g>
    </svg>
  )
}
