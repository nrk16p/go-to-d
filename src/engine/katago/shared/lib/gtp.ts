// Vendored from Sir-Teo/web-katrain (MIT), see LICENSES/web-katrain.txt
// Trimmed to formatGtpMove, the only part the engine uses.

import { DEFAULT_BOARD_SIZE } from '../types';

const GTP_COORD = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T'] as const;

/**
 * The GTP name for an intersection: the column letter, then the row counted
 * from the bottom.
 *
 * A pass is 'pass', which is what GTP calls it. A column off the board cannot
 * happen -- x indexes a board of at most nineteen columns, which is exactly the
 * length of GTP_COORD -- so it throws rather than inventing a letter past 'T'.
 */
export function formatGtpMove(x: number, y: number, boardSize: number = DEFAULT_BOARD_SIZE): string {
  if (x < 0 || y < 0) return 'pass';
  const column = GTP_COORD[x];
  if (column === undefined) throw new Error(`GTP column out of range: ${x}`);
  return `${column}${boardSize - y}`;
}
