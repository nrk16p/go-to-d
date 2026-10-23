// Whole-board opening with four handicap stones (R46). Setup: Black on all four star points (Q16 is the
// "start" stone, D4, D16 and Q4 come with the setup), White moves first, komi 0.5. The owner plays Black
// only: in a handicap game the owner takes Black.
//
// region: 'board' makes this a whole-board family: every point is in play, the book check and the
// teacher compare each move with the best move anywhere on the board, and there are no 'tenuki' moves
// (write the point that is played). Everything else is the same book format as the corner families.
//
// Every line follows native KataGo (b18, whole board, 400–800 visits): each joseki/alternative move is
// within 2.0 points of the engine's best move anywhere, each mistake loses at least 1.5.
// The setup is symmetric, so each symmetric position has only one of its mirror moves as a child (R47).
//
// Copy rules for notes (R13, R16, R36): name the players and describe the move, no "you", no
// imperatives; no absolute directions ("right side", "top"), name points instead ("toward Q4", "the side
// between Q4 and Q16", "toward the center"); no coordinates in pattern names.

import type { FamilyDef } from '../types'

export const OPEN_H4: FamilyDef = {
  id: 'open-h4',
  name: 'Opening with four stones',
  region: 'board',
  setup: 'handicap4',
  start: [{ c: 'B', at: 'Q16', note: 'Black has all four star points. White plays first.' }],
  patterns: [
    {
      id: 'open-h4-pincer-every-approach',
      name: 'Every approach gets a pincer',
      difficulty: 1,
      order: 101,
      line: [
        {
          c: 'W',
          at: 'R14',
          note: 'White approaches Q16 low, from the Q4 side. Against four stones this is White’s most common first move.',
        },
        {
          c: 'B',
          at: 'R12',
          note: 'Black pincers from the Q4 side. R14 is squeezed between Q16 and R12, with no room to settle.',
        },
        {
          c: 'W',
          at: 'O3',
          note: 'White leaves R14 light and approaches Q4 from the D4 side, away from the pincer.',
        },
        {
          c: 'B',
          at: 'M3',
          note: 'Black pincers again, from the D4 side. Each pincer comes from the side where Black has another corner.',
        },
        { c: 'W', at: 'F17', note: 'White moves on and approaches D16 from the Q16 side.' },
        {
          c: 'B',
          at: 'H17',
          note: 'Black pincers from the Q16 side. White has three lone stones now, and none of them has a base.',
        },
        { c: 'W', at: 'C6', note: 'White approaches the last corner, D4, from the D16 side.' },
        {
          c: 'B',
          at: 'C8',
          note: 'Black pincers once more. White has four weak stones to look after, and all four corners are still Black’s.',
        },
      ],
    },
    {
      id: 'open-h4-knight-close-side',
      name: 'Knight’s move, then close the side',
      difficulty: 1,
      order: 102,
      line: [
        { c: 'W', at: 'R14', note: '' },
        {
          c: 'B',
          at: 'O17',
          note: 'Black answers with a knight’s move toward D16. That keeps the corner and the D16 side, and R14 has to settle toward Q4, where Black is strong.',
        },
        {
          c: 'W',
          at: 'Q10',
          note: 'White extends along the side to make a base between Q16 and Q4.',
        },
        {
          c: 'B',
          at: 'R7',
          note: 'Black reaches out from Q4 toward Q10. White’s two stones now have little room for eyes along the edge.',
        },
        { c: 'W', at: 'F17', note: 'White leaves them for now and approaches D16 from the Q16 side.' },
        {
          c: 'B',
          at: 'H17',
          note: 'Black pincers from the Q16 side, where O17 already helps. White has two weak groups to look after.',
        },
      ],
      branches: [
        {
          after: 3,
          move: {
            c: 'B',
            at: 'S16',
            kind: 'mistake',
            note: 'Black guards the corner on the second line, where White could slide in. It’s small, and it leaves the big move on the Q4 side to White.',
          },
          then: [
            {
              c: 'W',
              at: 'R6',
              note: 'White approaches Q4 from the Q10 side. Now White has stones all along the side, working together.',
            },
            { c: 'B', at: 'Q6', note: 'Black attaches to R6 from the center side to keep it low.' },
            { c: 'W', at: 'Q7', note: 'White hanes at the head of Q6 and links toward Q10.' },
            {
              c: 'B',
              at: 'P6',
              note: 'Black extends toward the center. White’s side stones have settled, and Black never got to attack them.',
            },
          ],
        },
      ],
    },
    {
      id: 'open-h4-early-33-crawl',
      name: 'Early 3-3 invasion, White crawls',
      difficulty: 1,
      order: 103,
      line: [
        {
          c: 'W',
          at: 'R17',
          note: 'White dives straight into the 3-3 point under Q16. Modern players often take a corner this way against four stones.',
        },
        {
          c: 'B',
          at: 'Q17',
          note: 'Black blocks on the D16 side, so White has to live along the edge toward Q4.',
        },
        { c: 'W', at: 'R16', note: 'White pushes toward Q4 to make room for eyes.' },
        { c: 'B', at: 'R15', note: 'Black blocks on the third line. White has to crawl on the second line now.' },
        {
          c: 'W',
          at: 'S15',
          note: 'White crawls on the second line. Each crawl gets White a point or two and makes Black’s wall longer.',
        },
        { c: 'B', at: 'R14', note: 'Black blocks again, one step ahead of White.' },
        { c: 'W', at: 'S14', note: 'White crawls again. Slow, but the corner group needs the room.' },
        { c: 'B', at: 'R13', note: 'Black keeps blocking. The wall faces along the side toward Q4.' },
        { c: 'W', at: 'S13', note: 'White crawls a third time.' },
        {
          c: 'B',
          at: 'R12',
          note: 'Black blocks once more. White has a small corner, and Black has a long wall that works with Q4.',
        },
        {
          c: 'W',
          at: 'J17',
          note: 'White steps onto the side between D16 and Q16 before Black can turn it into territory.',
        },
        {
          c: 'B',
          at: 'K16',
          note: 'Black presses J17 from the Q16 side, pushing it toward D16, where Black is strong.',
        },
      ],
    },
    {
      id: 'open-h4-pincer-then-33',
      name: 'Low pincer, then the 3-3 point behind it',
      difficulty: 2,
      order: 104,
      line: [
        { c: 'W', at: 'R14', note: '' },
        { c: 'B', at: 'R12', note: '' },
        {
          c: 'W',
          at: 'R3',
          note: 'White leaves R14 and dives into the 3-3 point under Q4, the corner behind Black’s pincer.',
        },
        {
          c: 'B',
          at: 'R4',
          note: 'Black blocks on the R12 side. White has to live along the edge toward D4, and the wall that grows here works with R12.',
        },
        { c: 'W', at: 'Q3', note: 'White pushes along the edge toward D4.' },
        { c: 'B', at: 'O3', note: 'Black blocks two points along the edge, so White’s corner stays small.' },
        { c: 'W', at: 'P3', note: 'White pushes once more to widen the corner.' },
        { c: 'B', at: 'P4', note: 'Black stands firm on the fourth line and keeps White low.' },
        { c: 'W', at: 'O2', note: 'White hanes under O3 and has room to live in the corner.' },
        {
          c: 'B',
          at: 'Q14',
          note: 'Black attaches to R14 from the center side. R14 is pressed against the edge between Q16 and R12, and the new wall stands behind R12.',
        },
      ],
      branches: [
        {
          after: 3,
          move: {
            c: 'B',
            at: 'Q3',
            kind: 'alternative',
            note: 'Blocking on the D4 side works too. The wall then faces D4 instead of R14, so it helps the pincer less.',
          },
          then: [
            { c: 'W', at: 'R4', note: 'White pushes along the side toward R12.' },
            { c: 'B', at: 'R6', note: 'Black blocks with a jump, keeping White away from R12.' },
          ],
        },
      ],
    },
    {
      id: 'open-h4-high-pincer-33',
      name: 'High pincer, White takes the 3-3 point',
      difficulty: 2,
      order: 105,
      line: [
        { c: 'W', at: 'R14', note: '' },
        {
          c: 'B',
          at: 'Q12',
          note: 'Black pincers high, from the Q4 side. A fourth-line stone looks toward the center as well as the side.',
        },
        {
          c: 'W',
          at: 'R17',
          note: 'White dives into the 3-3 point under Q16. Against a pincer, White usually lives in the corner instead of running.',
        },
        {
          c: 'B',
          at: 'R16',
          note: 'Black blocks on the pincer side. The wall will work with Q12, and R14 is cut off from the corner.',
        },
        { c: 'W', at: 'Q17', note: 'White pushes toward D16 to make the corner bigger.' },
        {
          c: 'B',
          at: 'P16',
          note: 'Black stays on the fourth line. White gets a small corner and Black gets a wall facing the center.',
        },
        { c: 'W', at: 'S16', note: 'White pushes along the edge, trying to reach R14.' },
        { c: 'B', at: 'S15', note: 'Black blocks, and R14 stays cut off.' },
        { c: 'W', at: 'S17', note: 'White connects. A Black stone here would put S16 in atari.' },
        { c: 'B', at: 'R15', note: 'Black joins R16 and S15 into one wall. R14 is a lone stone now.' },
        {
          c: 'W',
          at: 'O17',
          note: 'White extends from the corner along the edge toward D16 to make the group safe.',
        },
        {
          c: 'B',
          at: 'R6',
          note: 'Black builds toward Q4. With the wall, Q12 and R6, the side between Q16 and Q4 is becoming Black’s territory.',
        },
      ],
      branches: [
        {
          after: 11,
          move: {
            c: 'B',
            at: 'P12',
            kind: 'mistake',
            note: 'Black adds a stone next to Q12, close to the wall. Q12 and the wall were already strong, so this move adds almost nothing.',
          },
          then: [
            {
              c: 'W',
              at: 'R6',
              note: 'White takes the point Black needed. R6 approaches Q4 and stops the side from becoming Black’s.',
            },
            { c: 'B', at: 'Q8', note: 'Black blocks R6 from extending toward the wall.' },
            {
              c: 'W',
              at: 'O3',
              note: 'White approaches Q4 from the D4 side too. Black can’t attack both stones, and the side Black hoped for is gone.',
            },
          ],
        },
      ],
    },
    {
      id: 'open-h4-knight-slide-big-point',
      name: 'Knight’s move, slide, then the big point',
      difficulty: 1,
      order: 106,
      line: [
        { c: 'W', at: 'R14', note: '' },
        { c: 'B', at: 'O17', note: '' },
        {
          c: 'W',
          at: 'S16',
          note: 'White slides under Q16 on the second line. It gives R14 a base and pokes at the corner.',
        },
        { c: 'B', at: 'R17', note: 'Black blocks at the 3-3 point. The corner stays Black’s.' },
        { c: 'W', at: 'R11', note: 'White makes a two-space extension along the edge, enough room to live.' },
        {
          c: 'B',
          at: 'G17',
          note: 'With R14 settled, Black takes the big point between D16 and Q16. G17 and O17 together make that side Black’s.',
        },
      ],
    },
    {
      id: 'open-h4-side-stone',
      name: 'White’s stone between two star points',
      difficulty: 2,
      order: 107,
      line: [
        {
          c: 'W',
          at: 'K17',
          note: 'White plays on the third line in the middle of the side between D16 and Q16. It has room to extend either way.',
        },
        {
          c: 'B',
          at: 'N17',
          note: 'Black closes in from the Q16 side. K17 now has room only toward D16, where Black is strong.',
        },
        {
          c: 'W',
          at: 'F17',
          note: 'White approaches D16 so K17 has a partner. Two stones on one side could settle together.',
        },
        {
          c: 'B',
          at: 'H17',
          note: 'Black splits them. F17 and K17 each stand alone, and neither has room for a base.',
        },
        { c: 'W', at: 'F15', note: 'White jumps out from F17 toward the center.' },
        {
          c: 'B',
          at: 'D13',
          note: 'Black extends from D16 along the side toward D4, giving the corner room on both sides. White still has two groups without a base.',
          confidence: 'low',
        },
      ],
    },
    {
      id: 'open-h4-double-approach',
      name: 'Wide pincer and the double approach',
      difficulty: 3,
      order: 108,
      line: [
        { c: 'W', at: 'R14', note: '' },
        {
          c: 'B',
          at: 'R10',
          note: 'Black makes a wide three-space pincer. R14 still has a little room, so White doesn’t have to answer at once.',
        },
        {
          c: 'W',
          at: 'O17',
          note: 'White approaches Q16 from the other side too. This is the double approach: Black can’t press both stones at once.',
        },
        {
          c: 'B',
          at: 'O16',
          note: 'Black attaches to O17 from the center side. R14 already has R10 pincering it, so Black deals with the other stone.',
        },
        { c: 'W', at: 'N16', note: 'White hanes around O16 to make shape.' },
        {
          c: 'B',
          at: 'O15',
          note: 'Black extends. Black’s stones face the center, and O17 has to find room along the edge.',
        },
        {
          c: 'W',
          at: 'R17',
          note: 'White dives into the 3-3 point, hoping to join its two approach stones under the corner.',
        },
        { c: 'B', at: 'R16', note: 'Black blocks on the R14 side, so R17 can’t reach R14.' },
        { c: 'W', at: 'S16', note: 'White crawls along the edge toward R14.' },
        {
          c: 'B',
          at: 'P17',
          note: 'Black blocks between the corner and O17. White’s corner stones can’t reach O17 either.',
        },
        { c: 'W', at: 'S18', note: 'White makes as much room in the corner as it can, to live there.', confidence: 'low' },
        {
          c: 'B',
          at: 'R13',
          note: 'Black blocks R14 from extending toward R10. White is split into three small groups.',
          confidence: 'low',
        },
      ],
    },
    {
      id: 'open-h4-shoulder-hit',
      name: 'Low pincer and the shoulder hit',
      difficulty: 2,
      order: 109,
      line: [
        { c: 'W', at: 'R14', note: '' },
        { c: 'B', at: 'R12', note: '' },
        {
          c: 'W',
          at: 'P15',
          note: 'White shoulder-hits Q16 from the center side, leaning on the corner to help R14 out.',
        },
        {
          c: 'B',
          at: 'P16',
          note: 'Black pushes along toward D16, the side where Black is strong. The corner and that side stay Black’s.',
        },
        { c: 'W', at: 'O15', note: 'White extends, keeping its stones in a line toward the center.' },
        { c: 'B', at: 'O16', note: 'Black pushes again. Each push adds to the side between D16 and Q16.' },
        { c: 'W', at: 'N15', note: 'White extends once more.' },
        {
          c: 'B',
          at: 'M17',
          note: 'Black jumps ahead on the third line. The side is secure, and White’s wall still has R14 to worry about.',
        },
      ],
      branches: [
        {
          after: 3,
          move: {
            c: 'B',
            at: 'Q15',
            kind: 'mistake',
            note: 'Black pushes toward R12 instead. White blocks and connects to R14, so the pincer stops working.',
          },
          then: [
            {
              c: 'W',
              at: 'Q14',
              note: 'White blocks and connects to R14. The pincered stone isn’t alone any more.',
            },
            { c: 'B', at: 'P14', note: 'Black cuts. P15 and Q14 were only joined on the diagonal.' },
            {
              c: 'W',
              at: 'P13',
              note: 'White ataris the cutting stone from the R12 side. Black has to run, and R12 is the weak stone now.',
              confidence: 'low',
            },
          ],
        },
      ],
    },
    {
      id: 'open-h4-center-start',
      name: 'White starts in the center',
      difficulty: 2,
      order: 110,
      line: [
        { c: 'W', at: 'K10', note: 'White opens on the center point. It keeps every option open but is far from all four corners.' },
        {
          c: 'B',
          at: 'R14',
          note: 'Black adds a knight’s-move enclosure to Q16. That corner is now hard to invade, and K10 is too far away to help.',
        },
        { c: 'W', at: 'C14', note: 'White approaches D16 from the D4 side.' },
        { c: 'B', at: 'C12', note: 'Black pincers from the D4 side and keeps C14 weak.' },
        { c: 'W', at: 'R6', note: 'White approaches Q4 from the Q16 side.' },
        {
          c: 'B',
          at: 'R8',
          note: 'Black pincers again, with the enclosure at R14 behind it. K10 is too far away to help either White stone.',
        },
      ],
    },
  ],
}
