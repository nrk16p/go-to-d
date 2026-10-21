import { describe, expect, it } from 'vitest'
import { parseGtp, type Move, type Pt } from '../../src/go/coords'
import { emptyPosition, otherColor, placeSetup, play, type Position } from '../../src/go/rules'

const B = 'black' as const
const W = 'white' as const

function stones(color: 'black' | 'white', pts: Array<[number, number]>): Move[] {
  return pts.map(([x, y]) => ({ x, y, player: color }))
}

function key(p: Pt): string {
  return `${p.x},${p.y}`
}

function sortedKeys(pts: Pt[]): string[] {
  return pts.map(key).sort()
}

/** Plays a move that must be legal and returns the new position plus captures. */
function ok(pos: Position, x: number, y: number, color: 'black' | 'white') {
  const r = play(pos, { x, y }, color)
  if ('illegal' in r) throw new Error(`expected legal move at ${x},${y}, got ${r.illegal}`)
  return r
}

describe('emptyPosition / placeSetup', () => {
  it('starts with an empty 19x19 board, Black to move', () => {
    const pos = emptyPosition()
    expect(pos.board).toHaveLength(19)
    for (const row of pos.board) {
      expect(row).toHaveLength(19)
      expect(row.every((c) => c === null)).toBe(true)
    }
    expect(pos.toMove).toBe(B)
    expect(pos.ko).toBeNull()
    expect(pos.history).toEqual([])
    expect(pos.boards).toEqual([])
  })

  it('creates independent boards each call', () => {
    const a = emptyPosition()
    const b = emptyPosition()
    expect(a.board).not.toBe(b.board)
    expect(a.board[0]).not.toBe(b.board[0])
  })

  it('places stones as board[y][x] and sets who moves next', () => {
    const q16 = parseGtp('Q16')
    const pos = placeSetup(emptyPosition(), [{ ...q16, player: B }, { x: 3, y: 15, player: W }], W)
    expect(pos.board[q16.y][q16.x]).toBe(B)
    expect(pos.board[15][3]).toBe(W)
    expect(pos.toMove).toBe(W)
    expect(pos.ko).toBeNull()
    expect(pos.history).toEqual([])
  })

  it('does not change the position it was given', () => {
    const start = emptyPosition()
    placeSetup(start, stones(B, [[3, 3]]), W)
    expect(start.board[3][3]).toBeNull()
    expect(start.toMove).toBe(B)
  })

  it('rejects stones that are off the board or on top of each other', () => {
    expect(() => placeSetup(emptyPosition(), stones(B, [[19, 0]]), W)).toThrow()
    expect(() => placeSetup(emptyPosition(), [...stones(B, [[3, 3]]), ...stones(W, [[3, 3]])], B)).toThrow()
  })
})

describe('otherColor', () => {
  it('flips the colour', () => {
    expect(otherColor(B)).toBe(W)
    expect(otherColor(W)).toBe(B)
  })
})

describe('play: basics', () => {
  it('places a stone, flips the turn and records history and the previous board', () => {
    const start = emptyPosition()
    const { pos, captured } = ok(start, 15, 3, B)
    expect(captured).toEqual([])
    expect(pos.board[3][15]).toBe(B)
    expect(pos.toMove).toBe(W)
    expect(pos.ko).toBeNull()
    expect(pos.history).toEqual([{ x: 15, y: 3, player: B }])
    expect(pos.boards).toHaveLength(1)
    expect(pos.boards[0]).toEqual(start.board)
    // the old position is untouched
    expect(start.board[3][15]).toBeNull()
    expect(start.history).toEqual([])
    expect(start.boards).toEqual([])
  })

  it('keeps previous boards newest last, capped at 8', () => {
    let pos = emptyPosition()
    for (let i = 0; i < 12; i++) {
      pos = ok(pos, i, 0, i % 2 === 0 ? B : W).pos
    }
    expect(pos.history).toHaveLength(12)
    expect(pos.boards).toHaveLength(8)
    // newest last: the final entry is the board before the 12th move (11 stones)
    const stonesOn = (b: Position['board']) => b.flat().filter((c) => c !== null).length
    expect(pos.boards.map(stonesOn)).toEqual([4, 5, 6, 7, 8, 9, 10, 11])
    expect(stonesOn(pos.board)).toBe(12)
  })

  it('occupied point is illegal', () => {
    const pos = placeSetup(emptyPosition(), stones(B, [[5, 5]]), W)
    expect(play(pos, { x: 5, y: 5 }, W)).toEqual({ illegal: 'occupied' })
    expect(play(pos, { x: 5, y: 5 }, B)).toEqual({ illegal: 'occupied' })
  })

  it('throws for a point off the board', () => {
    expect(() => play(emptyPosition(), { x: 19, y: 0 }, B)).toThrow()
    expect(() => play(emptyPosition(), { x: 0, y: -1 }, B)).toThrow()
  })
})

