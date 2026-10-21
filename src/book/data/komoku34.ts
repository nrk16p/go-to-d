// 3-4 point (komoku), Black's corner stone on R16: third line from one edge, fourth from the other.
// The 4-3 orientation is the same family seen in a mirror, so it comes for free from board symmetry.
// Setup: even game. Black has D4; White has D16 and Q4, one on each side of the corner.
//
// Copy rules for notes (R13, R16): name the players and describe the move (no "you", no imperatives), and no
// absolute directions. Name points instead ("toward Q4", "on the D16 side"); the UI maps them through the
// board symmetry. "Under" in the Go sense (between the stones and the edge) is fine.
//
// Engine check: always re-run this family with `npx tsx tools/check-book.ts --family komoku34 --visits 800`.
// The 3-3 attach in komoku34-pincer-33 (W:P17/B:N16/W:R17, an `alternative`) passes at 1.71 at 800 visits;
// at 400 visits it can land anywhere from about 1.7 to 2.3 and get flagged.

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
          note: 'The small knight’s approach, from the side where White’s D16 stone is.',
        },
        {
          c: 'B',
          at: 'Q17',
          note: 'Black attaches on the corner side of P17. Black takes the corner first and makes White pick a shape now.',
        },
        { c: 'W', at: 'Q16', note: 'White hanes at Q16, on the center side of the attached stone.' },
        {
          c: 'B',
          at: 'R17',
          note: 'Black draws back. The corner is solid, and Black keeps a cut at P16 in reserve.',
        },
        { c: 'W', at: 'P16', note: 'White connects. A Black cut here would put Q16 in atari.' },
        {
          c: 'B',
          at: 'R14',
          note: 'Black extends toward Q4 for a base. White’s wall is close, so the extension stays short.',
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
          note: 'Black pincers one space away on the fourth line. P17 has no room to extend toward D16.',
        },
        {
          c: 'W',
          at: 'R17',
          kind: 'alternative',
          note: 'White attaches at the 3-3 point to live in the corner instead of running. Engines prefer jumping out toward the center here, but this is still common and fine.',
        },
        {
          c: 'B',
          at: 'S17',
          note: 'Black hanes at S17. White can’t go toward Q4, so it has to live on the D16 side.',
        },
        { c: 'W', at: 'Q16', note: 'White hanes at Q16. Black’s R16 stone is down to two liberties.' },
        { c: 'B', at: 'R18', note: 'Black ataris at R18, from the edge side. R17 is down to one liberty.' },
        { c: 'W', at: 'Q17', note: 'White connects, and its stones become one group.' },
        { c: 'B', at: 'R15', note: 'Black extends R16 toward Q4. Now it’s out of danger.' },
        { c: 'W', at: 'P14', note: 'White makes shape on the outside, facing Black’s stones on the Q4 side.' },
        {
          c: 'B',
          at: 'R13',
          note: 'Black takes one more step toward Q4. Black has a base on that side, and White has the D16 side.',
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
          note: 'Black attaches underneath, between P16 and the edge. Black takes the edge and the corner. White gets the outside.',
        },
        { c: 'W', at: 'O17', note: 'White hanes so Black can’t slide along the edge toward D16.' },
        {
          c: 'B',
          at: 'Q17',
          note: 'Black draws back. The stones connect underneath and the corner is safe.',
        },
        { c: 'W', at: 'O16', note: 'White connects. Without it, a Black cut at O16 splits White in two.' },
        {
          c: 'B',
          at: 'R14',
          note: 'Black extends toward Q4. Black gets a base and White keeps the D16 side.',
        },
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
          note: 'Black plays elsewhere. A 3-4 stone can take a second White move and still live.',
        },
        {
          c: 'W',
          at: 'Q15',
          note: 'White leans on the corner from the center side to keep Black low. That’s the usual follow-up.',
        },
        {
          c: 'B',
          at: 'R15',
          note: 'Black goes along the edge toward Q4. A base matters more than the outside here.',
        },
        { c: 'W', at: 'Q14', note: 'White keeps pressing and builds a wall.' },
        { c: 'B', at: 'R13', note: 'Black jumps along the third line for more eye space.' },
        { c: 'W', at: 'Q13', note: 'White follows along, keeping Black on the third line.' },
        {
          c: 'B',
          at: 'R12',
          note: 'Black has to keep going. A White stone on R12 would leave the group without a base.',
        },
      ],
    },
  ],
}
