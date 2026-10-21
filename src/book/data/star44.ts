// 4-4 point (star point), Black's corner stone on Q16. Setup: four handicap stones, White to move.
// Black also has D16 and Q4, so both sides of the corner are Black's and look the same:
// a pattern that goes one way works the same way mirrored.
//
// Copy rules for notes (R13, R16):
// - Name the players ("Black", "White") and describe the move; no "you", no imperatives. The owner
//   drills both sides, and in attack mode the teacher plays Black.
// - Drills run under all 8 board symmetries, so no absolute directions ("right side", "top", "above").
//   Name points instead (the UI maps GTP coordinates through the symmetry): "toward Q4", "on the D16 side",
//   "along the edge", "toward the center". "Under" in the Go sense (between the stones and the edge) is fine.

import type { FamilyDef } from '../types'

export const STAR44: FamilyDef = {
  id: 'star44',
  name: '4-4 point',
  setup: 'handicap4',
  start: [{ c: 'B', at: 'Q16', note: 'Black’s stone on the 4-4 point.' }],
  patterns: [
    {
      id: 'star44-low-knight-slide',
      name: "Low approach, knight's move, slide, block, extend",
      difficulty: 1,
      order: 1,
      line: [
        {
          c: 'W',
          at: 'R14',
          note: 'The low approach. White sits a knight’s move from Q16 and starts a base on the Q4 side.',
        },
        {
          c: 'B',
          at: 'O17',
          note: 'Black answers with a knight’s move on the D16 side. Black keeps the corner and that side, and White settles toward Q4.',
        },
        {
          c: 'W',
          at: 'S16',
          note: 'White slides under the corner on the second line. That gives R14 a base and pokes at the corner.',
        },
        {
          c: 'B',
          at: 'R17',
          note: 'Black blocks at the 3-3 point. White can’t get any further into the corner.',
        },
        {
          c: 'W',
          at: 'R11',
          note: 'White extends two spaces along the edge, enough room to live. Both groups are settled.',
        },
      ],
      branches: [
        {
          after: 3,
          move: {
            c: 'B',
            at: 'S17',
            kind: 'mistake',
            note: 'Blocking on the second line leaves the 3-3 point open. White cuts in there and S17 is cut off.',
          },
          then: [
            { c: 'W', at: 'R17', note: 'White cuts at the 3-3 point. S17 can’t reach the corner stone any more.' },
            { c: 'B', at: 'R16', note: 'Black has to block here, or White’s corner stones join up with R14.' },
            { c: 'W', at: 'S18', note: 'White ataris S17, takes it next and lives in Black’s corner.' },
          ],
        },
      ],
    },
    {
      id: 'star44-low-attach-extend',
      name: 'Low approach, attach and extend',
      difficulty: 2,
      order: 2,
      line: [
        { c: 'W', at: 'R14', note: '' },
        {
          c: 'B',
          at: 'Q14',
          note: 'Black attaches to R14 from the center side. White has to answer, and Black’s stones grow toward the center.',
        },
        {
          c: 'W',
          at: 'Q13',
          note: 'White hanes at Q13 to make room along the edge toward Q4.',
        },
        { c: 'B', at: 'P14', note: 'Black extends. If White got P14 first, Q14 would be in atari.' },
        { c: 'W', at: 'S15', note: 'White slips in on the second line to make eye space under the corner.' },
        {
          c: 'B',
          at: 'R17',
          note: 'Black blocks at the 3-3 point. The corner is Black’s, and White’s stones still need another move.',
        },
      ],
    },
    {
      id: 'star44-low-jump',
      name: 'Low approach, one-space jump',
      difficulty: 1,
      order: 3,
      line: [
        { c: 'W', at: 'R14', note: '' },
        {
          c: 'B',
          at: 'O16',
          note: 'Black jumps one space toward D16. It’s a bit looser than the knight’s move but faces the center better.',
        },
        { c: 'W', at: 'S16', note: 'White slides under the corner on the second line to get a base.' },
        { c: 'B', at: 'R17', note: 'Black blocks at the 3-3 point and keeps the corner.' },
        { c: 'W', at: 'R11', note: 'White extends along the edge to finish its base. The corner is settled.' },
      ],
    },
    {
      id: 'star44-low-pincer',
      name: 'Low approach, one-space low pincer',
      difficulty: 2,
      order: 4,
      line: [
        { c: 'W', at: 'R14', note: '' },
        {
          c: 'B',
          at: 'R12',
          note: 'Black pincers R14 from the Q4 side. Now White has no easy base on that side.',
        },
        {
          c: 'W',
          at: 'R17',
          note: 'White dives into the 3-3 point. Living in the corner is the usual way out of a pincer.',
        },
        {
          c: 'B',
          at: 'R16',
          note: 'Black blocks on the pincer side. The wall works with R12, and R14 is cut off from the corner.',
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
        {
          c: 'B',
          at: 'S14',
          note: 'Black shores up S15 before White comes at it from both sides. R14 is a lonely stone now.',
        },
        {
          c: 'W',
          at: 'O17',
          note: 'White stretches toward D16 so the corner has room for two eyes. Black can play elsewhere.',
        },
      ],
    },
    {
      id: 'star44-high-attach',
      name: 'High approach, attach underneath',
      difficulty: 2,
      order: 5,
      line: [
        {
          c: 'W',
          at: 'Q14',
          note: 'The high approach. White sits on the fourth line and aims at the center more than the corner.',
        },
        {
          c: 'B',
          at: 'R14',
          note: 'Black attaches underneath, between Q14 and the edge. Black takes the edge and the corner. White gets the outside.',
        },
        { c: 'W', at: 'R13', note: 'White hanes so R14 can’t slide along the edge toward Q4.' },
        { c: 'B', at: 'R15', note: 'Black draws back and connects. The corner is solid now.' },
        {
          c: 'W',
          at: 'Q13',
          note: 'White fixes the cut at Q13. If Black cut there, Q14 would be in trouble.',
        },
        {
          c: 'B',
          at: 'O16',
          note: 'Black jumps toward D16. White’s wall points toward Q4, so the D16 side is where Black builds.',
        },
      ],
    },
    {
      id: 'star44-high-knight',
      name: "High approach, knight's move",
      difficulty: 1,
      order: 6,
      line: [
        { c: 'W', at: 'Q14', note: '' },
        {
          c: 'B',
          at: 'O17',
          note: 'The calm answer: Black plays a knight’s move on the D16 side. The corner and that side stay Black’s.',
        },
        { c: 'W', at: 'Q11', note: 'White extends toward Q4 to make a base for the high stone.' },
        {
          c: 'B',
          at: 'R14',
          note: 'Black attaches underneath Q14. It takes away White’s base and makes the corner bigger.',
        },
        { c: 'W', at: 'R13', note: 'White hanes at R13, so Black gets no further along the edge.' },
        {
          c: 'B',
          at: 'R15',
          note: 'Black connects. If White got R15, the R14 stone would be in atari.',
        },
      ],
    },
    {
      id: 'star44-double-approach',
      name: 'Double approach after tenuki: attach on the stronger side',
      difficulty: 2,
      order: 7,
      line: [
        { c: 'W', at: 'R14', note: '' },
        {
          c: 'B',
          at: 'tenuki',
          note: 'Black plays elsewhere. One approach stone doesn’t threaten the corner yet, and a big point elsewhere is worth more.',
        },
        { c: 'W', at: 'O17', note: 'White approaches from the D16 side too. Now Black should answer.' },
        {
          c: 'B',
          at: 'Q14',
          note: 'Black attaches to one of the two stones. Which one depends on the stones nearby. Here both sides look the same, so attaching to R14 is fine.',
        },
        { c: 'W', at: 'Q13', note: 'White hanes at Q13 and heads along the edge toward Q4.' },
        {
          c: 'B',
          at: 'P14',
          note: 'Black extends, the same as against a single approach. The wall now faces the O17 stone.',
        },
        { c: 'W', at: 'R15', note: 'White pushes toward the corner for eye space on the Q4 side.' },
        {
          c: 'B',
          at: 'R16',
          note: 'Black blocks. The corner stays Black’s and White has two groups to look after. O17 is the one to chase.',
        },
      ],
    },
    {
      id: 'star44-low-tenuki',
      name: 'Low approach, tenuki: White takes the 3-3 point',
      difficulty: 2,
      order: 8,
      line: [
        { c: 'W', at: 'R14', note: '' },
        { c: 'B', at: 'tenuki', note: '' },
        {
          c: 'W',
          at: 'R17',
          note: 'White can also go straight into the 3-3 point. With R14 nearby, the corner is easy to take.',
        },
        {
          c: 'B',
          at: 'R16',
          note: 'Black blocks on the R14 side. The two White stones can’t meet, and R14 ends up alone.',
        },
        { c: 'W', at: 'Q17', note: 'White pushes toward D16 to make the corner as big as it can.' },
        {
          c: 'B',
          at: 'P16',
          note: 'Black stays on the fourth line. The wall faces the center and the R14 stone.',
        },
        { c: 'W', at: 'S16', note: 'White pushes along the edge toward R14.' },
        { c: 'B', at: 'S15', note: 'Black blocks and keeps the corner and R14 apart.' },
        { c: 'W', at: 'S17', note: 'White has to connect, or a Black stone here puts S16 in atari.' },
        {
          c: 'B',
          at: 'S14',
          note: 'Black seals it. White still has to look after both the small corner and the lone R14 stone.',
        },
      ],
    },
  ],
}
