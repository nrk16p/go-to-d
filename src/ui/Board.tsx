// The Go board, drawn in SVG. It shows the session's corner (with one line of margin) or the whole
// board, and turns taps into moves: a mouse click plays at once; on touch, the first tap puts a ghost
// stone down and a second tap on it plays, because a finger covers more than one point.
//
// The ghost goes away whenever `board` changes, even back to a position shown before (Retry restores
// the very same object). A parent that confirms the ghost itself (a "Play O17" button) passes
// `ghost` and `onGhost` and owns it.

import { useId, useRef, useState, type KeyboardEvent, type MouseEvent, type PointerEvent } from 'react'
import { inRegion, toGtp, type Board as Grid, type Color, type Pt, type Region } from '../go/coords'
import { columnLabel, layoutFor, PEN_CROSS, PEN_LOOP, rowLabel, shownRegion, STAR_POINTS } from './boardGeometry'
import { COPY } from './copy'

export type MarkerKind = 'better' | 'mistake' | 'hint'

export interface BoardMarker {
  pt: Pt
  kind: MarkerKind
}

export interface BoardProps {
  board: Grid
  /** The session's corner. Without it the whole board shows. */
  region?: Region
  lastMove?: Pt
  markers?: BoardMarker[]
  onPlay?: (p: Pt) => void
  disabled?: boolean
  /** The colour a tap would play, for the ghost stone. */
  toPlay?: Color
  /**
   * Controlled ghost: the point a touch tap has picked, and the setter the board calls (null when it
   * plays or drops the ghost). Without `onGhost` the board keeps the ghost itself.
   */
  ghost?: Pt | null
  onGhost?: (p: Pt | null) => void
  /** What a screen reader hears for the board. */
  label?: string
}

const same = (a: Pt | null | undefined, b: Pt | null | undefined) => !!a && !!b && a.x === b.x && a.y === b.y
const keyOf = (p: Pt) => `${p.x},${p.y}`

const ARROWS: Record<string, [number, number]> = {
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
}