describe('play: captures', () => {
  it('captures a single stone and removes it from the board', () => {
    // W at (5,5) with black on three sides, black plays the fourth
    const pos = placeSetup(
      emptyPosition(),
      [...stones(W, [[5, 5]]), ...stones(B, [[4, 5], [6, 5], [5, 4]])],
      B,
    )
    const { pos: after, captured } = ok(pos, 5, 6, B)
    expect(captured).toEqual([{ x: 5, y: 5 }])
    expect(after.board[5][5]).toBeNull()
    expect(after.board[6][5]).toBe(B)
    expect(after.toMove).toBe(W)
    // a capture of one stone by a stone that is not in atari afterwards is not a ko
    expect(after.ko).toBeNull()
  })

  it('captures a group of three', () => {
    const pos = placeSetup(
      emptyPosition(),
      [
        ...stones(W, [[5, 5], [6, 5], [7, 5]]),
        ...stones(B, [[4, 5], [8, 5], [5, 4], [6, 4], [7, 4], [5, 6], [6, 6]]),
      ],
      B,
    )
    const { pos: after, captured } = ok(pos, 7, 6, B)
    expect(sortedKeys(captured)).toEqual(sortedKeys([{ x: 5, y: 5 }, { x: 6, y: 5 }, { x: 7, y: 5 }]))
    for (const x of [5, 6, 7]) expect(after.board[5][x]).toBeNull()
    expect(after.ko).toBeNull()
  })

  it('captures two separate groups with one move', () => {
    // W singles at (4,5) and (6,5) share the liberty (5,5)
    const pos = placeSetup(
      emptyPosition(),
      [
        ...stones(W, [[4, 5], [6, 5]]),
        ...stones(B, [[3, 5], [4, 4], [4, 6], [7, 5], [6, 4], [6, 6]]),
      ],
      B,
    )
    const { pos: after, captured } = ok(pos, 5, 5, B)
    expect(sortedKeys(captured)).toEqual(sortedKeys([{ x: 4, y: 5 }, { x: 6, y: 5 }]))
    expect(after.board[5][4]).toBeNull()
    expect(after.board[5][6]).toBeNull()
    expect(after.board[5][5]).toBe(B)
  })

  it('captures against the edge and corner', () => {
    // W corner stone at A19 = (0,0), black at (1,0) and plays (0,1)
    const pos = placeSetup(emptyPosition(), [...stones(W, [[0, 0]]), ...stones(B, [[1, 0]])], B)
    const { pos: after, captured } = ok(pos, 0, 1, B)
    expect(captured).toEqual([{ x: 0, y: 0 }])
    expect(after.board[0][0]).toBeNull()
  })
})

describe('play: suicide', () => {
  it('a lone stone in an eye with no capture is suicide', () => {
    const pos = placeSetup(emptyPosition(), stones(W, [[1, 0], [0, 1]]), B)
    expect(play(pos, { x: 0, y: 0 }, B)).toEqual({ illegal: 'suicide' })
  })

  it('filling the last liberty of your own group is suicide', () => {
    const pos = placeSetup(
      emptyPosition(),
      [...stones(B, [[0, 0]]), ...stones(W, [[2, 0], [0, 1], [1, 1]])],
      B,
    )
    // (1,0) joins (0,0): the pair has no liberties left and takes nothing
    expect(play(pos, { x: 1, y: 0 }, B)).toEqual({ illegal: 'suicide' })
  })

  it('a move with no liberties of its own is legal when it captures', () => {
    // same corner eye, but both white stones have (0,0) as their only liberty
    const pos = placeSetup(
      emptyPosition(),
      [...stones(W, [[1, 0], [0, 1]]), ...stones(B, [[2, 0], [1, 1], [0, 2]])],
      B,
    )
    const { pos: after, captured } = ok(pos, 0, 0, B)
    expect(sortedKeys(captured)).toEqual(sortedKeys([{ x: 1, y: 0 }, { x: 0, y: 1 }]))
    expect(after.board[0][0]).toBe(B)
    expect(after.board[0][1]).toBeNull()
    expect(after.board[1][0]).toBeNull()
  })
})

