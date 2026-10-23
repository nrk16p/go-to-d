// The watch phase's line (R45): the start, then each main-line move, all turned by the test's sym, with
// captures taken off by the rules, a tenuki that puts no stone down, and notes turned and localized.

import { describe, expect, it } from 'vitest'
import { buildBook } from '../../src/book/build'
import { BOOK } from '../../src/book/data'
import { localizeBook } from '../../src/book/localize'
import { TH } from '../../src/book/th'
import type { FamilyDef } from '../../src/book/types'
import { CORNER_REGION, inRegion, parseGtp, toGtp, transform, transformRegion, type Board, type Color, type Sym } from '../../src/go/coords'
import { orientNote } from '../../src/session/orient'
import { mainLine } from '../../src/ui/mainLine'
import { watchLine } from '../../src/ui/watchLine'

const SYMS: Sym[] = [0, 1, 2, 3, 4, 5, 6, 7]

/**
 * White pokes the 1-1 point, Black ataris, White plays elsewhere, Black captures, White approaches.
 * Not joseki: a legal line with one capture and one tenuki in it.
 */
const CAPTURE: FamilyDef = {
  id: 'star44',
  name: '4-4 point',
  setup: 'handicap4',
  start: [{ c: 'B', at: 'Q16', note: 'The corner stone on Q16.' }],
  patterns: [
    {
      id: 'capture-line',
      name: 'Take the 1-1 stone',
      difficulty: 1,
      order: 1,
      line: [
        { c: 'W', at: 'T19', note: 'White pokes T19.' },
        { c: 'B', at: 'S19', note: 'Atari from S19: T19 has one liberty left, at T18.' },
        { c: 'W', at: 'tenuki', note: 'White leaves it.' },
        { c: 'B', at: 'T18', note: 'Black takes T19 off the board.' },
        { c: 'W', at: 'R14', note: 'White approaches at R14 instead.', confidence: 'low' },
      ],
    },
  ],
}

/** The board from a list of stones written in the book's frame, turned by `sym`. */
function boardOf(stones: Array<[string, Color]>, sym: Sym): Board {
  const b: Board = Array.from({ length: 19 }, () => Array<Color | null>(19).fill(null))
  for (const [g, c] of stones) {
    const p = transform(parseGtp(g), sym)
    b[p.y][p.x] = c
  }
  return b
}

describe('watchLine', () => {
  const book = buildBook([CAPTURE])
  const SETUP: Array<[string, Color]> = [
    ['Q16', 'black'],
    ['D4', 'black'],
    ['D16', 'black'],
    ['Q4', 'black'],
  ]

  it('plays the line under a turned board (sym 3): every position, the capture and the tenuki', () => {
    const sym: Sym = 3
    const on = (g: string) => transform(parseGtp(g), sym)
    const line = watchLine(book, 'capture-line', sym)
    expect(line.sym).toBe(3)
    expect(line.region).toEqual(transformRegion(CORNER_REGION, sym))
    expect(line.steps).toHaveLength(6)

    const [start, poke, atari, away, take, approach] = line.steps
    expect(start).toMatchObject({ node: null, color: null, at: null, tenuki: false, captured: [] })
    expect(start.pos.board).toEqual(boardOf(SETUP, sym))
    expect(start.pos.toMove).toBe('white')
    // The corner stone's note, its point turned: Q16 is D16 under sym 3.
    expect(start.note).toBe(`The corner stone on ${toGtp(on('Q16'))}.`)
    expect(toGtp(on('Q16'))).not.toBe('Q16')

    expect(poke).toMatchObject({ color: 'white', at: on('T19'), tenuki: false, captured: [] })
    expect(poke.pos.board).toEqual(boardOf([...SETUP, ['T19', 'white']], sym))
    expect(poke.note).toBe(`White pokes ${toGtp(on('T19'))}.`)

    expect(atari.pos.board).toEqual(boardOf([...SETUP, ['T19', 'white'], ['S19', 'black']], sym))
    expect(atari.note).toBe(`Atari from ${toGtp(on('S19'))}: ${toGtp(on('T19'))} has one liberty left, at ${toGtp(on('T18'))}.`)

    // The tenuki: no stone, the same board, Black to move again.
    expect(away).toMatchObject({ color: 'white', at: null, tenuki: true, captured: [] })
    expect(away.pos.board).toBe(atari.pos.board)
    expect(away.pos.toMove).toBe('black')
    expect(away.node?.move?.at).toBe('tenuki')

    // The capture: T18 takes the T19 stone off.
    expect(take).toMatchObject({ color: 'black', at: on('T18'), captured: [on('T19')] })
    expect(take.pos.board).toEqual(boardOf([...SETUP, ['S19', 'black'], ['T18', 'black']], sym))
    const t19 = on('T19')
    expect(take.pos.board[t19.y][t19.x]).toBeNull()

    expect(approach).toMatchObject({ color: 'white', at: on('R14'), low: true })
    expect(approach.pos.board).toEqual(boardOf([...SETUP, ['S19', 'black'], ['T18', 'black'], ['R14', 'white']], sym))
    for (const s of line.steps.slice(1)) {
      if (s.at) expect(inRegion(s.at, line.region)).toBe(true)
      expect(s.low).toBe(s === approach)
    }
  })

  it('is the book-frame line turned, for every pattern in the book and every symmetry', () => {
    for (const id of Object.keys(BOOK.patterns)) {
      const plain = watchLine(BOOK, id, 0)
      expect(plain).toBe(mainLine(BOOK, id))
      for (const sym of SYMS) {
        const line = watchLine(BOOK, id, sym)
        expect(line.steps).toHaveLength(BOOK.patterns[id].path.length + 1)
        line.steps.forEach((s, i) => {
          const p = plain.steps[i]
          expect(s.tenuki).toBe(p.tenuki)
          expect(s.at).toEqual(p.at && transform(p.at, sym))
          expect(s.note).toBe(orientNote(p.note, sym))
          for (let y = 0; y < 19; y++) {
            for (let x = 0; x < 19; x++) {
              const q = transform({ x, y }, sym)
              if (s.pos.board[q.y][q.x] !== p.pos.board[y][x]) throw new Error(`${id} sym ${sym} step ${i} differs at ${x},${y}`)
            }
          }
        })
      }
    }
  })

  it('shows a real tenuki in the book as a move with no stone', () => {
    const id = 'invade33-white-tenuki'
    const at = BOOK.patterns[id].path.findIndex((n) => n.move?.at === 'tenuki')
    expect(at).toBeGreaterThanOrEqual(0)
    const line = watchLine(BOOK, id, 1)
    const s = line.steps[at + 1]
    expect(s).toMatchObject({ tenuki: true, at: null })
    expect(s.pos.board).toBe(line.steps[at].pos.board)
  })

  it('in Thai, every note is the Thai note with its points turned', () => {
    const th = localizeBook(BOOK, 'th')
    const id = 'invade33-hane-hane'
    const sym: Sym = 3
    const line = watchLine(th, id, sym)
    const notes = TH.invade33.notes
    let checked = 0
    for (const s of line.steps.slice(1)) {
      const thai = notes[s.node!.key]
      if (!thai) continue
      expect(s.note).toBe(orientNote(thai, sym))
      expect(s.note).toMatch(/[฀-๿]/)
      checked++
    }
    expect(checked).toBe(BOOK.patterns[id].path.length)
    // The same line in English says something else.
    expect(watchLine(BOOK, id, sym).steps[1].note).not.toBe(line.steps[1].note)
  })
})
