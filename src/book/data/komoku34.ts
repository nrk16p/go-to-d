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
          note: 'White extends to P16 instead of haning. There’s nothing to cut, and both stones face the center.',
        },
        {
          c: 'B',
          at: 'R14',
          note: 'Black jumps to R14 for a base toward Q4. The corner is settled, and White can play elsewhere.',
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
          note: 'Black ataris Q16 from the center side. It’s down to one liberty, and Black’s corner is thick either way.',
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
          note: 'Black ataris Q16 right away instead of drawing back. Q16 is down to one liberty.',
        },
        { c: 'W', at: 'P16', note: 'White connects. Losing Q16 now would leave P17 crushed.' },
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
          note: 'Black plays elsewhere. R16 and Q14 make a solid shape, so nothing here is urgent.',
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
          note: 'White jumps two spaces toward the center. Running out is easier than living under the pincer.',
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
          note: 'Black plays elsewhere. N17 has done its job, so Black doesn’t mind if White takes it.',
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
          note: 'White hits N17 on the shoulder from the center side, so the pincer has to stay low.',
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
          note: 'Black plays elsewhere. N16 is light: if White attacks it, Black can give it up.',
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
          note: 'White hits R16 on the shoulder. Its stones face the center and the M17 pincer.',
        },
        {
          c: 'B',
          at: 'R17',
          note: 'Black takes the 3-3 point. The corner can’t be attacked now.',
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
          note: 'Black takes the 3-3 point, so White can’t get into the corner.',
        },
        {
          c: 'W',
          at: 'K17',
          note: 'White approaches M16 from the D16 side. The pincer stone has to look after itself now.',
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
          note: 'Black attaches at Q17 and takes the corner first. It’s the other answer to the lean, next to R15.',
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
      // The "Black tenukis a second time" mistake branch was removed in Task 13b: at 800 visits its loss
      // swung between 1.52 and 1.12 (it depends on which outside move replaces the first tenuki), so it
      // couldn't hold the 1.5 floor for a mistake.
    },

    // ---- Two-space approaches (orders 83-92) ----

    {
      id: 'komoku34-two-high-knight',
      name: "Two-space high approach, knight's move answer",
      difficulty: 1,
      order: 83,
      line: [
        {
          c: 'W',
          at: 'O16',
          note: 'The two-space high approach. O16 is far from R16, so it’s hard to attack, but it doesn’t press the corner much either.',
        },
        {
          c: 'B',
          at: 'Q14',
          note: 'Black makes a knight’s move toward Q4. The corner and that side stay Black’s.',
        },
        {
          c: 'W',
          at: 'L16',
          note: 'White extends two spaces toward D16 and gets a base. O16 is safe now.',
        },
        {
          c: 'B',
          at: 'tenuki',
          note: 'Black plays elsewhere. Both groups are settled.',
        },
      ],
      branches: [
        {
          after: 1,
          move: {
            c: 'B',
            at: 'O17',
            kind: 'mistake',
            note: 'Black attaches under O16, as it would against the one-space high approach. Here O17 is too far from R16, and a White hane at P17 cuts the two apart.',
          },
          then: [
            { c: 'W', at: 'P17', note: 'White hanes at P17, between O17 and the corner. O17 can’t reach R16 now.' },
            { c: 'B', at: 'N16', note: 'Black hanes at N16 to give O17 some room toward D16.' },
            { c: 'W', at: 'P16', note: 'White connects at P16, and its stones become a solid wall.' },
            {
              c: 'B',
              at: 'N17',
              note: 'Black connects at N17. The three stones are safe, but they’re low and small.',
            },
            {
              c: 'W',
              at: 'N15',
              note: 'White blocks N16 from the center side. White’s wall faces the center, and R16 is alone in the corner.',
            },
          ],
        },
      ],
    },
    {
      id: 'komoku34-two-high-side-approach',
      name: "Two-space high approach, knight's move, White approaches the other side",
      difficulty: 2,
      order: 84,
      line: [
        { c: 'W', at: 'O16', note: '' },
        { c: 'B', at: 'Q14', note: '' },
        {
          c: 'W',
          at: 'R12',
          note: 'White approaches on the Q4 side, a knight’s move from Q14, before Black’s side gets any bigger.',
        },
        {
          c: 'B',
          at: 'Q17',
          note: 'Black closes the corner with Q17. White can’t slide in anymore.',
        },
        {
          c: 'W',
          at: 'P13',
          note: 'White hits Q14 on the shoulder from the center side. P13 works with both O16 and R12.',
        },
        { c: 'B', at: 'P14', note: 'Black pushes at P14 so White can’t seal Q14 in.' },
        {
          c: 'W',
          at: 'K17',
          note: 'White extends to K17 toward D16 and gives O16 a base. Black has the corner, White has the D16 side.',
        },
      ],
    },
    {
      id: 'komoku34-two-high-diagonal',
      name: 'Two-space high approach, diagonal move',
      difficulty: 1,
      order: 85,
      line: [
        { c: 'W', at: 'O16', note: '' },
        {
          c: 'B',
          at: 'Q17',
          note: 'Black plays the diagonal move to Q17. The corner is closed, so White turns to the outside.',
        },
        {
          c: 'W',
          at: 'Q15',
          note: 'White hits R16 on the shoulder. With O16 close by, White builds a wall facing the center.',
        },
        { c: 'B', at: 'R15', note: 'Black pushes along the third line toward Q4 for more room.' },
        {
          c: 'W',
          at: 'Q13',
          note: 'White jumps ahead to Q13 instead of pushing again. Black has the corner, White has the center.',
        },
        {
          c: 'B',
          at: 'tenuki',
          note: 'Black plays elsewhere. The corner is alive and needs nothing more for now.',
        },
      ],
    },
    {
      id: 'komoku34-two-high-undercut',
      name: 'Two-space high approach, Black takes the edge',
      difficulty: 2,
      order: 86,
      line: [
        { c: 'W', at: 'O16', note: '' },
        {
          c: 'B',
          at: 'P17',
          note: 'Black makes a knight’s move to P17, along the edge toward O16. It takes the edge before White can slide in.',
        },
        { c: 'W', at: 'O17', note: 'White blocks at O17 so Black can’t go further along the edge.' },
        {
          c: 'B',
          at: 'P16',
          note: 'Black extends to P16. A White stone there would split P17 from R16.',
        },
        { c: 'W', at: 'O15', note: 'White extends to O15, and its stones face the center.' },
        {
          c: 'B',
          at: 'Q13',
          note: 'Black takes a high base toward Q4 with Q13. Black has the corner and that side, White has the outside.',
        },
      ],
    },
    {
      id: 'komoku34-two-high-tenuki-33',
      name: 'Two-space high approach, tenuki, White takes the 3-3 point',
      difficulty: 3,
      order: 87,
      line: [
        { c: 'W', at: 'O16', note: '' },
        {
          c: 'B',
          at: 'tenuki',
          note: 'Black plays elsewhere. O16 is far off, and a big point elsewhere is worth more for now.',
        },
        {
          c: 'W',
          at: 'R17',
          note: 'White attaches at the 3-3 point, under R16. White wants the corner itself.',
        },
        {
          c: 'B',
          at: 'S17',
          note: 'Black hanes at S17. White can’t go toward Q4, so it has to live on the D16 side.',
        },
        { c: 'W', at: 'Q16', note: 'White hanes at Q16. R16 is down to two liberties.' },
        {
          c: 'B',
          at: 'Q15',
          note: 'Black hanes at Q15, at the head of Q16. White can’t come any closer to Q4.',
        },
        { c: 'W', at: 'Q17', note: 'White connects at Q17, and its corner stones become one group.' },
        {
          c: 'B',
          at: 'S15',
          note: 'Black covers the cut at R15. A White stone there would now be captured at once.',
        },
        {
          c: 'W',
          at: 'P15',
          note: 'White hanes at P15 and links toward O16. Black’s wall can’t grow on that side.',
        },
        {
          c: 'B',
          at: 'Q14',
          note: 'Black extends to Q14 and keeps Q15 safe. White has the corner, and Black’s wall faces Q4.',
        },
      ],
    },
    {
      id: 'komoku34-two-low-diagonal',
      name: 'Two-space low approach, diagonal move, shoulder hit',
      difficulty: 1,
      order: 88,
      line: [
        {
          c: 'W',
          at: 'O17',
          note: 'The two-space low approach. On the third line, it aims at a base along the edge more than at the corner.',
        },
        {
          c: 'B',
          at: 'Q17',
          note: 'Black plays the diagonal move to Q17 and closes the corner.',
        },
        {
          c: 'W',
          at: 'Q15',
          note: 'White hits R16 on the shoulder from the center side instead of settling O17 first.',
        },
        { c: 'B', at: 'R15', note: 'Black pushes along the third line toward Q4.' },
        {
          c: 'W',
          at: 'Q13',
          note: 'White jumps to Q13. Black has a small, solid corner, and White has a wall facing the center.',
        },
        {
          c: 'B',
          at: 'tenuki',
          note: 'Black plays elsewhere. The corner is settled, and nothing here needs a move yet.',
        },
      ],
    },
    {
      id: 'komoku34-two-low-extend',
      name: 'Two-space low approach, diagonal move, White extends',
      difficulty: 1,
      order: 89,
      line: [
        { c: 'W', at: 'O17', note: '' },
        { c: 'B', at: 'Q17', note: '' },
        {
          c: 'W',
          at: 'L17',
          note: 'White extends two spaces along the third line toward D16. O17 has a base now.',
        },
        {
          c: 'B',
          at: 'tenuki',
          note: 'Black plays elsewhere. The corner is closed, and White’s group is settled.',
        },
      ],
    },
    {
      id: 'komoku34-two-low-shoulder',
      name: 'Two-space low approach, shoulder hit',
      difficulty: 2,
      order: 90,
      line: [
        { c: 'W', at: 'O17', note: '' },
        {
          c: 'B',
          at: 'P16',
          note: 'Black hits O17 on the shoulder from the center side. White stays low, and Black faces the center.',
        },
        { c: 'W', at: 'O16', note: 'White pushes at O16, against P16.' },
        {
          c: 'B',
          at: 'P17',
          note: 'Black blocks at P17 so White can’t crawl into the corner along the edge.',
        },
        {
          c: 'W',
          at: 'O15',
          note: 'White extends to O15 toward the center. White gets the outside, Black gets the corner.',
        },
        {
          c: 'B',
          at: 'Q13',
          note: 'Black takes a high base toward Q4 with Q13. The corner and that side are Black’s.',
        },
      ],
    },
    {
      id: 'komoku34-two-low-knight',
      name: "Two-space low approach, knight's move answer",
      difficulty: 2,
      order: 91,
      line: [
        { c: 'W', at: 'O17', note: '' },
        {
          c: 'B',
          at: 'Q14',
          note: 'Black makes a knight’s move toward Q4 and takes that side first.',
        },
        { c: 'W', at: 'P13', note: 'White hits Q14 on the shoulder from the center side.' },
        { c: 'B', at: 'P14', note: 'Black pushes at P14. If White got there first, Q14 would be sealed in.' },
        {
          c: 'W',
          at: 'L17',
          note: 'White settles O17 with a two-space extension toward D16.',
        },
        {
          c: 'B',
          at: 'tenuki',
          note: 'Black plays elsewhere. Both groups have a base, and nothing here is urgent.',
        },
      ],
    },
    {
      id: 'komoku34-two-low-tenuki',
      name: 'Two-space low approach, tenuki, White attaches',
      difficulty: 3,
      order: 92,
      line: [
        { c: 'W', at: 'O17', note: '' },
        {
          c: 'B',
          at: 'tenuki',
          note: 'Black plays elsewhere. A two-space low approach doesn’t threaten the corner yet, so Black can leave it.',
        },
        { c: 'W', at: 'Q16', note: 'White attaches at Q16, on the center side of R16.' },
        { c: 'B', at: 'R17', note: 'Black draws back to R17 and keeps the corner.' },
        {
          c: 'W',
          at: 'Q14',
          note: 'White jumps to Q14 and keeps Black low along the edge toward Q4.',
        },
        { c: 'B', at: 'Q15', note: 'Black wedges in at Q15, between Q16 and Q14.' },
        { c: 'W', at: 'P15', note: 'White ataris Q15 from the center side.' },
        {
          c: 'B',
          at: 'R15',
          note: 'Black connects at R15. Now Q16 is the weak stone, with just two liberties.',
        },
        {
          c: 'W',
          at: 'P14',
          note: 'White connects at P14, so Black has no cut against the wall.',
        },
        {
          c: 'B',
          at: 'tenuki',
          note: 'Black plays elsewhere. The corner has its base, and Q16 is weak enough to attack later.',
        },
      ],
    },
  ],
}
