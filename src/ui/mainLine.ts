// A pattern's main line replayed move by move in the book's own frame (sym 0, studied corner upper
// right), for the Library thumbnails. It is the watch line (watchLine.ts) with the board unturned, so a
// line is replayed in one place only.

import type { Book } from '../book/types'
import { CORNER_REGION } from '../go/coords'
import type { Position } from '../go/rules'
import { watchLine, type WatchLine, type WatchStep } from './watchLine'

export type LineStep = WatchStep

export type MainLine = WatchLine

export function mainLine(book: Book, patternId: string): MainLine {
  return watchLine(book, patternId, 0)
}

/**
 * How many lines of the corner a thumbnail shows (from the corner, square): enough for every stone
 * in the studied corner at the end of the line, plus one, between 6 and 11.
 */
export function thumbSize(pos: Position): number {
  let reach = 0
  for (let y = CORNER_REGION.yMin; y <= CORNER_REGION.yMax; y++) {
    for (let x = CORNER_REGION.xMin; x <= CORNER_REGION.xMax; x++) {
      if (pos.board[y][x] !== null) reach = Math.max(reach, 18 - x, y)
    }
  }
  return Math.min(11, Math.max(6, reach + 2))
}
