// @vitest-environment jsdom
// The board: which points it shows and can be tapped, and how a tap turns into a move.

import { cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Board } from '../../src/ui/Board'
import { shownRegion } from '../../src/ui/boardGeometry'
import { BOARD_SIZE, CORNER_REGION, transformRegion, type Pt } from '../../src/go/coords'
import { emptyPosition, play } from '../../src/go/rules'

afterEach(cleanup)

const empty = emptyPosition().board

function hits(container: HTMLElement): Element[] {
  return [...container.querySelectorAll('[data-x][data-y]')]
}

function hitAt(container: HTMLElement, p: Pt): Element {
  const el = container.querySelector(`[data-x="${p.x}"][data-y="${p.y}"]`)
  if (!el) throw new Error(`no hit area at ${p.x},${p.y}`)
  return el
}

function ptsOf(container: HTMLElement): Pt[] {
  return hits(container).map((el) => ({ x: Number(el.getAttribute('data-x')), y: Number(el.getAttribute('data-y')) }))
}

function labels(container: HTMLElement): string[] {
  return [...container.querySelectorAll('[data-label]')].map((el) => el.textContent ?? '')
}

describe('shownRegion', () => {
  it('is the region plus one line of margin, clamped to the board', () => {
    expect(shownRegion(CORNER_REGION)).toEqual({ xMin: 7, xMax: 18, yMin: 0, yMax: 11 })
    expect(shownRegion(undefined)).toEqual({ xMin: 0, xMax: 18, yMin: 0, yMax: 18 })
    expect(shownRegion({ xMin: 0, xMax: 18, yMin: 0, yMax: 18 })).toEqual({ xMin: 0, xMax: 18, yMin: 0, yMax: 18 })
  })
})

