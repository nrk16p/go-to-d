// The book's frame (studied corner upper right) and the board's frame (the book's turned by `sym`).
// judgeMove works in the book's frame; the board, the engine and the owner's taps are in the board's.

import type { BookNode } from '../book/types'
import type { CornerAnalysis } from '../engine/teacher'
import { inverse, toGtp, transform, type Pt, type Sym } from '../go/coords'
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
