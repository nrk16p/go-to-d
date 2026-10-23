import { describe, expect, it } from 'vitest'
import { BOOK } from '../../src/book/data'
import { isBoardFamily, startPosition } from '../../src/book/setups'
import type { BookNode, FamilyId } from '../../src/book/types'
import { validateBook } from '../../src/book/validate'
import { BOARD_REGION, transform, type Sym } from '../../src/go/coords'
import { play, type Position } from '../../src/go/rules'

describe('the real joseki book', () => {
  it('passes the validator', () => {
    const errors = validateBook(BOOK)
    expect(errors, errors.join('\n')).toEqual([])
  })
})

describe('the whole-board openings (R46)', () => {
  const openings = (Object.keys(BOOK.families) as FamilyId[]).filter((f) => isBoardFamily(BOOK.families[f].def))

  it('are open-h4 and open-even, each with patterns', () => {
    expect(openings.sort()).toEqual(['open-even', 'open-h4'])
    for (const f of openings) expect(BOOK.families[f].def.patterns.length).toBeGreaterThan(0)
  })

  it('replay every node legally under all 8 symmetries, with no tenuki', () => {
    for (const f of openings) {
      for (const sym of [0, 1, 2, 3, 4, 5, 6, 7] as Sym[]) {
        const start = startPosition(BOOK, f, null, sym)
        expect(start.region).toEqual(BOARD_REGION)
        const walk = (node: BookNode, pos: Position) => {
          for (const child of node.children) {
            const m = child.move!
            expect(m.at, `${f} ${child.key}`).not.toBe('tenuki')
            if (m.at === 'tenuki') continue
            const r = play(pos, transform(m.at, sym), m.color)
            if ('illegal' in r) throw new Error(`${f} ${child.key} under sym ${sym}: ${r.illegal}`)
            walk(child, r.pos)
          }
        }
        walk(BOOK.families[f].root, start.pos)
      }
    }
  })
})