describe('Board', () => {
  it('has a hit area on every one of the 361 points on the full board', () => {
    const { container } = render(<Board board={empty} />)
    const pts = ptsOf(container)
    expect(pts).toHaveLength(BOARD_SIZE * BOARD_SIZE)
    expect(new Set(pts.map((p) => `${p.x},${p.y}`)).size).toBe(361)
  })

  it('in corner view, has a hit area on every point of the region and its margin, and nowhere else', () => {
    const { container } = render(<Board board={empty} region={CORNER_REGION} />)
    const pts = ptsOf(container)
    // 11x11 region + 1 line toward the center on two sides = 12x12.
    expect(pts).toHaveLength(12 * 12)
    expect(pts.every((p) => p.x >= 7 && p.x <= 18 && p.y >= 0 && p.y <= 11)).toBe(true)
  })

  it('calls onPlay with the point that was clicked (mouse)', () => {
    const onPlay = vi.fn()
    const { container } = render(<Board board={empty} region={CORNER_REGION} onPlay={onPlay} />)
    fireEvent.click(hitAt(container, { x: 16, y: 2 }))
    expect(onPlay).toHaveBeenCalledTimes(1)
    expect(onPlay).toHaveBeenCalledWith({ x: 16, y: 2 })
  })

  it('ignores clicks when disabled', () => {
    const onPlay = vi.fn()
    const { container } = render(<Board board={empty} onPlay={onPlay} disabled />)
    fireEvent.click(hitAt(container, { x: 3, y: 3 }))
    expect(onPlay).not.toHaveBeenCalled()
  })

  it('under sym 2 shows the lower-left corner, with its coordinate labels', () => {
    const region = transformRegion(CORNER_REGION, 2)
    const { container } = render(<Board board={empty} region={region} />)
    const pts = ptsOf(container)
    expect(pts).toHaveLength(144)
    expect(pts.every((p) => p.x >= 0 && p.x <= 11 && p.y >= 7 && p.y <= 18)).toBe(true)
    expect(pts).toContainEqual({ x: 0, y: 18 }) // A1
    expect(pts).not.toContainEqual({ x: 18, y: 0 }) // T19
    const shown = labels(container)
    expect(shown).toContain('A')
    expect(shown).toContain('1')
    expect(shown).not.toContain('T')
    expect(shown).not.toContain('19')
  })

  it('labels columns with GTP letters (no I) and rows with numbers', () => {
    const { container } = render(<Board board={empty} />)
    const shown = labels(container)
    expect(shown).not.toContain('I')
    for (const l of ['A', 'H', 'J', 'T', '1', '19']) expect(shown).toContain(l)
  })

  it('on touch, the first tap shows a ghost stone and a second tap on it plays', () => {
    const onPlay = vi.fn()
    const { container } = render(<Board board={empty} onPlay={onPlay} toPlay="black" />)
    const target = hitAt(container, { x: 15, y: 3 })
    fireEvent.pointerDown(target, { pointerType: 'touch' })
    fireEvent.click(target)
    expect(onPlay).not.toHaveBeenCalled()
    expect(container.querySelector('[data-ghost]')).not.toBeNull()

    fireEvent.pointerDown(target, { pointerType: 'touch' })
    fireEvent.click(target)
    expect(onPlay).toHaveBeenCalledTimes(1)
    expect(onPlay).toHaveBeenCalledWith({ x: 15, y: 3 })
  })

  it('on touch, a tap on another point moves the ghost instead of playing', () => {
    const onPlay = vi.fn()
    const onPreview = vi.fn()
    const { container } = render(<Board board={empty} onPlay={onPlay} onPreview={onPreview} />)
    fireEvent.pointerDown(hitAt(container, { x: 15, y: 3 }), { pointerType: 'touch' })
    fireEvent.click(hitAt(container, { x: 15, y: 3 }))
    fireEvent.pointerDown(hitAt(container, { x: 16, y: 3 }), { pointerType: 'touch' })
    fireEvent.click(hitAt(container, { x: 16, y: 3 }))
    expect(onPlay).not.toHaveBeenCalled()
    expect(onPreview).toHaveBeenLastCalledWith({ x: 16, y: 3 })
    const ghost = container.querySelector('[data-ghost]')
    expect(ghost?.getAttribute('data-ghost')).toBe('16,3')
  })

  it('drops the ghost when the position changes', () => {
    const onPlay = vi.fn()
    const pos = emptyPosition()
    const { container, rerender } = render(<Board board={pos.board} onPlay={onPlay} />)
    fireEvent.pointerDown(hitAt(container, { x: 15, y: 3 }), { pointerType: 'touch' })
    fireEvent.click(hitAt(container, { x: 15, y: 3 }))
    expect(container.querySelector('[data-ghost]')).not.toBeNull()
    const r = play(pos, { x: 3, y: 3 }, 'black')
    if ('illegal' in r) throw new Error('illegal')
    rerender(<Board board={r.pos.board} onPlay={onPlay} />)
    expect(container.querySelector('[data-ghost]')).toBeNull()
  })

  it('draws stones and marks the last move', () => {
    const pos = emptyPosition()
    const a = play(pos, { x: 15, y: 3 }, 'black')
    if ('illegal' in a) throw new Error('illegal')
    const { container } = render(<Board board={a.pos.board} region={CORNER_REGION} lastMove={{ x: 15, y: 3 }} />)
    expect(container.querySelectorAll('[data-stone="black"]')).toHaveLength(1)
    expect(container.querySelector('[data-last="15,3"]')).not.toBeNull()
  })

  it('draws the better move and the mistake; the cross replaces the last-move dot', () => {
    const pos = emptyPosition()
    const a = play(pos, { x: 15, y: 3 }, 'black')
    if ('illegal' in a) throw new Error('illegal')
    const { container } = render(
      <Board
        board={a.pos.board}
        region={CORNER_REGION}
        lastMove={{ x: 15, y: 3 }}
        markers={[
          { pt: { x: 15, y: 3 }, kind: 'mistake' },
          { pt: { x: 16, y: 2 }, kind: 'better' },
          { pt: { x: 14, y: 2 }, kind: 'hint' },
        ]}
      />,
    )
    expect(container.querySelector('[data-marker="better"][data-at="16,2"]')).not.toBeNull()
    expect(container.querySelector('[data-marker="mistake"][data-at="15,3"]')).not.toBeNull()
    expect(container.querySelector('[data-marker="hint"][data-at="14,2"]')).not.toBeNull()
    expect(container.querySelector('[data-last]')).toBeNull()
  })

  it('skips markers outside the shown area', () => {
    const { container } = render(
      <Board board={empty} region={CORNER_REGION} markers={[{ pt: { x: 0, y: 18 }, kind: 'better' }]} />,
    )
    expect(container.querySelector('[data-marker]')).toBeNull()
  })
})
