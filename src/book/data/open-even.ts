// Whole-board opening in an even game (R46). Setup 'empty': an empty board, Black moves first, komi 7.5,
// no start stones. The owner plays Black ('defend') and may drill White ('attack') too.
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
// this file (keep the export name OPEN_EVEN and the family fields).

import type { FamilyDef } from '../types'

export const OPEN_EVEN: FamilyDef = {
  id: 'open-even',
  name: 'Even-game opening',
  region: 'board',
  setup: 'empty',
  start: [],
  patterns: [
    {
      id: 'open-even-three-stars',
      name: 'Corners first: three star points',
      difficulty: 1,
      order: 1,
      line: [
        { c: 'B', at: 'Q16', note: 'Black starts in a corner. Corners are the easiest place to make territory.' },
        { c: 'W', at: 'D4', note: 'White takes the corner across from Q16.' },
        { c: 'B', at: 'Q4', note: 'Black takes a third corner, so Q4 and Q16 work together along one side.' },
      ],
    },
  ],
}
