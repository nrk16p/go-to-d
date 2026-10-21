import { describe, expect, it } from 'vitest'
import { parseGtp, toGtp, transform, type Sym } from '../../src/go/coords'
import { orientNote } from '../../src/session/orient'

const SYMS: Sym[] = [0, 1, 2, 3, 4, 5, 6, 7]

describe('orientNote', () => {
  it('leaves the note alone under sym 0', () => {
    const note = 'Black blocks toward Q4, so D16 stays weak. R14 and T19 too.'
    expect(orientNote(note, 0)).toBe(note)
  })

  it('moves every coordinate with the board', () => {
    // sym 4 mirrors left-right: Q4 → D4, D16 → Q16, R14 → C14.
    expect(orientNote('Extend toward Q4, away from D16. R14 is the key.', 4)).toBe(
      'Extend toward D4, away from Q16. C14 is the key.',
    )
    // sym 2 turns the board half way: Q16 → D4.
    expect(orientNote('The stone on Q16.', 2)).toBe('The stone on D4.')
  })

  it('matches the transform for every point and symmetry, and never writes the letter I', () => {
    for (const sym of SYMS) {
      for (const col of 'ABCDEFGHJKLMNOPQRST') {
        for (let row = 1; row <= 19; row++) {
          const tok = `${col}${row}`
          const out = orientNote(`at ${tok}.`, sym)
          expect(out).toBe(`at ${toGtp(transform(parseGtp(tok), sym))}.`)
          expect(out).not.toMatch(/\bI\d/)
        }
      }
    }
  })

  it('touches only whole GTP words', () => {
    const untouched = [
      'I think A is fine.',
      'I9 is not a point, nor is U5 or A20 or A0.',
      'Q4x and 3Q4 and Q04 stay as they are.',
      'a 19x19 board',
      'q4 in lower case is not a coordinate here.',
    ]
    for (const sym of SYMS) {
      for (const note of untouched) expect(orientNote(note, sym)).toBe(note)
    }
  })

  it('handles punctuation around tokens and several tokens in a row', () => {
    expect(orientNote('(Q4), "D16"; R14/S13 — T19!', 4)).toBe('(D4), "Q16"; C14/B13 — A19!')
  })

  it('returns an empty note unchanged', () => {
    expect(orientNote('', 3)).toBe('')
  })
})
