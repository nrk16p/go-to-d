import { describe, expect, it } from 'vitest'
import { buildBook } from '../../src/book/build'
import { parseGtp, toGtp, transform, type Pt, type Sym } from '../../src/go/coords'
import { emptyPosition, play, type Position } from '../../src/go/rules'
import { analysisToBook, lineKey, noteOn, toBoardPt, toBookPt, verdictToBoard } from '../../src/session/frame'
import type { Verdict } from '../../src/session/judge'
import { FIXTURE_FAMILY } from '../book/fixture'
import { analysisOf } from './fakeEngine'

const SYMS: Sym[] = [0, 1, 2, 3, 4, 5, 6, 7]
const P = parseGtp

describe('toBoardPt / toBookPt', () => {
  it('undo each other under every symmetry, and rotations are not their own inverse', () => {
    for (const sym of SYMS) {
      for (const g of ['R14', 'Q16', 'A1', 'T19', 'K10']) {
        expect(toBookPt(toBoardPt(P(g), sym), sym)).toEqual(P(g))
      }
    }
    // sym 1 turns a quarter clockwise: the book's R14 lands on O3 on the board, and back.
    expect(toGtp(toBoardPt(P('R14'), 1))).toBe('O3')
    expect(toGtp(toBookPt(P('O3'), 1))).toBe('R14')
    expect(toGtp(toBookPt(P('R14'), 1))).not.toBe('O3')
  })
})

describe('analysisToBook', () => {
  it('turns every point back to the book’s frame and keeps the scores', () => {
    const sym: Sym = 3
    const onBoard = (g: string) => toGtp(toBoardPt(P(g), sym))
    const a = analysisOf('black', [[onBoard('Q14'), 1.5], [onBoard('P13'), 0.9]], [onBoard('D10'), -2])
    expect(analysisToBook(a, sym)).toEqual(analysisOf('black', [['Q14', 1.5], ['P13', 0.9]], ['D10', -2]))
    expect(analysisToBook({ ...a, tenukiBest: null }, sym).tenukiBest).toBeNull()
  })
})

describe('verdictToBoard', () => {
  const sym: Sym = 1
  const b = (g: string): Pt => transform(P(g), sym)

  it('turns points and orients notes', () => {
    expect(verdictToBoard({ type: 'good', kind: 'joseki', note: 'Toward Q4.' }, sym)).toEqual({
      type: 'good',
      kind: 'joseki',
      note: `Toward ${toGtp(b('Q4'))}.`,
    })
    expect(verdictToBoard({ type: 'other-joseki', note: 'R14', patternIds: ['x'] }, sym)).toEqual({
      type: 'other-joseki',
      note: toGtp(b('R14')),
      patternIds: ['x'],
    })
    expect(verdictToBoard({ type: 'fine-offbook', pointsLost: 1, bookMove: P('Q14') }, sym)).toEqual({
      type: 'fine-offbook',
      pointsLost: 1,
      bookMove: b('Q14'),
    })
  })

  it('leaves tenuki, null and missing notes alone', () => {
    const m = (better: Pt | 'tenuki' | null): Verdict => ({ type: 'mistake', better, pointsLost: 2, big: false, inBook: false })
    expect(verdictToBoard(m(P('P13')), sym)).toEqual(m(b('P13')))
    expect(verdictToBoard(m('tenuki'), sym)).toEqual(m('tenuki'))
    expect(verdictToBoard(m(null), sym)).toEqual(m(null))
    expect('note' in verdictToBoard(m(null), sym)).toBe(false)
    expect(verdictToBoard({ type: 'fine-offbook', pointsLost: 0, bookMove: 'tenuki' }, sym)).toMatchObject({ bookMove: 'tenuki' })
    const u: Verdict = { type: 'unjudged', reason: 'engine-loading' }
    expect(verdictToBoard(u, sym)).toBe(u)
  })
})

describe('noteOn', () => {
  const book = buildBook([FIXTURE_FAMILY])
  const hane = book.patterns['fixture-hane'].path

  it('orients a node’s note; nothing for no node or an empty note', () => {
    expect(noteOn(hane[3], 4)).toBe('Block on the left. C13 is now a cutting point.')
    expect(noteOn(null, 4)).toBeNull()
    expect(noteOn(book.patterns['fixture-crawl'].path[2], 0)).not.toBeNull()
    expect(noteOn({ ...hane[0], note: '' }, 0)).toBeNull()
  })
})

describe('lineKey', () => {
  function line(sym: Sym, moves: string[]): Position {
    let pos = emptyPosition()
    moves.forEach((g, i) => {
      const r = play(pos, toBoardPt(P(g), sym), i % 2 === 0 ? 'white' : 'black')
      if ('illegal' in r) throw new Error(g)
      pos = r.pos
    })
    return pos
  }

  it('names the line in the book’s frame, whatever the symmetry', () => {
    for (const sym of SYMS) expect(lineKey(line(sym, ['R14', 'R17', 'J19']), sym)).toBe('W:R14/B:R17/W:J19')
    expect(lineKey(emptyPosition(), 3)).toBe('')
  })
})
