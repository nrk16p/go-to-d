// 3-4 point (komoku), Black's corner stone on R16: third line from the right edge, fourth from the top.
// The 4-3 orientation is the same family seen in a mirror, so it comes for free from board symmetry.
// Setup: even game. Black has D4; White has D16 (left along the top) and Q4 (down the right side).
//
// Notes name the players ("Black", "White") instead of saying "you", because the owner drills both sides.

import type { FamilyDef } from '../types'

export const KOMOKU34: FamilyDef = {
  id: 'komoku34',
  name: '3-4 point',
  setup: 'even',
  start: [{ c: 'B', at: 'R16', note: 'Black’s stone on the 3-4 point.' }],
  patterns: [
    {
      id: 'komoku34-attach-drawback',
      name: "Small knight's approach, attach and draw back",
      difficulty: 1,
      order: 15,
      line: [
        {
          c: 'W',
          at: 'P17',
          note: 'The small knight’s approach from the top, the side where White’s D16 stone is.',
        },
        {
          c: 'B',
          at: 'Q17',
          note: 'Attach underneath. Black takes the corner first and makes White pick a shape now.',
        },
        { c: 'W', at: 'Q16', note: 'White hanes on top of the attached stone.' },
        {
          c: 'B',
          at: 'R17',
          note: 'Draw back. The corner is solid, and Black keeps a cut at P16 in reserve.',
        },
        { c: 'W', at: 'P16', note: 'White connects. A Black cut here would put Q16 in atari.' },
        {
          c: 'B',
          at: 'R14',
          note: 'Extend down the side for a base. White’s wall is close, so keep the extension short.',
        },
      ],
    },
    {
      id: 'komoku34-pincer-33',
      name: "Small knight's approach, one-space high pincer, 3-3 attach",
      difficulty: 3,
      order: 16,
      line: [
        { c: 'W', at: 'P17', note: '' },
        {
          c: 'B',
          at: 'N16',
          note: 'Pincer one space away on the fourth line. P17 has no room to extend along the top.',
        },
        {
          c: 'W',
          at: 'R17',
          kind: 'alternative',
          note: 'White attaches at the 3-3 point to live in the corner instead of running. Engines prefer pressing from the outside here, but this is still common and fine.',
        },
        {
          c: 'B',
          at: 'S17',
          note: 'Hane from the right side. White can’t come down the side, so it has to live along the top.',
        },
        { c: 'W', at: 'Q16', note: 'White hanes at Q16. Black’s R16 stone is down to two liberties.' },
        { c: 'B', at: 'R18', note: 'Atari from above. R17 has one liberty left.' },
        { c: 'W', at: 'Q17', note: 'White connects, and the stones on top become one group.' },
        { c: 'B', at: 'R15', note: 'Extend R16 down the side. Now it’s out of danger.' },
        { c: 'W', at: 'P14', note: 'White makes shape on the outside, facing the right side.' },
        {
          c: 'B',
          at: 'R13',
          note: 'One more step down the side. Black has a base on the right, and White has the top.',
        },
      ],
    },
    {
      id: 'komoku34-high-attach',
      name: 'One-space high approach, attach underneath',
      difficulty: 1,
      order: 17,
      line: [
        {
          c: 'W',
          at: 'P16',
          note: 'The one-space high approach. White sits on the fourth line and looks at the center.',
        },
        {
          c: 'B',
          at: 'P17',
          note: 'Attach underneath. Black takes the edge and the corner, and White gets the outside.',
        },
        { c: 'W', at: 'O17', note: 'White hanes so Black can’t slide along the top.' },
        { c: 'B', at: 'Q17', note: 'Draw back. The stones connect underneath and the corner is safe.' },
        { c: 'W', at: 'O16', note: 'White connects. Without it, a Black cut at O16 splits White in two.' },
        { c: 'B', at: 'R14', note: 'Extend down the right side. Black gets a base and White keeps the top.' },
      ],
    },
    {
      id: 'komoku34-tenuki',
      name: "Small knight's approach, tenuki",
      difficulty: 2,
      order: 18,
      line: [
        { c: 'W', at: 'P17', note: '' },
        {
          c: 'B',
          at: 'tenuki',
          note: 'Play elsewhere. A 3-4 stone can take a second White move and still live.',
        },
        {
          c: 'W',
          at: 'Q15',
          note: 'White leans on the corner from the outside to keep Black low. That’s the usual follow-up.',
        },
        { c: 'B', at: 'R15', note: 'Go down the side. Black needs a base more than the outside.' },
        { c: 'W', at: 'Q14', note: 'White keeps pressing and builds a wall.' },
        { c: 'B', at: 'R13', note: 'Jump along the third line for more eye space.' },
        { c: 'W', at: 'Q13', note: 'White follows along, keeping Black on the third line.' },
        {
          c: 'B',
          at: 'R12',
          note: 'Keep going. A White stone on R12 would leave the group without a base.',
        },
      ],
    },
  ],
}