export function Board(props: BoardProps) {
  const { board, region, lastMove, markers = [], onPlay, disabled = false, toPlay, label } = props
  const view = shownRegion(region)
  const L = layoutFor(view)
  const playable = !!onPlay && !disabled
  const pointer = useRef('mouse')
  const [ownGhost, setOwnGhost] = useState<Pt | null>(null)
  // Any new `board`, even one seen before, drops the board's own ghost (set during render, no effect).
  const [ghostBoard, setGhostBoard] = useState(board)
  if (ghostBoard !== board) {
    setGhostBoard(board)
    setOwnGhost(null)
  }
  const controlled = props.onGhost !== undefined
  const ghost = controlled ? (props.ghost ?? null) : ownGhost
  const setGhost = (p: Pt | null) => (controlled ? props.onGhost!(p) : setOwnGhost(p))
  const [cursor, setCursor] = useState<Pt | null>(null)
  const hintId = useId()

  const sx = (x: number) => x - view.xMin
  const sy = (y: number) => y - view.yMin
  const shownGhost = playable && ghost && inRegion(ghost, view) && board[ghost.y][ghost.x] === null ? ghost : null
  const cur = cursor && inRegion(cursor, view) ? cursor : (lastMove && inRegion(lastMove, view) ? lastMove : centre(view))

  function tap(p: Pt, touch: boolean) {
    if (!playable) return
    if (!touch || board[p.y][p.x] !== null) {
      // A stone already there gets the session's own "occupied" message, not a ghost.
      setGhost(null)
      onPlay!(p)
      return
    }
    if (same(shownGhost, p)) {
      setGhost(null)
      onPlay!(p)
    } else {
      setGhost(p)
    }
  }

  function onPointerDown(e: PointerEvent<SVGSVGElement>) {
    pointer.current = e.pointerType || 'mouse'
  }

  function onClick(e: MouseEvent<SVGSVGElement>) {
    const hit = (e.target as Element).closest('[data-x][data-y]')
    const touch = pointer.current === 'touch' || pointer.current === 'pen'
    pointer.current = 'mouse'
    if (!hit || !playable) return
    const p = { x: Number(hit.getAttribute('data-x')), y: Number(hit.getAttribute('data-y')) }
    setCursor(p)
    tap(p, touch)
  }

  function onKeyDown(e: KeyboardEvent<SVGSVGElement>) {
    // The board keeps focus while the teacher thinks, so keys are ignored rather than the focus lost.
    if (!playable) return
    const d = ARROWS[e.key]
    if (d) {
      e.preventDefault()
      setCursor({
        x: Math.min(view.xMax, Math.max(view.xMin, cur.x + d[0])),
        y: Math.min(view.yMax, Math.max(view.yMin, cur.y + d[1])),
      })
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      tap(cur, false)
    }
  }

  const points: Pt[] = []
  for (let y = view.yMin; y <= view.yMax; y++) for (let x = view.xMin; x <= view.xMax; x++) points.push({ x, y })
  const shownMarkers = markers.filter((m) => inRegion(m.pt, view))
  const crossed = new Set(shownMarkers.filter((m) => m.kind === 'mistake').map((m) => keyOf(m.pt)))

  // Lines run past the outer points where the board goes on, and stop at the real edges.
  const run = 0.45
  const x0 = view.xMin === 0 ? 0 : -run
  const x1 = L.cols - 1 + (view.xMax === 18 ? 0 : run)
  const y0 = view.yMin === 0 ? 0 : -run
  const y1 = L.rows - 1 + (view.yMax === 18 ? 0 : run)

  return (
    <svg
      className={`board${playable ? ' playable' : ''}`}
      viewBox={`${L.box.x} ${L.box.y} ${L.box.w} ${L.box.h}`}
      role={onPlay ? 'application' : 'img'}
      aria-label={label ?? COPY.board.label}
      aria-describedby={onPlay ? hintId : undefined}
      aria-disabled={onPlay ? disabled : undefined}
      tabIndex={onPlay ? 0 : undefined}
      onPointerDown={onPointerDown}
      onClick={onClick}
      onKeyDown={onPlay ? onKeyDown : undefined}
    >
      {onPlay && (
        <desc id={hintId}>
          {COPY.board.keys} {COPY.board.point(toGtp(cur))}
        </desc>
      )}
      <rect className="board-surface" x={-L.pad} y={-L.pad} width={L.cols - 1 + 2 * L.pad} height={L.rows - 1 + 2 * L.pad} rx={0.12} />

      <g className="grid" aria-hidden="true">
        {Array.from({ length: L.rows }, (_, r) => (
          <line key={`r${r}`} className={edgeY(view.yMin + r) ? 'edge' : undefined} x1={x0} x2={x1} y1={r} y2={r} />
        ))}
        {Array.from({ length: L.cols }, (_, c) => (
          <line key={`c${c}`} className={edgeX(view.xMin + c) ? 'edge' : undefined} x1={c} x2={c} y1={y0} y2={y1} />
        ))}
        {STAR_POINTS.filter((p) => inRegion(p, view)).map((p) => (
          <circle key={keyOf(p)} className="star" cx={sx(p.x)} cy={sy(p.y)} r={0.1} />
        ))}
      </g>

      <g className="labels" aria-hidden="true" style={{ fontSize: L.label }}>
        {Array.from({ length: L.rows }, (_, r) => (
          <text key={`n${r}`} data-label x={L.numbersX} y={r}>
            {rowLabel(view.yMin + r)}
          </text>
        ))}
        {Array.from({ length: L.cols }, (_, c) => (
          <text key={`l${c}`} data-label x={c} y={L.lettersY}>
            {columnLabel(view.xMin + c)}
          </text>
        ))}
      </g>

      <g className="stones" aria-hidden="true">
        {points.map((p) => {
          const c = board[p.y][p.x]
          return c ? <circle key={keyOf(p)} data-stone={c} className={`stone ${c}`} cx={sx(p.x)} cy={sy(p.y)} r={0.47} /> : null
        })}
      </g>

      {lastMove && inRegion(lastMove, view) && board[lastMove.y][lastMove.x] && !crossed.has(keyOf(lastMove)) && (
        <circle
          data-last={keyOf(lastMove)}
          className={`last on-${board[lastMove.y][lastMove.x]}`}
          cx={sx(lastMove.x)}
          cy={sy(lastMove.y)}
          r={0.15}
          aria-hidden="true"
        />
      )}

      {shownGhost && (
        <circle
          data-ghost={keyOf(shownGhost)}
          className={`ghost ${toPlay ?? 'neutral'}`}
          cx={sx(shownGhost.x)}
          cy={sy(shownGhost.y)}
          r={0.47}
          aria-hidden="true"
        />
      )}

      <g className="markers" aria-hidden="true">
        {shownMarkers.map((m) => (
          <Marker key={`${m.kind}${keyOf(m.pt)}`} m={m} at={[sx(m.pt.x), sy(m.pt.y)]} stone={board[m.pt.y][m.pt.x]} />
        ))}
      </g>

      <g className="hits">
        {points.map((p) => {
          const empty = board[p.y][p.x] === null
          return (
            <g key={keyOf(p)} className="hit" data-x={p.x} data-y={p.y}>
              <rect x={sx(p.x) - 0.5} y={sy(p.y) - 0.5} width={1} height={1} />
              {empty && toPlay && <circle className={`hover ${toPlay}`} cx={sx(p.x)} cy={sy(p.y)} r={0.47} />}
            </g>
          )
        })}
      </g>

      {onPlay && (
        <rect className="cursor" x={sx(cur.x) - 0.5} y={sy(cur.y) - 0.5} width={1} height={1} rx={0.15} aria-hidden="true" />
      )}
    </svg>
  )
}

function Marker({ m, at, stone }: { m: BoardMarker; at: [number, number]; stone: Color | null }) {
  const props = { 'data-marker': m.kind, 'data-at': keyOf(m.pt), transform: `translate(${at[0]} ${at[1]})` }
  // The pen gets an edge (the halo) in a colour that sets it off from what it is drawn on; the theme
  // decides which edges show (theme.css --halo-*).
  if (m.kind === 'better') {
    return (
      <g {...props}>
        <path className="pen-halo on-board drawn" d={PEN_LOOP} pathLength={1} />
        <path className="pen drawn" d={PEN_LOOP} pathLength={1} />
      </g>
    )
  }
  if (m.kind === 'mistake') {
    return (
      <g {...props}>
        <path className={`pen-halo on-${stone ?? 'board'} drawn`} d={PEN_CROSS} pathLength={1} />
        <path className="pen drawn" d={PEN_CROSS} pathLength={1} />
      </g>
    )
  }
  return (
    <g {...props}>
      <circle className="hint" r={0.55} />
    </g>
  )
}

function centre(v: Region): Pt {
  return { x: Math.floor((v.xMin + v.xMax) / 2), y: Math.floor((v.yMin + v.yMax) / 2) }
}

const edgeX = (x: number) => x === 0 || x === 18
const edgeY = (y: number) => y === 0 || y === 18
