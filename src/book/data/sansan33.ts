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
    {
      id: 'sansan33-shoulder-hit-slide',
      name: 'Shoulder hit, knight’s-move slide',
      difficulty: 2,
      order: 93,
      line: [
        { c: 'W', at: 'Q16', note: '' },
        { c: 'B', at: 'R16', note: '' },
        { c: 'W', at: 'Q15', note: '' },
        {
          c: 'B',
          at: 'P18',
          note: 'Black slides to P18, a knight’s move along the second line. The corner gets room on the D16 side, and White’s wall gets no thicker.',
        },
        { c: 'W', at: 'R15', note: 'White blocks at R15, so the corner can’t grow along the edge toward Q4.' },
        {
          c: 'B',
          at: 'O16',
          note: 'Black plays O16 and stops the wall from spreading toward D16. With P18, the corner has a base on that side.',
        },
        { c: 'W', at: 'Q11', note: 'White extends toward its Q4 stone. The wall and Q4 work together now.' },
        {
          c: 'B',
          at: 'tenuki',
          note: 'Black plays elsewhere. Black has the corner and the D16 side. White has the wall toward Q4.',
        },
      ],
      branches: [
        {
          after: 1,
          move: {
            c: 'B',
            at: 'S16',
            kind: 'mistake',
            note: 'Crawling on the second line at S16 is too low. White blocks at Q17 and the corner stays tiny.',
          },
          then: [
            { c: 'W', at: 'Q17', note: 'White blocks on the D16 side. Black can only grow along the edge toward Q4 now.' },
            { c: 'B', at: 'R14', note: 'Black jumps to R14 for room along the edge. Without it the corner is short of eye space.' },
            {
              c: 'W',
              at: 'M16',
              note: 'White extends toward D16. The wall and D16 frame a big area, and Black got a small corner for it.',
            },
          ],
        },
      ],
    },
    {
      id: 'sansan33-shoulder-hit-block',
      name: 'Shoulder hit, White blocks (older line)',
      difficulty: 2,
      order: 94,
      line: [
        { c: 'W', at: 'Q16', note: '' },
        { c: 'B', at: 'R16', note: '' },
        { c: 'W', at: 'Q15', note: '' },
        { c: 'B', at: 'Q17', note: '' },
        {
          c: 'W',
          at: 'P17',
          kind: 'alternative',
          note: 'White blocks at P17, the older move. Engines prefer the jump to O16 because P17 gives Black a hane at P18. It’s still playable.',
        },
        {
          c: 'B',
          at: 'P18',
          note: 'Black hanes under P17 straight away. The corner’s eye space on the D16 side depends on this point.',
        },
        { c: 'W', at: 'O17', note: 'White extends to O17. A Black stone there would put P17 in atari.' },
        { c: 'B', at: 'O18', note: 'Black crawls once more on the second line for a bit more eye space.' },
        { c: 'W', at: 'N17', note: 'White extends to N17. The wall faces D16 and works with White’s stone there.' },
        { c: 'B', at: 'R14', note: 'Black jumps to R14 on the Q4 side. The corner has its base now and is settled.' },
      ],
    },
    {
      id: 'sansan33-shoulder-hit-jump',
      name: 'Shoulder hit, White jumps',
      difficulty: 2,
      order: 95,
      line: [
        { c: 'W', at: 'Q16', note: '' },
        { c: 'B', at: 'R16', note: '' },
        {
          c: 'W',
          at: 'Q14',
          note: 'White jumps to Q14 instead of standing at Q15. The wall is lighter and reaches further toward Q4.',
        },
        { c: 'B', at: 'P16', note: 'Black stops White on the D16 side with P16. The corner gets room there.' },
        {
          c: 'W',
          at: 'tenuki',
          note: 'White plays elsewhere. The gap at Q15 looks thin, but cutting there isn’t worth a move for Black yet.',
        },
      ],
    },
    {
      id: 'sansan33-fourth-line-tenuki',
      name: 'Approach on the fourth line, White plays elsewhere',
      difficulty: 2,
      order: 96,
      line: [
        { c: 'W', at: 'O16', note: '' },
        { c: 'B', at: 'Q14', note: '' },
        { c: 'W', at: 'tenuki', note: 'White plays elsewhere and leaves O16 on its own.' },
        {
          c: 'B',
          at: 'M17',
          note: 'Black pincers O16 from the D16 side. O16 has no room for a base along the edge now.',
        },
      ],
      branches: [
        {
          after: 1,
          move: {
            c: 'B',
            at: 'O17',
            kind: 'mistake',
            note: 'Attaching under O16 only makes White stronger. White hanes at P17 and gets between O17 and the corner stone.',
          },
          then: [
            {
              c: 'W',
              at: 'P17',
              note: 'White hanes at P17. O17 can’t lean on the corner stone any more and has to look after itself.',
            },
            { c: 'B', at: 'N16', note: 'Black hanes at N16 so O17 isn’t sealed in.' },
            {
              c: 'W',
              at: 'P16',
              note: 'White connects at P16. White’s stones are solid, and O17 and N16 still need a base.',
            },
          ],
        },
      ],
    },
    {
      id: 'sansan33-third-line-approach',
      name: 'Approach on the third line',
      difficulty: 1,
      order: 97,
      line: [
        {
          c: 'W',
          at: 'O17',
          note: 'White approaches low, on the third line from the D16 side. It wants a base along the edge more than the center.',
        },
        { c: 'B', at: 'Q14', note: 'Black makes shape at Q14. The corner opens toward Q4, so White can’t shut it in.' },
        { c: 'W', at: 'L17', note: 'White extends two spaces along the third line. That’s room for a base.' },
        {
          c: 'B',
          at: 'tenuki',
          note: 'Black plays elsewhere. The corner and Q14 are safe, and White’s stones are settled.',
        },
      ],
    },
    {
      id: 'sansan33-far-approach',
      name: 'Far approach, Black plays elsewhere',
      difficulty: 1,
      order: 98,
      line: [
        {
          c: 'W',
          at: 'N16',
          note: 'White approaches from far off, on the fourth line. It’s a light move, more about the side than the corner.',
        },
        {
          c: 'B',
          at: 'tenuki',
          note: 'Black plays elsewhere. A 3-3 stone is already safe, so a far approach doesn’t need an answer.',
        },
        { c: 'W', at: 'Q16', note: 'White follows up with a shoulder hit. Any wall it builds now works with N16.' },
        {
          c: 'B',
          at: 'R16',
          note: 'Black pushes along the edge toward Q4, so the corner grows away from N16.',
          confidence: 'low',
        },
      ],
    },
    {
      id: 'sansan33-third-line-pincer',
      name: 'Approach on the third line, Black pincers',
      difficulty: 3,
      order: 99,
      line: [
        { c: 'W', at: 'O17', note: '' },
        {
          c: 'B',
          at: 'L17',
          note: 'Black pincers O17 from the D16 side, two spaces away on the third line. White can’t settle easily along the edge.',
        },
        {
          c: 'W',
          at: 'Q16',
          note: 'White answers the pincer with a shoulder hit on the corner. The new stones build a wall, so O17 isn’t alone.',
        },
        { c: 'B', at: 'R16', note: 'Black pushes along the edge toward Q4 for room.' },
        { c: 'W', at: 'Q14', note: 'White jumps to Q14 and keeps Black low.' },
        { c: 'B', at: 'R15', note: 'Black pushes once more along the edge for eye space.' },
        {
          c: 'W',
          at: 'O14',
          note: 'White plays O14. Its stones from O17 to Q14 hang together now, so L17 has nothing weak to attack.',
          confidence: 'low',
        },
        { c: 'B', at: 'R13', note: 'Black extends to R13, and the corner group has a solid base.' },
      ],
    },
    {
      id: 'sansan33-enclosure-shoulder-hit',
      name: 'Enclosure, shoulder hit reduction',
      difficulty: 2,
      order: 100,
      line: [
        { c: 'W', at: 'tenuki', note: 'White plays elsewhere first, so Black gets a second move here.' },
        {
          c: 'B',
          at: 'Q14',
          note: 'Black adds Q14, an enclosure with the 3-3 stone. The corner is secure, and Q14 faces the Q4 side.',
        },
        {
          c: 'W',
          at: 'P13',
          note: 'White reduces with a shoulder hit on Q14 from the center side. The aim is to keep Black’s area small, not to live inside it.',
        },
        { c: 'B', at: 'Q13', note: 'Black pushes toward Q4 and keeps that side.' },
        { c: 'W', at: 'P11', note: 'White jumps ahead toward Q4, and Black’s push stops here.' },
        {
          c: 'B',
          at: 'tenuki',
          note: 'Black plays elsewhere. Black has a solid corner, and White’s stones face the center.',
        },
      ],
    },
  ],
}
