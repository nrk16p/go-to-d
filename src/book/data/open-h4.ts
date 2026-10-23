// Whole-board opening with four handicap stones (R46). Setup: Black on all four star points (Q16 is the
// "start" stone, D4, D16 and Q4 come with the setup), White moves first, komi 0.5. The owner plays Black
// only: in a handicap game the owner takes Black.
//
// region: 'board' makes this a whole-board family: every point is in play, the book check and the
// teacher compare each move with the best move anywhere on the board, and there are no 'tenuki' moves
// (write the point that is played). Everything else is the same book format as the corner families.
//
// Copy rules for notes (R13, R16, R36): name the players and describe the move, no "you", no
// imperatives; no absolute directions ("right side", "top"), name points instead ("toward Q4", "the side
// between Q4 and Q16", "toward the center"); no coordinates in pattern names.
//
// PLACEHOLDER: one tiny pattern so the app and the tests have something real. The content lane replaces
// this file (keep the export name OPEN_H4 and the family fields).

import type { FamilyDef } from '../types'

export const OPEN_H4: FamilyDef = {
  id: 'open-h4',
  name: 'Opening with four stones',
  region: 'board',
  setup: 'handicap4',
  start: [{ c: 'B', at: 'Q16', note: 'Black has all four star points. White plays first.' }],
  patterns: [
    {
      id: 'open-h4-approach-pincer',
      name: 'Low approach, Black pincers',
      difficulty: 1,
      order: 1,
      line: [
        { c: 'W', at: 'R14', note: 'White approaches Q16 low, the usual first move against four stones.' },
        {
          c: 'B',
          at: 'Q12',
          note: 'Black pincers with help from Q4. White’s approach stone is caught between two Black stones.',
        },
      ],
    },
  ],
}