describe('play: ko', () => {
  /**
   *   x: 0 1 2 3
   * y=0:  . B W .
   * y=1:  B W . W
   * y=2:  . B W .
   * Black plays (2,1) and takes the white stone on (1,1).
   */
  function koShape(): Position {
    return placeSetup(
      emptyPosition(),
      [...stones(B, [[1, 0], [0, 1], [1, 2]]), ...stones(W, [[1, 1], [2, 0], [3, 1], [2, 2]])],
      B,
    )
  }

  it('the capture that starts a ko records the ko point', () => {
    const { pos, captured } = ok(koShape(), 2, 1, B)
    expect(captured).toEqual([{ x: 1, y: 1 }])
    expect(pos.ko).toEqual({ x: 1, y: 1 })
  })

  it('immediate recapture is illegal', () => {
    const { pos } = ok(koShape(), 2, 1, B)
    expect(play(pos, { x: 1, y: 1 }, W)).toEqual({ illegal: 'ko' })
  })

  it('is legal again after one move elsewhere each', () => {
    const { pos } = ok(koShape(), 2, 1, B)
    const afterThreat = ok(pos, 10, 10, W).pos
    expect(afterThreat.ko).toBeNull()
    const afterAnswer = ok(afterThreat, 12, 12, B).pos
    const retake = ok(afterAnswer, 1, 1, W)
    expect(retake.captured).toEqual([{ x: 2, y: 1 }])
    // and the retake starts a ko the other way
    expect(retake.pos.ko).toEqual({ x: 2, y: 1 })
    expect(play(retake.pos, { x: 2, y: 1 }, B)).toEqual({ illegal: 'ko' })
  })

  it('the ko point is only blocked for the very next move', () => {
    const { pos } = ok(koShape(), 2, 1, B)
    // White plays elsewhere; the ko point stays empty and is no longer special
    const afterThreat = ok(pos, 10, 10, W).pos
    expect(play(afterThreat, { x: 1, y: 1 }, B)).not.toEqual({ illegal: 'ko' })
  })

  it('capturing one stone with a stone that has more than one liberty is not a ko', () => {
    // W (1,1) is in atari from (0,1),(1,0),(1,2); the capturing stone on (2,1) keeps (2,0) open too
    const pos = placeSetup(
      emptyPosition(),
      [...stones(B, [[1, 0], [0, 1], [1, 2]]), ...stones(W, [[1, 1], [3, 1], [2, 2]])],
      B,
    )
    const { pos: after, captured } = ok(pos, 2, 1, B)
    expect(captured).toEqual([{ x: 1, y: 1 }])
    expect(after.ko).toBeNull()
  })
})

describe('play: snapback', () => {
  /**
   *   x: 0 1 2 3 4
   * y=0:  B . . B W
   * y=1:  . B W W .
   * White throws in at (1,0), Black takes it at (2,0), White retakes two stones at (1,0).
   */
  it('a stone that has no liberties until it captures is legal, and it is not a ko', () => {
    const start = placeSetup(
      emptyPosition(),
      [...stones(B, [[0, 0], [1, 1], [3, 0]]), ...stones(W, [[2, 1], [3, 1], [4, 0]])],
      W,
    )
    const throwIn = ok(start, 1, 0, W)
    expect(throwIn.captured).toEqual([])

    const blackTakes = ok(throwIn.pos, 2, 0, B)
    expect(blackTakes.captured).toEqual([{ x: 1, y: 0 }])
    expect(blackTakes.pos.ko).toBeNull() // the capturing group has two stones

    const snapback = play(blackTakes.pos, { x: 1, y: 0 }, W)
    expect('illegal' in snapback).toBe(false)
    if ('illegal' in snapback) return
    expect(sortedKeys(snapback.captured)).toEqual(sortedKeys([{ x: 2, y: 0 }, { x: 3, y: 0 }]))
    expect(snapback.pos.board[0][1]).toBe(W)
    expect(snapback.pos.board[0][2]).toBeNull()
    expect(snapback.pos.board[0][3]).toBeNull()
    expect(snapback.pos.ko).toBeNull()
  })
})
