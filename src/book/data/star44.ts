// 4-4 point (star point), Black's corner stone on Q16. Setup: four handicap stones, White to move.
// Black also has D16 (top side) and Q4 (right side), so both sides of the corner are Black's
// and look the same: a pattern that goes one way works the same way mirrored.

import type { FamilyDef } from '../types'

export const STAR44: FamilyDef = {
  id: 'star44',
  name: '4-4 point',
  setup: 'handicap4',
  start: [{ c: 'B', at: 'Q16', note: 'Your stone on the 4-4 point.' }],
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
          note: 'The low approach. White sits a knight’s move from your stone and starts a base on the right side.',
        },
        {
          c: 'B',
          at: 'O17',
          note: 'Knight’s move on the top. You keep the corner and the top side, and White gets to settle on the right.',
        },
        {
          c: 'W',
          at: 'S16',
          note: 'White slides under your stone on the second line. It gives R14 a base and pokes at the corner.',
        },
        {
          c: 'B',
          at: 'R17',
          note: 'Block at the 3-3 point. White can’t get any further into the corner.',
        },
        {
          c: 'W',
          at: 'R11',
          note: 'White extends two spaces down the side, enough room to live. Both of you are settled, so play elsewhere.',
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
            { c: 'W', at: 'R17', note: 'White cuts at the 3-3 point. S17 can’t reach your corner stone any more.' },
            { c: 'B', at: 'R16', note: 'Black has to stop White joining the corner to R14 through this point.' },
            { c: 'W', at: 'S18', note: 'Atari on S17. White takes it next and lives in your corner.' },
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
          note: 'Attach on top of R14. White has to answer, and your stones grow toward the center.',
        },
        { c: 'W', at: 'Q13', note: 'White hanes under your stone to make room down the right side.' },
        {
          c: 'B',
          at: 'P14',
          note: 'Extend. If White gets P14 first, your Q14 stone is wrapped up.',
        },
        { c: 'W', at: 'S15', note: 'White slips in on the second line to make eye space under your corner.' },
        {
          c: 'B',
          at: 'R17',
          note: 'Block at the 3-3 point. The corner is yours, and White’s stones still need another move.',
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
          note: 'Jump one space along the top. It’s a bit looser than the knight’s move but faces the center better.',
        },
        {
          c: 'W',
          at: 'S16',
          note: 'White slides under the corner on the second line to get a base.',
        },
        { c: 'B', at: 'R17', note: 'Block at the 3-3 point and keep the corner.' },
        {
          c: 'W',
          at: 'R11',
          note: 'White extends down the side to finish the base. The corner is settled.',
        },
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
          note: 'Pinch R14 from below. Now White has no easy base on the right side.',
        },
        {
          c: 'W',
          at: 'R17',
          note: 'White dives into the 3-3 point. Living in the corner is the usual way out of a pincer.',
        },
        {
          c: 'B',
          at: 'R16',
          note: 'Block from the side of your pincer. Your wall works with R12, and R14 is cut off from the corner.',
        },
        { c: 'W', at: 'Q17', note: 'White pushes along the top to make the corner bigger.' },
        {
          c: 'B',
          at: 'P16',
          note: 'Stay on the fourth line. White gets a small corner and you get a wall facing the center.',
        },
        { c: 'W', at: 'S16', note: 'White pushes down the side, trying to reach R14.' },
        { c: 'B', at: 'S15', note: 'Block. R14 stays cut off from the corner.' },
        { c: 'W', at: 'S17', note: 'White connects. A Black stone here would put S16 in atari.' },
        {
          c: 'B',
          at: 'S14',
          note: 'Shore up S15 before White comes at it from both sides. R14 is now a lonely stone.',
        },
        {
          c: 'W',
          at: 'O17',
          note: 'White stretches along the top so the corner has room for two eyes. You play elsewhere.',
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
          note: 'The high approach. White is on the fourth line, aiming at the center more than at the corner.',
        },
        {
          c: 'B',
          at: 'R14',
          note: 'Attach underneath. You take the base on the side away from White.',
        },
        { c: 'W', at: 'R13', note: 'White hanes so the R14 stone can’t slide down the side.' },
        { c: 'B', at: 'R15', note: 'Draw back and connect. Your corner is solid now.' },
        { c: 'W', at: 'Q13', note: 'White fixes the cut at Q13. Without it, Black cuts and the Q14 stone is in trouble.' },
        {
          c: 'B',
          at: 'O16',
          note: 'Jump along the top. White’s wall faces down the side, so this is where your area is.',
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
          note: 'The calm answer: a knight’s move on the top. The corner and the top stay yours.',
        },
        { c: 'W', at: 'Q11', note: 'White extends down the side to make a base under the high stone.' },
        {
          c: 'B',
          at: 'R14',
          note: 'Slide under the White stones. It takes away White’s base and makes your corner bigger.',
        },
        { c: 'W', at: 'R13', note: 'White blocks so the slide stops here.' },
        { c: 'B', at: 'R15', note: 'Connect. Leave this and White pushes in at R15 and splits your stones.' },
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
          note: 'Play elsewhere. One approach stone doesn’t threaten your corner yet, and a big point elsewhere is worth more.',
        },
        { c: 'W', at: 'O17', note: 'White approaches from the top too. Now you should answer.' },
        {
          c: 'B',
          at: 'Q14',
          note: 'Attach to one of them, on the side where your stones are stronger. Here both sides are the same, so R14 is fine.',
          confidence: 'low',
        },
        { c: 'W', at: 'Q13', note: 'White hanes under your stone and heads down the right side.' },
        { c: 'B', at: 'P14', note: 'Extend, same as with a single approach. Your wall now faces the O17 stone.' },
        { c: 'W', at: 'R15', note: 'White pushes toward the corner to get eye space for the right-side group.' },
        {
          c: 'B',
          at: 'R16',
          note: 'Block. The corner stays yours, and White has two groups to look after. O17 is the one to chase.',
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
          note: 'White can also go straight into the 3-3 point. With R14 nearby, the corner is easy for White to take.',
        },
        {
          c: 'B',
          at: 'R16',
          note: 'Block from the R14 side. The two White stones can’t meet, and R14 ends up alone.',
        },
        { c: 'W', at: 'Q17', note: 'White pushes along the top to make the corner as big as it can.' },
        { c: 'B', at: 'P16', note: 'Stay on the fourth line. Your wall faces the center and the R14 stone.' },
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
