// The book's frame (studied corner upper right) and the board's frame (the book's turned by `sym`).
// judgeMove works in the book's frame; the board, the engine and the owner's taps are in the board's.

import type { BookNode } from '../book/types'
import type { CornerAnalysis } from '../engine/teacher'
import { BOARD_SIZE, composeSym, inverse, SYMS, toGtp, transform, transformRegion, type Pt, type Region, type Sym } from '../go/coords'
import type { Position } from '../go/rules'
import type { Verdict } from './judge'
import { orientNote } from './orient'

export function toBoardPt(p: Pt, sym: Sym): Pt {
  return transform(p, sym)
}

export function toBookPt(p: Pt, sym: Sym): Pt {
  return transform(p, inverse(sym))
}

/** An engine analysis (board frame) in the book's frame. */
export function analysisToBook(a: CornerAnalysis, sym: Sym): CornerAnalysis {
  return {
    toMove: a.toMove,
    cornerBest: { ...a.cornerBest, pt: toBookPt(a.cornerBest.pt, sym) },
    tenukiBest: a.tenukiBest && { ...a.tenukiBest, pt: toBookPt(a.tenukiBest.pt, sym) },
    candidates: a.candidates.map((c) => ({ ...c, pt: toBookPt(c.pt, sym) })),
    visits: a.visits,
  }
}

/** A verdict from judgeMove (book frame) on the board: points turned by `sym`, notes oriented. */
export function verdictToBoard(v: Verdict, sym: Sym): Verdict {
  const turn = (p: Pt | 'tenuki'): Pt | 'tenuki' => (p === 'tenuki' ? p : toBoardPt(p, sym))
  switch (v.type) {
    case 'good':
    case 'other-joseki':
      return { ...v, note: orientNote(v.note, sym) }
    case 'mistake':
      return {
        ...v,
        better: v.better === null ? null : turn(v.better),
        ...(v.note === undefined ? {} : { note: orientNote(v.note, sym) }),
      }
    case 'fine-offbook':
      return { ...v, bookMove: v.bookMove === null ? null : turn(v.bookMove) }
    case 'unjudged':
      return v
  }
}

/** The note on a book node's move, oriented for the board; null off book or for an empty note. */
export function noteOn(node: BookNode | null, sym: Sym): string | null {
  return node && node.note !== '' ? orientNote(node.note, sym) : null
}

/** The moves played so far in the book's frame ("W:R14/B:R17"): a name for a position the book doesn't have. */
export function lineKey(pos: Position, sym: Sym): string {
  return pos.history.map((m) => `${m.player === 'black' ? 'B' : 'W'}:${toGtp(toBookPt(m, sym))}`).join('/')
}

/**
 * R47: the symmetries g of the book's frame (identity left out) under which the position, seen in the
 * book's frame, is the same position: every stone lands on a stone of its colour and the ko point on
 * itself. Only those that keep `region` (book frame) where it is: in a corner family that leaves the
 * diagonal mirror through the 4-4 point, so the studied corner stays put; a whole-board region keeps all.
 */
export function positionSymmetries(pos: Position, sym: Sym, region: Region): Sym[] {
  const at = (p: Pt) => {
    const b = toBoardPt(p, sym)
    return pos.board[b.y][b.x]
  }
  const sameRegion = (g: Sym) => {
    const r = transformRegion(region, g)
    return r.xMin === region.xMin && r.xMax === region.xMax && r.yMin === region.yMin && r.yMax === region.yMax
  }
  const ko = pos.ko && toBookPt(pos.ko, sym)
  return SYMS.filter((g) => {
    if (g === 0 || !sameRegion(g)) return false
    if (ko) {
      const k = transform(ko, g)
      if (k.x !== ko.x || k.y !== ko.y) return false
    }
    for (let y = 0; y < BOARD_SIZE; y++) {
      for (let x = 0; x < BOARD_SIZE; x++) {
        if (at({ x, y }) !== at(transform({ x, y }, g))) return false
      }
    }
    return true
  })
}

/**
 * The session's sym after the book is turned by `g` (a symmetry of the position, positionSymmetries): the
 * board stays as it is, and a board point that was `q` in the book is now `g(q)`.
 */
export function turnedSym(sym: Sym, g: Sym): Sym {
  // Board = sym(book) = sym(g⁻¹(g(book))): the new book-to-board map is g⁻¹ then sym.
  return composeSym(inverse(g), sym)
}
