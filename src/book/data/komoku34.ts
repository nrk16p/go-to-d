// 3-4 point (komoku), Black's corner stone on R16: third line from one edge, fourth from the other.
// The 4-3 orientation is the same family seen in a mirror, so it comes for free from board symmetry.
// Setup: even game. Black has D4; White has D16 and Q4, one on each side of the corner.
//
// Copy rules for notes (R13, R16): name the players and describe the move (no "you", no imperatives), and no
// absolute directions. Name points instead ("toward Q4", "on the D16 side"); the UI maps them through the
// board symmetry. "Under" in the Go sense (between the stones and the edge) is fine.
//
// Engine check: always re-run this family with `npx tsx tools/check-book.ts --family komoku34 --visits 800`.
// Nodes that need 800 visits:
// - The 3-3 attach in komoku34-pincer-33 (W:P17/B:N16/W:R17, an `alternative`) measured 1.71, 1.59, 1.51 and 1.59
//   in four 800-visit runs; at 400 visits it can land anywhere from about 1.7 to 2.3 and get flagged.
// - White's hane under in komoku34-attach-extend (W:P17/B:Q17/W:Q18, a `mistake`) measured 1.90 and 1.98 at
//   800 visits and 2.11 at 400, so it sits about 0.4 above the 1.5 a mistake needs.
// The trick in komoku34-cut-trick (B:P16, 1.8-2.0) is not judged by the check.

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

    // ---- Phase 2 (orders 52-92) ----

    {
      id: 'komoku34-attach-extend',
      name: "Small knight's approach, attach, White extends",
      difficulty: 1,
      order: 52,
      line: [
        { c: 'W', at: 'P17', note: '' },
        { c: 'B', at: 'Q17', note: '' },
        {
          c: 'W',
          at: 'P16',
          note: 'White extends to P16 instead of playing the hane at Q16. There’s nothing to cut, and both stones face the center.',
        },
        {
          c: 'B',
          at: 'R14',
          note: 'Black jumps to R14 for a base toward Q4. The corner is settled, and White can play elsewhere.',
        },
      ],
      branches: [
        {
          after: 2,
          move: {
            c: 'W',
            at: 'Q18',
            kind: 'mistake',
            note: 'White hanes under at Q18. It grabs a little edge, but Black gets the hane at P16 and White ends up low.',
          },
          then: [
            {
              c: 'B',
              at: 'P16',
              note: 'Black hanes at the head of P17. White’s stones are stuck on the edge with few liberties, and Black faces the center.',
            },
          ],
        },
      ],
    },
    {
      id: 'komoku34-drawback-tenuki',
      name: 'Attach and draw back, White plays elsewhere',
      difficulty: 2,
      order: 53,
      line: [
        { c: 'W', at: 'P17', note: '' },
        { c: 'B', at: 'Q17', note: '' },
        { c: 'W', at: 'Q16', note: '' },
        { c: 'B', at: 'R17', note: '' },
        {
          c: 'W',
          at: 'tenuki',
          note: 'White leaves the cut at P16 and plays elsewhere. Q16 is only one stone, so White can afford to lose it.',
        },
        {
          c: 'B',
          at: 'Q15',
          note: 'Black ataris Q16 from the center side. Q16 is down to one liberty, and Black’s corner is thick whatever White does.',
        },
      ],
      branches: [
        {
          after: 3,
          move: {
            c: 'B',
            at: 'R14',
            kind: 'mistake',
            note: 'Black extends before drawing back. The cut at R17 is still open, and White takes it.',
          },
          then: [
            { c: 'W', at: 'R17', note: 'White cuts at R17. Q17 is in atari, and R16 is cut off from it.' },
            { c: 'B', at: 'Q18', note: 'Black extends to Q18. Losing Q17 here would hand White the corner.' },
            { c: 'W', at: 'P16', note: 'White connects, so Black has no cut to fight back with.' },
            { c: 'B', at: 'P18', note: 'Black crawls along the edge to give Q17 some room.' },
            {
              c: 'W',
              at: 'R15',
              note: 'White cuts again at R15, and R16 is in atari. Black is in three weak pieces.',
            },
          ],
        },
      ],
    },
    {
      id: 'komoku34-attach-atari',
      name: 'Attach, hane, Black ataris from the center side',
      difficulty: 2,
      order: 54,
      line: [
        { c: 'W', at: 'P17', note: '' },
        { c: 'B', at: 'Q17', note: '' },
        { c: 'W', at: 'Q16', note: '' },
        {
          c: 'B',
          at: 'Q15',
          note: 'Black ataris Q16 at once instead of drawing back. Q16 is down to one liberty.',
        },
        { c: 'W', at: 'P16', note: 'White connects. Losing Q16 now would leave P17 alone.' },
        {
          c: 'B',
          at: 'R17',
          note: 'Black fixes the corner. A White stone on R17 would put Q17 in atari.',
        },
        {
          c: 'W',
          at: 'N16',
          note: 'White jumps to N16 to make shape on the D16 side. Both groups are settled for now.',
        },
      ],
    },
    {
      id: 'komoku34-diagonal-shoulder',
      name: "Small knight's approach, diagonal move, shoulder hit",
      difficulty: 1,
      order: 55,
      line: [
        { c: 'W', at: 'P17', note: '' },
        {
          c: 'B',
          at: 'Q15',
          note: 'Black plays diagonally to Q15. It takes the point White wants for pressing, and engines like it a lot.',
        },
        {
          c: 'W',
          at: 'M17',
          note: 'White extends two spaces along the third line toward D16 for a base.',
        },
        {
          c: 'B',
          at: 'O16',
          note: 'Black hits P17 on the shoulder from the center side. White stays low and Black faces the center.',
        },
        {
          c: 'W',
          at: 'O17',
          note: 'White links P17 toward M17 along the third line. The base is safe, but it’s low.',
        },
      ],
    },
    {
      id: 'komoku34-diagonal-tenuki',
      name: "Small knight's approach, diagonal move, Black plays elsewhere",
      difficulty: 1,
      order: 56,
      line: [
        { c: 'W', at: 'P17', note: '' },
        { c: 'B', at: 'Q15', note: '' },
        { c: 'W', at: 'M17', note: '' },
        {
          c: 'B',
          at: 'tenuki',
          note: 'Black plays elsewhere. R16 and Q15 already hold the corner, and White’s base is settled too.',
        },
      ],
    },
    {
      id: 'komoku34-knight',
      name: "Small knight's approach, knight's move answer",
      difficulty: 1,
      order: 57,
      line: [
        { c: 'W', at: 'P17', note: '' },
        {
          c: 'B',
          at: 'Q14',
          note: 'Black answers with a knight’s move toward Q4. The corner and that side stay Black’s.',
        },
        {
          c: 'W',
          at: 'L16',
          note: 'White makes a wide extension to L16 to settle on the D16 side.',
        },
        {
          c: 'B',
          at: 'tenuki',
          note: 'Black plays elsewhere. R16 and Q14 already hold the corner and that side, so nothing here is urgent.',
        },
      ],
    },
    {
      id: 'komoku34-low-pincer-jump',
      name: "Small knight's approach, one-space low pincer, White jumps out",
      difficulty: 2,
      order: 58,
      line: [
        { c: 'W', at: 'P17', note: '' },
        {
          c: 'B',
          at: 'N17',
          note: 'Black pincers one space away on the third line. P17 can’t settle along the edge toward D16.',
        },
        {
          c: 'W',
          at: 'P14',
          note: 'White jumps two spaces toward the center. Running out is easier than living with the pincer there.',
        },
        {
          c: 'B',
          at: 'R14',
          note: 'Black takes a base toward Q4 before P14 can reach that side.',
        },
        {
          c: 'W',
          at: 'L17',
          note: 'White pincers N17 from the D16 side. Now the pincer stone is the one under attack.',
        },
        {
          c: 'B',
          at: 'tenuki',
          note: 'Black plays elsewhere. N17 is hard to kill, so there is no rush.',
          confidence: 'low',
        },
      ],
    },
    {
      id: 'komoku34-low-pincer-knight',
      name: "Small knight's approach, one-space low pincer, knight's move out",
      difficulty: 2,
      order: 59,
      line: [
        { c: 'W', at: 'P17', note: '' },
        { c: 'B', at: 'N17', note: '' },
        {
          c: 'W',
          at: 'O15',
          note: 'White heads for the center with a knight’s move from P17.',
        },
        {
          c: 'B',
          at: 'Q15',
          note: 'Black takes Q15 before White can press there. The corner stays big.',
        },
        {
          c: 'W',
          at: 'M16',
          note: 'White hits N17 on the shoulder from the center side, so N17 stays on the third line.',
        },
        {
          c: 'B',
          at: 'M17',
          note: 'Black extends along the third line so N17 has room. White keeps pressing from the center side.',
        },
      ],
    },
    {
      id: 'komoku34-high-pincer-jump',
      name: "Small knight's approach, one-space high pincer, White jumps out",
      difficulty: 2,
      order: 60,
      line: [
        { c: 'W', at: 'P17', note: '' },
        { c: 'B', at: 'N16', note: '' },
        {
          c: 'W',
          at: 'P15',
          note: 'White jumps one space toward the center. N16 sits on the fourth line, so a base along the edge is hard.',
        },
        {
          c: 'B',
          at: 'Q14',
          note: 'Black makes a knight’s move toward Q4. The corner has its base, and P15 can’t come in.',
        },
        {
          c: 'W',
          at: 'K16',
          note: 'White pincers N16 from the D16 side. White’s group is out, and N16 is the weak stone now.',
        },
        {
          c: 'B',
          at: 'tenuki',
          note: 'Black plays elsewhere. N16 is light and hard to attack, so there is no rush.',
          confidence: 'low',
        },
      ],
    },
    {
      id: 'komoku34-two-low-pincer',
      name: "Small knight's approach, two-space low pincer, White jumps out",
      difficulty: 2,
      order: 61,
      line: [
        { c: 'W', at: 'P17', note: '' },
        {
          c: 'B',
          at: 'M17',
          note: 'Black pincers two spaces away on the third line. White gets a little more room, but M17 is harder to attack.',
        },
        {
          c: 'W',
          at: 'P14',
          note: 'White jumps two spaces toward the center instead of living small along the edge.',
        },
        { c: 'B', at: 'R14', note: 'Black takes the base toward Q4 first.' },
        {
          c: 'W',
          at: 'Q15',
          note: 'White hits R16 on the shoulder and the stones head for the center.',
        },
        {
          c: 'B',
          at: 'R17',
          note: 'Black takes the 3-3 point. The corner is safe enough for now.',
        },
        {
          c: 'W',
          at: 'tenuki',
          note: 'White plays elsewhere. Its stones are out in the center, and nothing here needs a move yet.',
        },
      ],
    },
    {
      id: 'komoku34-two-high-pincer',
      name: "Small knight's approach, two-space high pincer, White jumps out",
      difficulty: 2,
      order: 62,
      line: [
        { c: 'W', at: 'P17', note: '' },
        {
          c: 'B',
          at: 'M16',
          note: 'Black pincers two spaces away on the fourth line. It aims more at the center than at the edge.',
        },
        {
          c: 'W',
          at: 'P14',
          note: 'White jumps two spaces toward the center. M16 leaves too little room for a base along the edge.',
        },
        { c: 'B', at: 'R14', note: 'Black extends to R14 and keeps the side toward Q4.' },
        {
          c: 'W',
          at: 'Q15',
          note: 'White hits R16 on the shoulder and keeps building toward the center.',
        },
        {
          c: 'B',
          at: 'R17',
          note: 'Black takes the 3-3 point. The corner is safe enough for now.',
        },
        {
          c: 'W',
          at: 'K17',
          note: 'White approaches M16 from the D16 side. The pincer stone has to look after itself now.',
        },
      ],
    },
    {
      id: 'komoku34-tenuki-second-approach',
      name: "Small knight's approach, tenuki, White approaches from the other side",
      difficulty: 2,
      order: 63,
      line: [
        { c: 'W', at: 'P17', note: '' },
        { c: 'B', at: 'tenuki', note: '' },
        {
          c: 'W',
          at: 'Q13',
          note: 'White approaches again, this time from the Q4 side. R16 has a White stone on each side now.',
        },
        {
          c: 'B',
          at: 'Q15',
          note: 'Black plays diagonally to Q15, between the two White stones, so neither can press Black low.',
        },
        {
          c: 'W',
          at: 'N16',
          note: 'White makes shape for P17 with a knight’s move toward the center.',
        },
        {
          c: 'B',
          at: 'Q17',
          note: 'Black takes the corner on the P17 side. Black has a base, and Q15 keeps the way to the center open.',
        },
      ],
    },
    {
      id: 'komoku34-cut-trick',
      name: "Attach and hane, Black's cutting trick and White's calm answer",
      difficulty: 2,
      order: 65,
      line: [
        { c: 'W', at: 'P17', note: '' },
        { c: 'B', at: 'Q17', note: '' },
        { c: 'W', at: 'Q16', note: '' },
        {
          c: 'B',
          at: 'P16',
          kind: 'trick',
          note: 'Black cuts at P16. It’s a trick: Q16 is in atari, and Black hopes White ataris the cutting stone instead.',
        },
        {
          c: 'W',
          at: 'Q15',
          note: 'White just extends Q16 to Q15. Now P16 is the stone in trouble, with two liberties.',
        },
        {
          c: 'B',
          at: 'R17',
          note: 'Black has to fix the corner first. A White stone on R17 would put Q17 in atari.',
        },
        {
          c: 'W',
          at: 'O17',
          note: 'White extends P17 as well. Both White groups are safe, and P16 is stuck between them.',
        },
      ],
      branches: [
        {
          after: 4,
          move: {
            c: 'W',
            at: 'O16',
            kind: 'mistake',
            note: 'White ataris P16 and forgets that Q16 is the stone in atari.',
          },
          then: [
            {
              c: 'B',
              at: 'Q15',
              note: 'Black captures Q16. The corner is solid, and White’s P17 and O16 are thin.',
            },
          ],
        },
      ],
    },
    {
      id: 'komoku34-diagonal-other-side',
      name: "Diagonal move, White approaches on the other side",
      difficulty: 3,
      order: 66,
      line: [
        { c: 'W', at: 'P17', note: '' },
        { c: 'B', at: 'Q15', note: '' },
        {
          c: 'W',
          at: 'R12',
          note: 'White leaves P17 and approaches on the Q4 side. Black has two White stones to deal with.',
        },
        {
          c: 'B',
          at: 'O16',
          note: 'Black hits P17 on the shoulder first. Pressing it low builds a wall facing the center.',
        },
        { c: 'W', at: 'O17', note: 'White stays on the third line to keep a base.' },
        { c: 'B', at: 'N16', note: 'Black pushes once more on the fourth line, and the wall gets longer.' },
        { c: 'W', at: 'M17', note: 'White extends along the third line. The group on the D16 side is settled.' },
        {
          c: 'B',
          at: 'R10',
          note: 'Black pincers R12 from the Q4 side. R12 has to run toward the center.',
          confidence: 'low',
        },
      ],
    },
    {
      id: 'komoku34-knight-other-side',
      name: "Knight's move answer, White approaches on the other side",
      difficulty: 2,
      order: 67,
      line: [
        { c: 'W', at: 'P17', note: '' },
        { c: 'B', at: 'Q14', note: '' },
        {
          c: 'W',
          at: 'R12',
          note: 'White approaches on the Q4 side, a knight’s move from Q14. It takes away part of Black’s base.',
        },
        {
          c: 'B',
          at: 'N17',
          note: 'Black turns and pincers P17. Now both White stones need help, and White can only help one at a time.',
        },
        {
          c: 'W',
          at: 'O16',
          note: 'White moves P17 out with a diagonal step toward the center.',
        },
      ],
    },
    {
      id: 'komoku34-low-pincer-shoulder',
      name: 'One-space low pincer, White hits the shoulder',
      difficulty: 3,
      order: 68,
      line: [
        { c: 'W', at: 'P17', note: '' },
        { c: 'B', at: 'N17', note: '' },
        {
          c: 'W',
          at: 'Q15',
          note: 'White ignores the pincer and hits R16 on the shoulder. It goes after the corner first.',
        },
        { c: 'B', at: 'Q16', note: 'Black pushes at Q16, between White’s two stones.' },
        { c: 'W', at: 'P16', note: 'White blocks at P16 and connects to P17.' },
        { c: 'B', at: 'P15', note: 'Black cuts at P15. Q15 is now separated from P16.' },
        { c: 'W', at: 'O15', note: 'White ataris P15 from the D16 side.' },
        {
          c: 'B',
          at: 'P14',
          note: 'Black extends out of atari. Q15 has only two liberties now.',
        },
        {
          c: 'W',
          at: 'N16',
          note: 'White guards the cut at O16 and leans on N17 at the same time. Q15 still has two liberties.',
        },
      ],
    },
    {
      id: 'komoku34-high-pincer-knight',
      name: "One-space high pincer, White's knight's move out",
      difficulty: 2,
      order: 69,
      line: [
        { c: 'W', at: 'P17', note: '' },
        { c: 'B', at: 'N16', note: '' },
        {
          c: 'W',
          at: 'O15',
          note: 'White heads for the center with a knight’s move, past the N16 stone.',
        },
        {
          c: 'B',
          at: 'Q15',
          note: 'Black takes Q15, the point White would use to press the corner.',
        },
        { c: 'W', at: 'N15', note: 'White extends to N15 and blocks N16 from the center side.' },
        {
          c: 'B',
          at: 'L16',
          note: 'Black jumps along the fourth line toward D16, so N16 isn’t sealed in.',
        },
      ],
    },
    {
      id: 'komoku34-two-high-pincer-jump',
      name: "Two-space high pincer, White's diagonal jump",
      difficulty: 3,
      order: 70,
      line: [
        { c: 'W', at: 'P17', note: '' },
        { c: 'B', at: 'M16', note: '' },
        {
          c: 'W',
          at: 'N15',
          note: 'White jumps diagonally to N15. It runs toward the center and leans on M16 at the same time.',
        },
        { c: 'B', at: 'Q14', note: 'Black takes a base with a knight’s move toward Q4.' },
        {
          c: 'W',
          at: 'R12',
          note: 'White approaches on the Q4 side to shrink Black’s base.',
        },
        {
          c: 'B',
          at: 'P13',
          note: 'Black jumps to P13, between R12 and N15, so the two White groups can’t join easily.',
          confidence: 'low',
        },
      ],
    },
    {
      id: 'komoku34-extend-press-tenuki',
      name: 'Attach and extend, White presses from the center side',
      difficulty: 1,
      order: 71,
      line: [
        { c: 'W', at: 'P17', note: '' },
        { c: 'B', at: 'Q17', note: '' },
        { c: 'W', at: 'P16', note: '' },
        { c: 'B', at: 'R14', note: '' },
        {
          c: 'W',
          at: 'P13',
          note: 'White plays P13 to keep R14 from growing toward the center.',
        },
        {
          c: 'B',
          at: 'tenuki',
          note: 'Black plays elsewhere. The group already has its base, so P13 is no threat yet.',
        },
      ],
    },
    {
      id: 'komoku34-two-low-pincer-shoulder',
      name: 'Two-space low pincer, White hits the shoulder',
      difficulty: 3,
      order: 72,
      line: [
        { c: 'W', at: 'P17', note: '' },
        { c: 'B', at: 'M17', note: '' },
        {
          c: 'W',
          at: 'N16',
          note: 'White hits M17 on the shoulder. It leans on the pincer instead of running.',
        },
        { c: 'B', at: 'M16', note: 'Black pushes at M16.' },
        { c: 'W', at: 'M15', note: 'White hanes at the head of M16.' },
        {
          c: 'B',
          at: 'L15',
          note: 'Black answers with a hane at the head of M15. M15 has only two liberties.',
        },
        {
          c: 'W',
          at: 'N17',
          note: 'White pushes in at N17 and keeps M17 apart from the corner. Black’s pincer group has to look after itself.',
          confidence: 'low',
        },
      ],
    },
    {
      id: 'komoku34-tenuki-lean-attach',
      name: "Small knight's approach, tenuki, Black attaches after the lean",
      difficulty: 2,
      order: 64,
      line: [
        { c: 'W', at: 'P17', note: '' },
        { c: 'B', at: 'tenuki', note: '' },
        { c: 'W', at: 'Q15', note: '' },
        {
          c: 'B',
          at: 'Q17',
          note: 'Black attaches at Q17 and takes the corner first. R15 is the other good answer to the lean.',
        },
        {
          c: 'W',
          at: 'P18',
          note: 'White blocks at P18 on the edge side, so Black can’t slide toward D16.',
        },
        {
          c: 'B',
          at: 'R15',
          note: 'Black extends under Q15 toward Q4 to make the base wider.',
        },
        { c: 'W', at: 'Q14', note: 'White presses again and keeps Black on the third line.' },
        {
          c: 'B',
          at: 'R13',
          note: 'Black jumps to R13. The group has room for eyes, and White has a wall facing the center.',
        },
      ],
    },
    {
      id: 'komoku34-high-hanging-peep',
      name: 'One-space high approach, hanging connection, Black peeps',
      difficulty: 2,
      order: 73,
      line: [
        { c: 'W', at: 'P16', note: '' },
        { c: 'B', at: 'P17', note: '' },
        { c: 'W', at: 'O17', note: '' },
        { c: 'B', at: 'Q17', note: '' },
        {
          c: 'W',
          at: 'N16',
          note: 'White plays the hanging connection at N16. It’s looser than O16 and reaches further toward D16.',
        },
        {
          c: 'B',
          at: 'O15',
          note: 'Black peeps at O15, next to the cut point at O16. White will connect, and O15 stays as a foothold toward the center.',
        },
        {
          c: 'W',
          at: 'O16',
          note: 'White connects. A Black stone on O16 would cut P16 off.',
        },
        {
          c: 'B',
          at: 'Q14',
          note: 'Black jumps to Q14 toward Q4. The group has its base, and O15 keeps an eye on the center.',
        },
      ],
      branches: [
        {
          after: 3,
          move: {
            c: 'B',
            at: 'O18',
            kind: 'mistake',
            note: 'Black hanes under at O18 instead of drawing back. That leaves the cut at Q17 open.',
          },
          then: [
            { c: 'W', at: 'Q17', note: 'White cuts at Q17, and P17 is in atari.' },
            { c: 'B', at: 'P18', note: 'Black connects at P18 to save P17.' },
            {
              c: 'W',
              at: 'Q16',
              note: 'White connects and splits Black in two. The stones on the edge are weak, and R16 is cut off from them.',
            },
          ],
        },
      ],
    },
    {
      id: 'komoku34-high-hanging-tenuki',
      name: 'One-space high approach, hanging connection, Black plays elsewhere',
      difficulty: 1,
      order: 74,
      line: [
        { c: 'W', at: 'P16', note: '' },
        { c: 'B', at: 'P17', note: '' },
        { c: 'W', at: 'O17', note: '' },
        { c: 'B', at: 'Q17', note: '' },
        { c: 'W', at: 'N16', note: '' },
        {
          c: 'B',
          at: 'tenuki',
          note: 'Black plays elsewhere. The corner is settled, and the peep at O15 can wait.',
        },
      ],
    },
    {
      id: 'komoku34-high-attach-poke',
      name: 'One-space high approach, attach underneath, White pokes between the stones',
      difficulty: 1,
      order: 75,
      line: [
        { c: 'W', at: 'P16', note: '' },
        { c: 'B', at: 'P17', note: '' },
        { c: 'W', at: 'O17', note: '' },
        { c: 'B', at: 'Q17', note: '' },
        { c: 'W', at: 'O16', note: '' },
        { c: 'B', at: 'R14', note: '' },
        {
          c: 'W',
          at: 'Q15',
          note: 'White pokes at Q15 and threatens to push in between R16 and R14.',
        },
        {
          c: 'B',
          at: 'R15',
          note: 'Black connects at R15. R16, R15 and R14 now make one solid line along the edge.',
        },
        {
          c: 'W',
          at: 'tenuki',
          note: 'White plays elsewhere. Q15 adds to White’s wall, and Black’s corner needs nothing more.',
        },
      ],
    },
    {
      id: 'komoku34-high-diagonal',
      name: 'One-space high approach, diagonal move toward the edge',
      difficulty: 1,
      order: 76,
      line: [
        { c: 'W', at: 'P16', note: '' },
        {
          c: 'B',
          at: 'Q17',
          note: 'Black plays the diagonal move to Q17. It’s a low, safe answer that keeps the corner.',
        },
        {
          c: 'W',
          at: 'P17',
          note: 'White blocks at P17 so Black can’t slide toward D16.',
        },
        {
          c: 'B',
          at: 'R14',
          note: 'Black extends to R14. Black has the corner and a base, White has the outside.',
        },
      ],
    },
    {
      id: 'komoku34-high-low-extension',
      name: 'One-space high approach, Black extends low, White takes the 3-3 point',
      difficulty: 2,
      order: 77,
      line: [
        { c: 'W', at: 'P16', note: '' },
        {
          c: 'B',
          at: 'R14',
          note: 'Black leaves P16 alone and takes a base toward Q4 with R14.',
        },
        {
          c: 'W',
          at: 'R17',
          note: 'White attaches at the 3-3 point. Black took the side, so White goes for the corner.',
        },
        {
          c: 'B',
          at: 'S17',
          note: 'Black hanes underneath at S17 so White can’t take the whole corner.',
        },
        {
          c: 'W',
          at: 'Q17',
          note: 'White extends to Q17. It links with P16 and takes the edge on the D16 side.',
        },
        {
          c: 'B',
          at: 'S18',
          note: 'Black adds S18 so White can’t hane on the edge.',
          confidence: 'low',
        },
      ],
    },
    {
      id: 'komoku34-high-outside-attach',
      name: 'One-space high approach, outside attach',
      difficulty: 2,
      order: 78,
      line: [
        { c: 'W', at: 'P16', note: '' },
        {
          c: 'B',
          at: 'P15',
          note: 'Black attaches on the center side of P16. Black builds toward the center and lets White have the side.',
        },
        {
          c: 'W',
          at: 'O15',
          note: 'White hanes at O15, on the D16 side of P15.',
        },
        {
          c: 'B',
          at: 'Q15',
          note: 'Black extends to Q15. P15 and Q15 make a wall next to R16.',
        },
        {
          c: 'W',
          at: 'O16',
          note: 'White connects at O16. Without it, a Black cut there would leave P16 alone.',
        },
        {
          c: 'B',
          at: 'Q17',
          note: 'Black takes Q17 and keeps the corner. White has the D16 side, Black has the corner and a wall.',
        },
      ],
    },
    {
      id: 'komoku34-high-tenuki-33',
      name: 'One-space high approach, tenuki, White takes the 3-3 point',
      difficulty: 2,
      order: 79,
      line: [
        { c: 'W', at: 'P16', note: '' },
        {
          c: 'B',
          at: 'tenuki',
          note: 'Black plays elsewhere. One high stone doesn’t threaten the corner much yet.',
        },
        {
          c: 'W',
          at: 'R17',
          note: 'White attaches at the 3-3 point to take the corner while Black is away.',
        },
        {
          c: 'B',
          at: 'S17',
          note: 'Black hanes underneath at S17 to keep part of the corner.',
        },
        {
          c: 'W',
          at: 'Q17',
          note: 'White extends to Q17 and links toward P16. The edge on the D16 side is White’s.',
        },
        {
          c: 'B',
          at: 'R14',
          note: 'Black extends toward Q4 so R16 has a base along that side.',
        },
      ],
    },
    {
      id: 'komoku34-high-attach-push',
      name: 'One-space high approach, attach underneath, White pushes later',
      difficulty: 1,
      order: 80,
      line: [
        { c: 'W', at: 'P16', note: '' },
        { c: 'B', at: 'P17', note: '' },
        { c: 'W', at: 'O17', note: '' },
        { c: 'B', at: 'Q17', note: '' },
        { c: 'W', at: 'O16', note: '' },
        { c: 'B', at: 'R14', note: '' },
        {
          c: 'W',
          at: 'Q16',
          note: 'White pushes at Q16. It threatens to cut at R17, where Q17 and R16 meet.',
        },
        {
          c: 'B',
          at: 'R17',
          note: 'Black connects at R17, and the corner is one solid group.',
        },
        {
          c: 'W',
          at: 'tenuki',
          note: 'White plays elsewhere. Q16 made the wall thicker, and Black’s corner is safe.',
        },
      ],
    },
    {
      id: 'komoku34-high-tenuki-side',
      name: 'One-space high approach, tenuki, White attaches on the side',
      difficulty: 2,
      order: 82,
      line: [
        { c: 'W', at: 'P16', note: '' },
        { c: 'B', at: 'tenuki', note: '' },
        {
          c: 'W',
          at: 'R15',
          note: 'White attaches to R16 on the Q4 side. It takes away Black’s base along that side.',
        },
        {
          c: 'B',
          at: 'S15',
          note: 'Black hanes under R15 at S15 and keeps the edge.',
        },
        {
          c: 'W',
          at: 'Q15',
          note: 'White stands at Q15 and builds a wall facing the center.',
        },
        {
          c: 'B',
          at: 'S14',
          note: 'Black extends along the edge. White still has the 3-3 point to aim at, so the corner isn’t settled yet.',
          confidence: 'low',
        },
      ],
    },
  ],
}
