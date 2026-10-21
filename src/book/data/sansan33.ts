// 3-3 point as the corner stone, Black on R17. Setup: even game. Black has D4; White has D16 and Q4.
// A 3-3 stone owns the corner outright, so White's plans are about keeping it low from the outside.
//
// Notes name the players ("Black", "White") instead of saying "you", because the owner drills both sides.

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
        { c: 'B', at: 'R16', note: 'Push down the side. The corner needs room along one side first.' },
        { c: 'W', at: 'Q15', note: 'White stays alongside so Black can’t get a head out.' },
        {
          c: 'B',
          at: 'Q17',
          note: 'Now push along the top. A push on each side gives the corner room for two eyes.',
        },
        { c: 'W', at: 'O16', note: 'White jumps ahead on the top, so the pushing stops here.' },
        { c: 'B', at: 'R14', note: 'Jump down the side to widen the base.' },
        { c: 'W', at: 'Q14', note: 'White blocks on the outside and keeps the wall going.' },
        {
          c: 'B',
          at: 'R13',
          note: 'Extend once more. Black’s group is safe, and White’s wall faces down the right side.',
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
          note: 'White approaches from the top on the fourth line. It’s high, so it watches the center too.',
        },
        {
          c: 'B',
          at: 'Q14',
          note: 'Make shape on the other side. With Q14 the corner opens up the right side and can’t be shut in.',
        },
        {
          c: 'W',
          at: 'R12',
          note: 'White comes in under Q14 before Black builds on the right side.',
          confidence: 'low',
        },
        {
          c: 'B',
          at: 'L16',
          note: 'Pincer O16 from the left. Now White has two weak stones and Black has none.',
        },
      ],
    },
  ],
}
