// 3-3 point as the corner stone, Black on R17. Setup: even game. Black has D4; White has D16 and Q4.
// A 3-3 stone owns the corner outright, so White's plans are about keeping it low from the outside.
//
// Copy rules for notes (R13, R16): name the players and describe the move (no "you", no imperatives), and no
// absolute directions. Name points instead ("toward Q4", "on the D16 side"); the UI maps them through the
// board symmetry. "Under" in the Go sense (between the stones and the edge) is fine.

import type { FamilyDef } from '../types'

export const SANSAN33: FamilyDef = {
  id: 'sansan33',
  name: '3-3 point',
  setup: 'even',
  start: [{ c: 'B', at: 'R17', note: 'Black’s stone on the 3-3 point.' }],
  patterns: [
    {
      id: 'sansan33-shoulder-hit',
      name: 'Shoulder hit on the 3-3 point',
      difficulty: 1,
      order: 19,
      line: [
        {
          c: 'W',
          at: 'Q16',
          note: 'The shoulder hit. White builds on the outside and tries to keep the corner low.',
        },
        {
          c: 'B',
          at: 'R16',
          note: 'Black pushes along the edge toward Q4. The corner needs room on one side first.',
        },
        { c: 'W', at: 'Q15', note: 'White stays alongside so Black can’t get its head out.' },
        {
          c: 'B',
          at: 'Q17',
          note: 'Now Black pushes toward D16. A push on each side gives the corner room for two eyes.',
        },
        { c: 'W', at: 'O16', note: 'White jumps ahead toward D16, so the pushing stops here.' },
        { c: 'B', at: 'R14', note: 'Black jumps along the edge toward Q4 to widen the base.' },
        { c: 'W', at: 'Q14', note: 'White blocks on the outside and keeps the wall going.' },
        {
          c: 'B',
          at: 'R13',
          note: 'Black extends once more and the group is safe. White’s wall faces the center.',
        },
      ],
    },
    {
      id: 'sansan33-fourth-line-approach',
      name: 'Approach on the fourth line',
      difficulty: 2,
      order: 20,
      line: [
        {
          c: 'W',
          at: 'O16',
          note: 'White approaches on the fourth line from the D16 side. It’s high, so it watches the center too.',
        },
        {
          c: 'B',
          at: 'Q14',
          note: 'Black makes shape on the Q4 side. With Q14 the corner opens up toward Q4 and can’t be shut in.',
        },
        {
          c: 'W',
          at: 'R12',
          note: 'White comes in under Q14 before Black builds toward Q4.',
          confidence: 'low',
        },
        {
          c: 'B',
          at: 'L16',
          note: 'Black pincers O16 from the D16 side. Now White has two stones to look after.',
        },
      ],
    },
  ],
}
