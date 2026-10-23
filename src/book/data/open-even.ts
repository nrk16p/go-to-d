// Whole-board opening in an even game (R46). Setup 'empty': an empty board, Black moves first, komi 7.5,
// no start stones. The owner plays Black ('defend') and may drill White ('attack') too.
//
// region: 'board' makes this a whole-board family: every point is in play, the book check and the
// teacher compare each move with the best move anywhere on the board, and there are no 'tenuki' moves
// (write the point that is played). Everything else is the same book format as the corner families.
//
// Every line follows native KataGo (b18, whole board, 400–800 visits): each joseki/alternative move is
// within 2.0 points of the engine's best move anywhere, each mistake loses at least 1.5.
// Symmetric positions have only one of their mirror moves as a child (R47). Two proverbs did not survive
// the check: an early center move (about 0.5) and a side move before the last corner (0.4–1.3) are not
// mistakes to the engine, so the mistakes here are both "too close to a wall".
//
// Copy rules for notes (R13, R16, R36): name the players and describe the move, no "you", no
// imperatives; no absolute directions ("right side", "top"), name points instead ("toward Q4", "the side
// between Q4 and Q16", "toward the center"); no coordinates in pattern names.

import type { FamilyDef } from '../types'

export const OPEN_EVEN: FamilyDef = {
  id: 'open-even',
  name: 'Even-game opening',
  region: 'board',
  setup: 'empty',
  start: [],
  patterns: [
    {
      id: 'open-even-two-stars-33',
      name: 'Two star points, early 3-3 invasion',
      difficulty: 1,
      order: 111,
      line: [
        {
          c: 'B',
          at: 'Q16',
          note: 'Black starts in a corner, where territory is easiest to make. A star point claims the corner fast, but leaves the 3-3 point open.',
        },
        { c: 'W', at: 'D4', note: 'White takes the corner across from Q16.' },
        {
          c: 'B',
          at: 'Q4',
          note: 'Black takes a second star point on the same side, so Q4 and Q16 work together.',
        },
        { c: 'W', at: 'D16', note: 'White takes the last empty corner.' },
        {
          c: 'B',
          at: 'F3',
          note: 'Black approaches D4 instead of enclosing a corner of its own. Coming from the Q4 side, F3 has Q4 behind it.',
        },
        {
          c: 'W',
          at: 'R17',
          note: 'White leaves F3 alone and dives into the 3-3 point under Q16. Modern players take corners this way early.',
        },
        {
          c: 'B',
          at: 'Q17',
          note: 'Black blocks on the D16 side, so the wall that grows faces Q4, Black’s other corner.',
        },
        { c: 'W', at: 'R16', note: 'White pushes toward Q4 to make room.' },
        { c: 'B', at: 'Q15', note: 'Black extends along the fourth line toward Q4.' },
        { c: 'W', at: 'R15', note: 'White crawls along the third line.' },
        { c: 'B', at: 'R14', note: 'Black blocks. White has to turn to the second line now.' },
        {
          c: 'W',
          at: 'S14',
          note: 'White hanes on the second line to make eye space, and the corner group can live.',
        },
        {
          c: 'B',
          at: 'F17',
          note: 'Black approaches D16 from the Q16 side. Both approach stones, F3 and F17, come from the sides where Black has corners.',
        },
      ],
      branches: [
        {
          after: 12,
          move: {
            c: 'B',
            at: 'R12',
            kind: 'mistake',
            note: 'Black jumps one space from the wall to R12. A wall doesn’t need a stone this close, and the gap at R13 is easy to wedge into.',
          },
          then: [
            { c: 'W', at: 'R13', note: 'White wedges between R14 and R12.' },
            { c: 'B', at: 'Q14', note: 'Black has to keep the wall connected first.' },
            {
              c: 'W',
              at: 'Q13',
              note: 'White pushes out between them. R12 is cut off, and the wall has a White stone leaning on it.',
            },
          ],
        },
      ],
    },
    {
      id: 'open-even-three-stars',
      name: 'Three star points (sanrensei)',
      difficulty: 1,
      order: 112,
      line: [
        { c: 'B', at: 'Q16', note: '' },
        { c: 'W', at: 'D4', note: '' },
        { c: 'B', at: 'Q4', note: '' },
        { c: 'W', at: 'D16', note: '' },
        {
          c: 'B',
          at: 'Q10',
          note: 'Black takes the side star point between Q16 and Q4. Three stones in a row make a big framework along the side.',
        },
        {
          c: 'W',
          at: 'R3',
          note: 'White dives into the 3-3 point under Q4 straight away, before the framework grows.',
        },
        {
          c: 'B',
          at: 'R4',
          note: 'Black blocks on the Q10 side. The framework stays whole, and White lives along the edge toward D4, where White is strong anyway.',
        },
        { c: 'W', at: 'Q3', note: 'White crawls along the edge toward D4.' },
        { c: 'B', at: 'P4', note: 'Black extends on the fourth line. White’s corner stays low.' },
        { c: 'W', at: 'O2', note: 'White slides along the second line, and that’s enough to live.' },
        {
          c: 'B',
          at: 'O17',
          note: 'Black extends from Q16 toward D16. With Q10, Black’s framework now reaches along two sides.',
        },
      ],
    },
    {
      id: 'open-even-chinese',
      name: 'Star point, 3-4 point and a side stone',
      difficulty: 2,
      order: 113,
      line: [
        { c: 'B', at: 'Q16', note: '' },
        { c: 'W', at: 'D4', note: '' },
        {
          c: 'B',
          at: 'R4',
          note: 'Black takes the next corner on this side with a 3-4 point. It holds the corner more firmly than a star point.',
        },
        { c: 'W', at: 'D16', note: 'White takes the last empty corner.' },
        {
          c: 'B',
          at: 'R10',
          note: 'Black adds a stone on the side between Q16 and R4, so all three Black stones work along one side.',
        },
        { c: 'W', at: 'P4', note: 'White approaches R4 high, from the D4 side, before Black can enclose it.' },
        { c: 'B', at: 'P3', note: 'Black attaches under P4 to keep the corner.' },
        { c: 'W', at: 'O3', note: 'White hanes, keeping Black low.' },
        { c: 'B', at: 'Q3', note: 'Black draws back. The corner is solid now.' },
        { c: 'W', at: 'O4', note: 'White connects. Its stones face the side toward D4.' },
        {
          c: 'B',
          at: 'Q6',
          note: 'Black extends from the corner toward R10, and the side between them is nearly Black’s.',
        },
        { c: 'W', at: 'R8', note: 'White probes the gap between Q6 and R10 to see how Black answers.', confidence: 'low' },
        {
          c: 'B',
          at: 'R7',
          note: 'Black blocks on the corner side, so R8 can’t connect under Q6. R8 is left inside Black’s side.',
          confidence: 'low',
        },
        { c: 'W', at: 'K4', note: 'White extends along the side from O3 and O4 to give them a base.' },
      ],
    },
    {
      id: 'open-even-star-komoku-enclosure',
      name: 'Star point and 3-4 point, high enclosure',
      difficulty: 2,
      order: 114,
      line: [
        { c: 'B', at: 'Q16', note: '' },
        { c: 'W', at: 'D4', note: '' },
        { c: 'B', at: 'R4', note: '' },
        { c: 'W', at: 'D16', note: '' },
        {
          c: 'B',
          at: 'P4',
          note: 'Black encloses R4 with a one-space move on the fourth line. The corner is safe, and P4 faces the center.',
        },
        {
          c: 'W',
          at: 'R17',
          note: 'White dives into the 3-3 point under Q16. The star point is the Black corner White can still get into.',
        },
        {
          c: 'B',
          at: 'R16',
          note: 'Black blocks on the R4 side, so the wall that follows faces Black’s enclosure.',
        },
        { c: 'W', at: 'Q17', note: 'White pushes toward D16 to make room.' },
        { c: 'B', at: 'O17', note: 'Black blocks two points along the edge, so White can’t run toward D16.' },
        { c: 'W', at: 'P17', note: 'White pushes to make eye space.' },
        { c: 'B', at: 'P16', note: 'Black blocks on the fourth line.' },
        { c: 'W', at: 'O18', note: 'White hanes under O17 on the second line, and the corner group lives.' },
        {
          c: 'B',
          at: 'Q10',
          note: 'Black takes the side star point between the wall and P4. Wall, side stone and enclosure make one big framework.',
        },
      ],
      branches: [
        {
          after: 12,
          move: {
            c: 'B',
            at: 'P14',
            kind: 'mistake',
            note: 'Black jumps out from P16 toward the center. The wall was already safe, so P14 only makes it thicker.',
          },
          then: [
            {
              c: 'W',
              at: 'R9',
              note: 'White steps onto the side first. R9 is far enough from the wall and from P4 to make a base there.',
            },
          ],
        },
      ],
    },
    {
      id: 'open-even-33-before-last-corner',
      name: '3-3 invasion before the last corner',
      difficulty: 2,
      order: 115,
      line: [
        { c: 'B', at: 'Q16', note: '' },
        { c: 'W', at: 'D4', note: '' },
        { c: 'B', at: 'Q4', note: '' },
        {
          c: 'W',
          at: 'R17',
          note: 'White leaves the last corner empty and dives into the 3-3 point under Q16 at once.',
        },
        {
          c: 'B',
          at: 'R16',
          note: 'Black blocks on the Q4 side. The wall will face the side between Q16 and Q4, where Black has both corners.',
        },
        { c: 'W', at: 'Q17', note: 'White pushes toward the empty corner at D16.' },
        { c: 'B', at: 'P16', note: 'Black stays on the fourth line. White gets the corner, and Black gets a wall.' },
        { c: 'W', at: 'O18', note: 'White slides along the second line, and the corner group lives.' },
        {
          c: 'B',
          at: 'D16',
          note: 'Black takes the empty corner. That’s the move White gave up by diving in early.',
        },
        {
          c: 'W',
          at: 'C17',
          note: 'White dives into this corner’s 3-3 point too. Modern players answer star points this way all the time.',
        },
        {
          c: 'B',
          at: 'C16',
          note: 'Black blocks on the D4 side, so the wall that grows faces White’s corner at D4.',
        },
        { c: 'W', at: 'D17', note: 'White pushes along the edge toward Q16.' },
        {
          c: 'B',
          at: 'F17',
          note: 'Black blocks two points along the edge. White lives small, and Black’s stones at D16 face D4.',
        },
      ],
    },
    {
      id: 'open-even-approach-attach-33',
      name: 'Approach, attach, Black invades the 3-3',
      difficulty: 2,
      order: 116,
      line: [
        { c: 'B', at: 'Q16', note: '' },
        { c: 'W', at: 'D4', note: '' },
        { c: 'B', at: 'Q4', note: '' },
        { c: 'W', at: 'D16', note: '' },
        { c: 'B', at: 'F3', note: '' },
        { c: 'W', at: 'E3', note: 'White attaches at E3, on the corner side of F3.' },
        { c: 'B', at: 'F4', note: 'Black stands firm next to F3. The two stones are strong now.' },
        { c: 'W', at: 'D6', note: 'White adds D6, and the corner is solidly White’s.' },
        {
          c: 'B',
          at: 'C17',
          note: 'Black dives into the 3-3 point under D16. White used D6 to make D4 solid, so Black has time to take part of this corner.',
        },
        {
          c: 'W',
          at: 'D17',
          note: 'White blocks on the Q16 side, so Black has to live along the side toward D4.',
        },
        { c: 'B', at: 'C16', note: 'Black pushes along the side toward D4.' },
        { c: 'W', at: 'D15', note: 'White extends on the fourth line, keeping Black low.' },
        {
          c: 'B',
          at: 'B14',
          note: 'Black slides along the second line to make eye space. Black lives small in White’s corner.',
        },
      ],
    },
    {
      id: 'open-even-enclosure-first',
      name: 'Enclosure first, the older plan',
      difficulty: 1,
      order: 117,
      line: [
        { c: 'B', at: 'Q16', note: '' },
        { c: 'W', at: 'D4', note: '' },
        { c: 'B', at: 'Q4', note: '' },
        { c: 'W', at: 'D16', note: '' },
        {
          c: 'B',
          at: 'R14',
          note: 'Black encloses Q16 with a knight’s move. It’s the older plan: slower than an approach, but very safe.',
        },
        { c: 'W', at: 'R3', note: 'White dives into the 3-3 point under Q4, the star point Black left open.' },
        { c: 'B', at: 'R4', note: 'Black blocks on the R14 side, so the wall faces Black’s enclosure.' },
        { c: 'W', at: 'Q3', note: 'White crawls along the edge toward D4.' },
        { c: 'B', at: 'O3', note: 'Black blocks two points along the edge.' },
        { c: 'W', at: 'P3', note: 'White pushes to make room.' },
        { c: 'B', at: 'P4', note: 'Black blocks on the fourth line. White’s corner stays low.' },
        { c: 'W', at: 'O2', note: 'White hanes under O3 and lives.' },
        {
          c: 'B',
          at: 'F17',
          note: 'Black approaches D16 from the Q16 side, with Q16 behind it.',
        },
      ],
    },
    {
      id: 'open-even-pincered-approach',
      name: 'Pincered approach, Black takes the 3-3 point',
      difficulty: 3,
      order: 118,
      line: [
        { c: 'B', at: 'Q16', note: '' },
        { c: 'W', at: 'D4', note: '' },
        { c: 'B', at: 'Q4', note: '' },
        { c: 'W', at: 'D16', note: '' },
        { c: 'B', at: 'F3', note: '' },
        {
          c: 'W',
          at: 'K3',
          note: 'White pincers F3 from the Q4 side instead of answering in the corner.',
        },
        {
          c: 'B',
          at: 'C3',
          note: 'Black dives into the 3-3 point under D4. If White cuts F3 off, Black lives in the corner instead.',
        },
        { c: 'W', at: 'D3', note: 'White blocks on the F3 side, keeping F3 away from the corner.' },
        { c: 'B', at: 'C4', note: 'Black pushes along the side toward D16.' },
        { c: 'W', at: 'D5', note: 'White extends on the fourth line, keeping Black low.' },
        { c: 'B', at: 'D2', note: 'Black hanes under D3 to make eye space.' },
        { c: 'W', at: 'E2', note: 'White blocks the hane.' },
        {
          c: 'B',
          at: 'C2',
          note: 'Black connects and lives. Black has a corner inside White’s area, and F3 is light enough to leave.',
          confidence: 'low',
        },
      ],
    },
    {
      id: 'open-even-two-komoku',
      name: 'Two 3-4 points, high approach',
      difficulty: 2,
      order: 119,
      line: [
        {
          c: 'B',
          at: 'R16',
          note: 'Black starts on a 3-4 point. It sits closer to the edge than a star point and holds the corner more firmly.',
        },
        { c: 'W', at: 'D16', note: 'White takes a star point in the next corner.' },
        { c: 'B', at: 'C4', note: 'Black takes the corner across from R16 with another 3-4 point.' },
        { c: 'W', at: 'Q4', note: 'White takes the last empty corner.' },
        {
          c: 'B',
          at: 'O17',
          note: 'Black encloses R16 with a large knight’s move toward D16.',
        },
        { c: 'W', at: 'E4', note: 'White approaches C4 high, from the Q4 side.' },
        { c: 'B', at: 'E3', note: 'Black attaches under E4, the simplest answer to a high approach.' },
        { c: 'W', at: 'F3', note: 'White hanes.' },
        { c: 'B', at: 'D3', note: 'Black draws back. The corner is solid.' },
        { c: 'W', at: 'F4', note: 'White connects. Its stones face the side toward Q4.' },
        {
          c: 'B',
          at: 'C6',
          note: 'Black extends along the side toward D16 to make a base. Black has the corner, and White has stones facing Q4.',
        },
      ],
    },
    {
      id: 'open-even-approach-pincer',
      name: 'White approaches, Black pincers',
      difficulty: 1,
      order: 120,
      line: [
        { c: 'B', at: 'Q16', note: '' },
        { c: 'W', at: 'D4', note: '' },
        { c: 'B', at: 'Q4', note: '' },
        { c: 'W', at: 'D16', note: '' },
        { c: 'B', at: 'F3', note: '' },
        {
          c: 'W',
          at: 'R14',
          note: 'White approaches Q16 low, from the Q4 side, and leaves F3 for later.',
        },
        {
          c: 'B',
          at: 'R11',
          note: 'Black pincers from the Q4 side. R14 is squeezed between Q16 and R11, with Q4 behind the pincer.',
        },
        {
          c: 'W',
          at: 'R17',
          note: 'White dives into the 3-3 point under Q16, the usual way out of a pincer.',
        },
        {
          c: 'B',
          at: 'R16',
          note: 'Black blocks on the pincer side, so R14 is cut off from the corner.',
        },
        { c: 'W', at: 'Q17', note: 'White pushes toward D16 to make the corner bigger.' },
        { c: 'B', at: 'P16', note: 'Black stays on the fourth line, and the wall faces the center.' },
        { c: 'W', at: 'S16', note: 'White pushes along the edge, trying to reach R14.' },
        { c: 'B', at: 'S15', note: 'Black blocks, and R14 stays cut off.' },
        { c: 'W', at: 'S17', note: 'White connects. A Black stone here would put S16 in atari.' },
        { c: 'B', at: 'R15', note: 'Black joins R16 and S15 into one wall. R14 is a lone stone now.' },
      ],
    },
  ],
}
