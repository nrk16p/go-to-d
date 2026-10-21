// Book notes are written in the canonical frame (studied corner upper right). A session may run
// under any of the 8 symmetries, so the coordinates a note names have to move with the board.

import { parseGtp, toGtp, transform, type Sym } from '../go/coords'

/** A GTP point as a whole word: a column letter A–T without I, then a row 1–19. Upper case only. */
const GTP_TOKEN = /\b[A-HJ-T](?:1\d|[1-9])\b/g

/** `note` with every GTP coordinate ("Q4", "D16", "R14") moved by `sym`. Everything else is left as it is. */
export function orientNote(note: string, sym: Sym): string {
  if (sym === 0) return note
  return note.replace(GTP_TOKEN, (tok) => toGtp(transform(parseGtp(tok), sym)))
}
