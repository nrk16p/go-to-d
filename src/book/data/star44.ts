// 4-4 point (star point), Black's corner stone on Q16. Setup: four handicap stones, White to move.
// Black also has D16 (top side) and Q4 (right side), so both sides of the corner are Black's
// and look the same: a pattern that goes one way works the same way mirrored.
//
// Notes name the players ("Black", "White") instead of saying "you", because the owner drills
// both sides: Black when defending, White when attacking.

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
          note: 'The low approach. White sits a knight’s move from the 4-4 stone and starts a base on the right side.',
        },
        {
          c: 'B',
          at: 'O17',
          note: 'Knight’s move on the top. Black keeps the corner and the top and lets White settle on the right.',
        },
        {
          c: 'W',
          at: 'S16',
          note: 'White slides under the corner on the second line. That gives R14 a base and pokes at the corner.',
        },
        {
          c: 'B',
          at: 'R17',
          note: 'Block at the 3-3 point. White can’t get any further into the corner.',
        },
        {
          c: 'W',
          at: 'R11',
          note: 'White extends two spaces down the side, enough room to live. Both groups are settled now.',
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
            { c: 'W', at: 'S18', note: 'Atari on S17. White takes it next and lives in Black’s corner.' },
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
          note: 'Attach on top of R14. White has to answer, and Black’s stones grow toward the center.',
        },
        { c: 'W', at: 'Q13', note: 'White hanes under the attached stone to make room down the right side.' },
        { c: 'B', at: 'P14', note: 'Extend. If White gets P14 first, Q14 is in atari.' },
        { c: 'W', at: 'S15', note: 'White slips in on the second line to make eye space under the corner.' },
        {
          c: 'B',
          at: 'R17',
          note: 'Block at the 3-3 point. The corner is Black’s, and White’s stones still need another move.',
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
          note: 'Jump one space along the top. A bit looser than the knight’s move, but it faces the center better.',
        },
        { c: 'W', at: 'S16', note: 'White slides under the corner on the second line to get a base.' },
        { c: 'B', at: 'R17', note: 'Block at the 3-3 point and keep the corner.' },
        { c: 'W', at: 'R11', note: 'White extends down the side to finish its base. The corner is settled.' },
      ],
    },
    {
      id: 'star44-low-pincer',
      name: 'Low approach, one-space low pincer',
      difficulty: 2,
      order: 4,
      line: [
        { c: 'W', at: 'R14', note: '' },
        { c: 'B', at: 'R12', note: 'Pinch R14 from below. Now White has no easy base on the right side.' },
        {
          c: 'W',
          at: 'R17',
          note: 'White dives into the 3-3 point. Living in the corner is the usual way out of a pincer.',
        },
        {
          c: 'B',
          at: 'R16',
          note: 'Block from the side of the pincer. Black’s wall then works with R12, and R14 is cut off from the corner.',
        },
        { c: 'W', at: 'Q17', note: 'White pushes along the top to make the corner bigger.' },
        {
          c: 'B',
          at: 'P16',
          note: 'Stay on the fourth line. White gets a small corner, Black gets a wall facing the center.',
        },
        { c: 'W', at: 'S16', note: 'White pushes down the side, trying to reach R14.' },
        { c: 'B', at: 'S15', note: 'Block. R14 stays cut off.' },
        { c: 'W', at: 'S17', note: 'White connects. A Black stone here would put S16 in atari.' },
        {
          c: 'B',
          at: 'S14',
          note: 'Shore up S15 before White comes at it from both sides. R14 is a lonely stone now.',
        },
        {
          c: 'W',
          at: 'O17',
          note: 'White stretches along the top so the corner has room for two eyes. Black can play elsewhere.',
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
          note: 'Attach underneath. Black takes the edge and the corner, and White gets the outside.',
        },
        { c: 'W', at: 'R13', note: 'White hanes so the R14 stone can’t slide down the side.' },
        { c: 'B', at: 'R15', note: 'Draw back and connect. The corner is solid now.' },
        {
          c: 'W',
          at: 'Q13',
          note: 'White fixes the cut at Q13. Without it, Black cuts there and Q14 is in trouble.',
        },
        {
          c: 'B',
          at: 'O16',
          note: 'Jump along the top. White’s wall faces down the side, so the top is where Black builds.',
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
          note: 'The calm answer: a knight’s move on the top. The corner and the top stay Black’s.',
        },
        { c: 'W', at: 'Q11', note: 'White extends down the side to make a base under the high stone.' },
        {
          c: 'B',
          at: 'R14',
          note: 'Slide under White’s stones. It takes away White’s base and makes the corner bigger.',
        },
        { c: 'W', at: 'R13', note: 'White blocks so the slide stops here.' },
        {
          c: 'B',
          at: 'R15',
          note: 'Connect. If White gets R15, the R14 stone is in atari.',
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
          note: 'Play elsewhere. One approach stone doesn’t threaten the corner yet, and a big point elsewhere is worth more.',
        },
        { c: 'W', at: 'O17', note: 'White approaches from the top too. Now Black should answer.' },
        {
          c: 'B',
          at: 'Q14',
          note: 'Attach to one of them, on the side where Black is stronger. Here both sides are the same, so R14 is fine.',
          confidence: 'low',
        },
        { c: 'W', at: 'Q13', note: 'White hanes under the stone and heads down the right side.' },
        {
          c: 'B',
          at: 'P14',
          note: 'Extend, just like with a single approach. Black’s wall now faces the O17 stone.',
        },
        { c: 'W', at: 'R15', note: 'White pushes toward the corner for eye space on the right side.' },
        {
          c: 'B',
          at: 'R16',
          note: 'Block. The corner stays Black’s and White has two groups to look after. O17 is the one to chase.',
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
          note: 'Block from the R14 side. The two White stones can’t meet, and R14 ends up alone.',
        },
        { c: 'W', at: 'Q17', note: 'White pushes along the top to make the corner as big as it can.' },
        { c: 'B', at: 'P16', note: 'Stay on the fourth line. Black’s wall faces the center and the R14 stone.' },
        { c: 'W', at: 'S16', note: 'White pushes down the side toward R14.' },
        { c: 'B', at: 'S15', note: 'Block. Keep the corner and R14 apart.' },
        { c: 'W', at: 'S17', note: 'White has to connect, or a Black stone here puts S16 in atari.' },
        {
          c: 'B',
          at: 'S14',
          note: 'Seal it. White lives small in the corner, and R14 has to run on its own.',
        },
      ],
    },
  ],
}
