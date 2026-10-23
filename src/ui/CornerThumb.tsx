// A small picture of a pattern's settled shape: the studied corner at the end of the main line, in the
// book's frame. It helps tell apart patterns whose names are long and alike. Decoration only: the name
// next to it says what it is. An opening (R46) shows the whole board instead: the edge, the star points
// and the stones, with no inner lines, which would only blur at this size.

import { isBoardFamily } from '../book/setups'
import type { Board as Grid } from '../go/coords'
import { STAR_POINTS } from './boardGeometry'
import { BOOK } from './shownBook'
import { mainLine, thumbSize } from './mainLine'

const PAD = 0.75

export function CornerThumb({ patternId }: { patternId: string }) {
  const line = mainLine(BOOK, patternId)
  const board = line.steps[line.steps.length - 1].pos.board
  if (isBoardFamily(BOOK.families[BOOK.patterns[patternId].family].def)) return <BoardThumb board={board} />

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

const FULL_PAD = 1

function BoardThumb({ board }: { board: Grid }) {
  const span = 18 + 2 * FULL_PAD
  const stones = []
  for (let y = 0; y < 19; y++) {
    for (let x = 0; x < 19; x++) {
      const c = board[y][x]
      if (c) stones.push(<circle key={`${x},${y}`} className={`stone ${c}`} cx={x} cy={y} r={0.62} />)
    }
  }
  return (
    <svg className="thumb" viewBox={`${-FULL_PAD} ${-FULL_PAD} ${span} ${span}`} aria-hidden="true" focusable="false">
      <rect className="board-surface" x={-FULL_PAD} y={-FULL_PAD} width={span} height={span} rx={0.8} />
      <g className="grid">
        {[0, 18].map((v) => (
          <g key={v}>
            <line className="edge" x1={0} x2={18} y1={v} y2={v} />
            <line className="edge" x1={v} x2={v} y1={0} y2={18} />
          </g>
        ))}
        {STAR_POINTS.map((p) => (
          <circle key={`${p.x},${p.y}`} className="star" cx={p.x} cy={p.y} r={0.3} />
        ))}
      </g>
      <g>{stones}</g>
    </svg>
  )
}
