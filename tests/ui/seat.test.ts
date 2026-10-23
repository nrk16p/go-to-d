// How a side is named on screen (R46): defend/attack in a corner, the colour in a whole-board opening.

import { describe, expect, it } from 'vitest'
import type { FamilyDef } from '../../src/book/types'
import * as EN from '../../src/ui/copy.en'
import * as TH from '../../src/ui/copy.th'
import { seatColor, sideLabel, sideShortLabel } from '../../src/ui/seat'
import { FIXTURE_FAMILY } from '../book/fixture'

const OPEN_EVEN: FamilyDef = { id: 'open-even', name: 'even', region: 'board', setup: 'empty', start: [], patterns: [] }
const OPEN_H4: FamilyDef = { ...FIXTURE_FAMILY, id: 'open-h4', region: 'board', patterns: [] }

describe('side labels', () => {
  it('name an opening’s sides by colour: Black for defend, White for attack', () => {
    expect(seatColor(OPEN_EVEN, 'defend')).toBe('black')
    expect(seatColor(OPEN_EVEN, 'attack')).toBe('white')
    expect(seatColor(OPEN_H4, 'defend')).toBe('black')
    expect(sideLabel(OPEN_EVEN, 'defend', EN.COPY)).toBe('Black')
    expect(sideLabel(OPEN_EVEN, 'attack', EN.COPY)).toBe('White')
    expect(sideShortLabel(OPEN_H4, 'defend', EN.COPY)).toBe('Black')
  })

  it('say ดำ / ขาว in Thai', () => {
    expect(sideLabel(OPEN_EVEN, 'defend', TH.COPY)).toBe('ดำ')
    expect(sideLabel(OPEN_EVEN, 'attack', TH.COPY)).toBe('ขาว')
    expect(sideShortLabel(OPEN_EVEN, 'attack', TH.COPY)).toBe('ขาว')
  })

  it('keep defend / attack for a corner family', () => {
    expect(seatColor(FIXTURE_FAMILY, 'defend')).toBeNull()
    expect(sideLabel(FIXTURE_FAMILY, 'defend', EN.COPY)).toBe('Defending')
    expect(sideLabel(FIXTURE_FAMILY, 'attack', EN.COPY)).toBe('Attacking')
    expect(sideShortLabel(FIXTURE_FAMILY, 'attack', EN.COPY)).toBe('Attack')
    expect(sideLabel(FIXTURE_FAMILY, 'defend', TH.COPY)).toBe('รับมุม')
  })
})
