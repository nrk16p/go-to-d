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
        // Needs 800 visits: at 400 this node's loss swung from 1.2 to 1.9 between runs (limit 2.0).
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
    // ---- Phase 2 (Task 11): orders 21-42 ----
    {
      id: 'star44-high-pincer-33',
      name: 'Low approach, one-space high pincer, 3-3 invasion',
      difficulty: 2,
      order: 21,
      line: [
        { c: 'W', at: 'R14', note: '' },
        {
          c: 'B',
          at: 'Q12',
          note: 'Black pincers one space from R14, on the fourth line. It gives up a little edge and points more toward the center.',
        },
        {
          c: 'W',
          at: 'R17',
          note: 'White answers the pincer by taking the 3-3 point and living in the corner.',
        },
        {
          c: 'B',
          at: 'R16',
          note: 'Black blocks on the pincer side. The new wall works with Q12, and R14 can’t join the corner.',
        },
        { c: 'W', at: 'Q17', note: 'White pushes toward D16 for more room.' },
        {
          c: 'B',
          at: 'P16',
          note: 'Black stays on the fourth line. It’s plain, and it leaves White nothing to cut.',
        },
        { c: 'W', at: 'S16', note: 'White crawls along the edge, reaching for R14.' },
        { c: 'B', at: 'S15', note: 'Black blocks, so the corner and R14 stay apart.' },
        { c: 'W', at: 'S17', note: 'White connects. If Black got S17 first, S16 would be in atari.' },
        {
          c: 'B',
          at: 'R15',
          note: 'Black connects at R15 and the wall has no gaps.',
        },
        {
          c: 'W',
          at: 'O17',
          note: 'White extends toward D16 so the corner has room for two eyes. Black has sente, and R14 is still weak.',
        },
      ],
    },
    {
      id: 'star44-two-space-high-pincer-33',
      name: 'Low approach, two-space high pincer, 3-3 invasion',
      difficulty: 2,
      order: 22,
      line: [
        { c: 'W', at: 'R14', note: '' },
        { c: 'B', at: 'Q11', note: '' },
        { c: 'W', at: 'R17', note: 'White can also answer the looser pincer with the 3-3 point.' },
        { c: 'B', at: 'R16', note: 'Black blocks on the pincer side, so the wall works with Q11.' },
        { c: 'W', at: 'Q17', note: 'White pushes toward D16 for more room.' },
        {
          c: 'B',
          at: 'P16',
          note: 'Black stays on the fourth line.',
        },
        { c: 'W', at: 'S16', note: 'White crawls toward R14.' },
        { c: 'B', at: 'S15', note: 'Black blocks, and R14 stays alone.' },
        { c: 'W', at: 'S17', note: 'White connects, or a Black stone on S17 ataris S16.' },
        {
          c: 'B',
          at: 'S14',
          note: 'Black blocks at S14. With the pincer this far away, R15 is just as good.',
        },
        {
          c: 'W',
          at: 'O17',
          note: 'White extends toward D16 so the corner has room for eyes. Black has sente.',
        },
      ],
    },
    {
      id: 'star44-two-space-pincer-33',
      name: 'Low approach, two-space low pincer, 3-3 invasion, hane',
      difficulty: 3,
      order: 23,
      line: [
        { c: 'W', at: 'R14', note: '' },
        {
          c: 'B',
          at: 'R11',
          note: 'Black pincers two spaces away on the third line. It’s less severe than R12, but the pincer stone is harder to attack.',
        },
        { c: 'W', at: 'R17', note: 'White takes the 3-3 point, the usual answer to a pincer.' },
        { c: 'B', at: 'R16', note: 'Black blocks on the pincer side, so R14 stays cut off from the corner.' },
        { c: 'W', at: 'Q17', note: 'White pushes toward D16.' },
        {
          c: 'B',
          at: 'P17',
          note: 'Black hanes this time. It keeps White lower than P16 does but leaves a cut at P16, so P16 is the simpler choice.',
        },
        { c: 'W', at: 'S16', note: 'White first pushes along the edge toward R14.' },
        { c: 'B', at: 'S15', note: 'Black blocks, and R14 stays on its own.' },
        { c: 'W', at: 'S17', note: 'White connects so S16 isn’t left in atari.' },
        { c: 'B', at: 'R15', note: 'Black connects at R15. A White stone there would cut S15 off.' },
        {
          c: 'W',
          at: 'O17',
          note: 'Now White turns to the D16 side and plays next to P17, aiming at the cut at P16.',
        },
        { c: 'B', at: 'O16', note: 'Black blocks O17 from the center side.' },
        { c: 'W', at: 'P18', note: 'White ataris P17 from the edge.' },
        { c: 'B', at: 'P16', note: 'Black connects, and the wall is in one piece.' },
        { c: 'W', at: 'N17', note: 'White extends along the edge for eye space.' },
        {
          c: 'B',
          at: 'N16',
          note: 'Black blocks at N16. White has its corner, and Black’s thick wall faces the lone stone on R14.',
        },
      ],
    },
    {
      id: 'star44-pincer-other-side',
      name: 'Low approach, two-space high pincer: White approaches from the other side',
      difficulty: 3,
      order: 24,
      line: [
        { c: 'W', at: 'R14', note: '' },
        {
          c: 'B',
          at: 'Q11',
          note: 'Black pincers two spaces away on the fourth line. It’s a looser pincer that faces the center.',
        },
        {
          c: 'W',
          at: 'O17',
          note: 'White leaves R14 for now and approaches from the D16 side. Black’s corner has a White stone on each side.',
        },
        {
          c: 'B',
          at: 'O16',
          note: 'Black attaches to O17 from the center side.',
        },
        { c: 'W', at: 'N16', note: 'White hanes at N16 to make shape on the D16 side.' },
        {
          c: 'B',
          at: 'O15',
          note: 'Black extends so White can’t atari O16. Black’s wall now leans toward R14, the weaker White stone.',
        },
      ],
    },
    {
      id: 'star44-two-space-pincer-other-side',
      name: 'Low approach, two-space low pincer: White approaches from the other side',
      difficulty: 3,
      order: 25,
      line: [
        { c: 'W', at: 'R14', note: '' },
        { c: 'B', at: 'R11', note: '' },
        {
          c: 'W',
          at: 'O17',
          note: 'White approaches from the D16 side rather than going into the corner.',
        },
        {
          c: 'B',
          at: 'O16',
          note: 'Black attaches to O17 from the center side. The stones Black adds here work with the R11 pincer.',
        },
        { c: 'W', at: 'N16', note: 'White hanes to make shape on the D16 side.' },
        {
          c: 'B',
          at: 'O15',
          note: 'Black extends so O16 can’t be put in atari. R14 is the weak White stone now.',
        },
      ],
    },
    {
      id: 'star44-low-pincer-other-side',
      name: 'Low approach, one-space low pincer: White approaches from the other side',
      difficulty: 2,
      order: 26,
      line: [
        { c: 'W', at: 'R14', note: '' },
        { c: 'B', at: 'R12', note: '' },
        {
          c: 'W',
          at: 'O17',
          note: 'White leaves R14 and approaches from the D16 side. Black has to choose which stone to go after.',
        },
        {
          c: 'B',
          at: 'Q14',
          note: 'Black attaches to R14 from the center side. With R12 this close, R14 has no room to settle, so the O17 stone is where White has to get its base.',
          confidence: 'low',
        },
      ],
    },
    {
      id: 'star44-low-pincer-jump',
      name: 'Low approach, one-space low pincer: White jumps out',
      difficulty: 3,
      order: 27,
      line: [
        { c: 'W', at: 'R14', note: '' },
        { c: 'B', at: 'R12', note: '' },
        {
          c: 'W',
          at: 'P14',
          note: 'White jumps toward the center instead of taking the corner. R14 can’t be sealed in now.',
        },
        {
          c: 'B',
          at: 'O16',
          note: 'Black jumps toward D16. The corner and that side stay Black’s, and White’s stones still have no base.',
        },
        {
          c: 'W',
          at: 'R10',
          note: 'White pincers R12 back from the Q4 side. Now Black’s pincer stone is the one under pressure.',
        },
        {
          c: 'B',
          at: 'Q11',
          note: 'Black moves R12 out toward the center with the diagonal move. Both sides have a group to run with, and the fight is even.',
          confidence: 'low',
        },
      ],
    },
    {
      id: 'star44-slide-pincer',
      name: "Low approach, knight's move, slide: Black pincers",
      difficulty: 2,
      order: 28,
      line: [
        { c: 'W', at: 'R14', note: '' },
        { c: 'B', at: 'O17', note: '' },
        { c: 'W', at: 'S16', note: '' },
        {
          c: 'B',
          at: 'R12',
          note: 'Black pincers instead of blocking. White’s stones get no base along the edge, and the block at R17 can wait a move.',
        },
        {
          c: 'W',
          at: 'P14',
          note: 'White jumps toward the center, because there’s no room to live along the edge now.',
        },
        {
          c: 'B',
          at: 'R17',
          note: 'Now Black blocks at the 3-3 point. The corner is safe, and White’s group still has no eyes.',
        },
      ],
    },
    {
      id: 'star44-large-knight-slide',
      name: "Low approach, large knight's move, slide",
      difficulty: 1,
      order: 29,
      line: [
        { c: 'W', at: 'R14', note: '' },
        {
          c: 'B',
          at: 'N17',
          note: 'Black answers with the large knight’s move. It claims more of the D16 side than O17 does, but the corner is a little thinner.',
        },
        {
          c: 'W',
          at: 'S16',
          note: 'White slides under the corner on the second line, the same as against the small knight.',
        },
        {
          c: 'B',
          at: 'R17',
          note: 'Black blocks at the 3-3 point and the corner is safe. A pincer on R14 at Q12 is also good.',
        },
        {
          c: 'W',
          at: 'R11',
          note: 'White extends two spaces along the edge and has a base. Both sides are settled.',
        },
      ],
    },
    {
      id: 'star44-large-knight-33',
      name: "Low approach, large knight's move: White takes the 3-3 point",
      difficulty: 2,
      order: 30,
      line: [
        { c: 'W', at: 'R14', note: '' },
        { c: 'B', at: 'N17', note: '' },
        {
          c: 'W',
          at: 'R17',
          note: 'White goes straight into the 3-3 point. With Black’s stone out on N17, there’s more room in the corner.',
        },
        {
          c: 'B',
          at: 'R16',
          note: 'Black blocks on the R14 side, so the corner can’t join up with R14.',
        },
        { c: 'W', at: 'Q17', note: 'White pushes toward N17 to make the corner bigger.' },
        { c: 'B', at: 'P16', note: 'Black stays on the fourth line and keeps the wall in one piece.' },
        { c: 'W', at: 'S16', note: 'White pushes along the edge toward R14.' },
        { c: 'B', at: 'S15', note: 'Black blocks. The corner and R14 stay apart.' },
        { c: 'W', at: 'S17', note: 'White connects, or a Black stone on S17 puts S16 in atari.' },
        { c: 'B', at: 'R15', note: 'Black connects at R15. The wall is solid now.' },
        {
          c: 'W',
          at: 'P17',
          note: 'White stretches along the edge toward N17. The large knight left a gap here, and the corner gets room for eyes.',
        },
      ],
    },
    {
      id: 'star44-knight-extend',
      name: "Low approach, knight's move: White extends at once",
      difficulty: 1,
      order: 31,
      line: [
        { c: 'W', at: 'R14', note: '' },
        { c: 'B', at: 'O17', note: '' },
        {
          c: 'W',
          at: 'R11',
          note: 'White skips the slide and extends along the edge right away. R14 has a base, and the corner is still open.',
        },
        {
          c: 'B',
          at: 'R15',
          note: 'Black closes the corner with the diagonal move, so the slide and the 3-3 point are gone.',
        },
      ],
    },
    {
      id: 'star44-jump-extend',
      name: 'Low approach, one-space jump: White extends at once',
      difficulty: 1,
      order: 32,
      line: [
        { c: 'W', at: 'R14', note: '' },
        { c: 'B', at: 'O16', note: '' },
        {
          c: 'W',
          at: 'R11',
          note: 'White extends right away instead of sliding. That gives R14 a base and leaves the corner for later.',
        },
        {
          c: 'B',
          at: 'R15',
          note: 'Black takes the corner for good with the diagonal move. Neither the slide nor the 3-3 point works for White now.',
        },
      ],
    },
    {
      id: 'star44-kosumi',
      name: 'Low approach, diagonal move, White stands',
      difficulty: 2,
      order: 33,
      line: [
        { c: 'W', at: 'R14', note: '' },
        {
          c: 'B',
          at: 'R15',
          note: 'Black answers with the diagonal move. It’s slow, but White can’t slide into the corner any more.',
        },
        {
          c: 'W',
          at: 'Q14',
          note: 'White stands at Q14. Black wanted this point, to press R14 against the edge.',
        },
        { c: 'B', at: 'O16', note: 'Black jumps toward D16 and claims that side.' },
        {
          c: 'W',
          at: 'Q10',
          note: 'White extends toward Q4 and has a base.',
        },
      ],
    },
    {
      id: 'star44-high-jump',
      name: 'High approach, one-space jump',
      difficulty: 1,
      order: 34,
      line: [
        { c: 'W', at: 'Q14', note: '' },
        {
          c: 'B',
          at: 'O16',
          note: 'Black jumps one space toward D16. That side stays Black’s, and Q14 has to find its base toward Q4.',
        },
        { c: 'W', at: 'R10', note: 'White makes its base along the edge toward Q4.' },
        {
          c: 'B',
          at: 'tenuki',
          note: 'Black plays elsewhere. Nothing here needs an answer yet, and a big point elsewhere is worth more.',
        },
      ],
      branches: [
        {
          after: 1,
          move: {
            c: 'B',
            at: 'Q15',
            kind: 'mistake',
            note: 'Pushing straight at Q14 feels safe, but it only makes White stronger. White takes R14 next and Black’s corner shrinks.',
          },
          then: [
            { c: 'W', at: 'R14', note: 'White plays R14 and gets a base along the edge.' },
            { c: 'B', at: 'S15', note: 'Black blocks so White can’t get into the corner.' },
            {
              c: 'W',
              at: 'O14',
              note: 'White jumps to O14. Black is shut into a small corner, and White’s stones face the center.',
            },
          ],
        },
      ],
    },
    {
      id: 'star44-high-hane-back',
      name: 'Common mistake: sandwiching the hane under the high approach',
      difficulty: 2,
      order: 35,
      line: [
        { c: 'W', at: 'Q14', note: '' },
        { c: 'B', at: 'R14', note: '' },
        { c: 'W', at: 'R13', note: '' },
        { c: 'B', at: 'R15', note: '' },
      ],
      branches: [
        {
          after: 3,
          move: {
            c: 'B',
            at: 'R12',
            kind: 'mistake',
            note: 'Sandwiching R13 with R12 looks strong, but R14 is short of liberties. White ataris at R15 and splits Black in two.',
          },
          then: [
            { c: 'W', at: 'R15', note: 'White ataris R14 from the corner side.' },
            { c: 'B', at: 'S14', note: 'Black has to extend, or R14 is captured.' },
            {
              c: 'W',
              at: 'Q15',
              note: 'White connects at Q15. Black’s corner and the edge stones are cut apart, and both are weak.',
            },
          ],
        },
      ],
    },
    {
      id: 'star44-high-pincer-other-side',
      name: 'High approach, pincer: White approaches from the other side',
      difficulty: 2,
      order: 36,
      line: [
        { c: 'W', at: 'Q14', note: '' },
        {
          c: 'B',
          at: 'R12',
          note: 'Black pincers on the third line at R12. White has no room to settle along that edge now.',
        },
        {
          c: 'W',
          at: 'O17',
          note: 'White approaches from the D16 side instead. Now there’s a White stone on each side of the corner.',
        },
        {
          c: 'B',
          at: 'R14',
          note: 'Black attaches under Q14. The corner links up with R12 along the edge, and Q14 has no base.',
        },
      ],
    },
    {
      id: 'star44-high-jump-probe',
      name: 'High approach, one-space jump: White probes the corner later',
      difficulty: 2,
      order: 37,
      line: [
        { c: 'W', at: 'Q14', note: '' },
        { c: 'B', at: 'O16', note: '' },
        { c: 'W', at: 'R10', note: '' },
        { c: 'B', at: 'tenuki', note: '' },
        {
          c: 'W',
          at: 'R16',
          note: 'With Black away, White attaches at R16 and reaches into the corner.',
        },
        { c: 'B', at: 'R17', note: 'Black hanes under at R17. The corner stays Black’s.' },
        { c: 'W', at: 'R15', note: 'White extends to R15, and its stones are linked to Q14.' },
        {
          c: 'B',
          at: 'S17',
          note: 'Black makes the corner solid with S17. White has the outside, and Black keeps the corner and the D16 side.',
          confidence: 'low',
        },
      ],
    },
    {
      id: 'star44-jump-33',
      name: 'Low approach, one-space jump: White takes the 3-3 point at once',
      difficulty: 2,
      order: 38,
      line: [
        { c: 'W', at: 'R14', note: '' },
        { c: 'B', at: 'O16', note: '' },
        {
          c: 'W',
          at: 'R17',
          note: 'White goes into the 3-3 point right away. The jump leaves it open, and R14 is close enough to help.',
        },
        {
          c: 'B',
          at: 'R16',
          note: 'Black blocks on the R14 side. The 3-3 stones can’t reach R14, so they have to live on their own.',
        },
        { c: 'W', at: 'S16', note: 'White crawls along the edge toward R14.' },
        { c: 'B', at: 'S15', note: 'Black blocks and keeps the two White groups apart.' },
        { c: 'W', at: 'S17', note: 'White connects. A Black stone on S17 would put S16 in atari.' },
        {
          c: 'B',
          at: 'S14',
          note: 'Black extends to S14 so S15 can’t be squeezed from both sides. White has a small corner and a lone stone on R14 to look after.',
        },
      ],
    },
    {
      id: 'star44-side-star-33',
      name: 'Black has the side star: White invades at the 3-3 point',
      difficulty: 2,
      order: 39,
      line: [
        { c: 'W', at: 'tenuki', note: 'White plays elsewhere first.' },
        {
          c: 'B',
          at: 'K16',
          note: 'Black takes the side star point between Q16 and D16. Now Black has two stones on this side.',
        },
        {
          c: 'W',
          at: 'R17',
          note: 'White invades at the 3-3 point. With K16 on the board, the side Black blocks from matters.',
        },
        {
          c: 'B',
          at: 'Q17',
          note: 'Black blocks on the K16 side. White has to crawl toward Q4, and Black’s wall works with K16.',
        },
        { c: 'W', at: 'R16', note: 'White crawls along the edge.' },
        {
          c: 'B',
          at: 'R14',
          note: 'Black jumps ahead of White instead of playing a hane, so the crawl stays short.',
        },
        { c: 'W', at: 'R15', note: 'White crawls one more step and touches R14.' },
        { c: 'B', at: 'Q15', note: 'Black blocks on the center side. White is boxed in along the edge.' },
        { c: 'W', at: 'S14', note: 'White hanes under R14 at S14 for eye space.' },
        {
          c: 'B',
          at: 'R13',
          note: 'Black blocks at R13. White gets a small corner, and Black’s wall faces K16.',
        },
      ],
    },
    {
      id: 'star44-side-invasion-r10',
      name: 'Side invasion on the third line: shoulder hit',
      difficulty: 3,
      order: 40,
      line: [
        {
          c: 'W',
          at: 'R10',
          note: 'White invades the edge between Q16 and Q4. Breaking up a handicap side like this is common.',
        },
        {
          c: 'B',
          at: 'Q11',
          note: 'Black hits R10 on the shoulder from the Q16 side. White is pushed toward Q4, where Black is already strong.',
          confidence: 'low',
        },
        { c: 'W', at: 'Q10', note: 'White stands at Q10 so it isn’t stuck on the third line.' },
        { c: 'B', at: 'P11', note: 'Black extends and stays ahead of White toward the center.' },
        { c: 'W', at: 'R11', note: 'White pushes along the edge toward the corner to make some room.' },
        {
          c: 'B',
          at: 'Q13',
          note: 'Black stops White short of the corner. White’s base has to come from the Q4 side, close to Black’s stone.',
          confidence: 'low',
        },
      ],
    },
    {
      id: 'star44-side-invasion-q10',
      name: 'Side invasion at the side star point',
      difficulty: 3,
      order: 41,
      line: [
        {
          c: 'W',
          at: 'Q10',
          note: 'White invades at the side star point between Q16 and Q4.',
        },
        {
          c: 'B',
          at: 'R13',
          note: 'Black takes R13 first. White can’t slide toward the corner along the edge now.',
          confidence: 'low',
        },
        {
          c: 'W',
          at: 'P14',
          note: 'White plays lightly at P14. It limits Black’s corner from the center side and stays in touch with Q10.',
          confidence: 'low',
        },
        {
          c: 'B',
          at: 'Q12',
          note: 'Black plays between P14 and Q10. White has two light stones and no base yet.',
          confidence: 'low',
        },
      ],
    },
    {
      id: 'star44-double-approach-jump',
      name: 'Double approach after tenuki: Black plays between the stones',
      difficulty: 3,
      order: 42,
      line: [
        { c: 'W', at: 'R14', note: '' },
        { c: 'B', at: 'tenuki', note: '' },
        { c: 'W', at: 'O17', note: '' },
        {
          c: 'B',
          at: 'P14',
          kind: 'alternative',
          note: 'Black plays P14, between the two White stones on the center side. The attach at Q14 is the usual answer, but this works too.',
          confidence: 'low',
        },
        { c: 'W', at: 'R12', note: 'White makes a base for R14 along the edge.' },
        {
          c: 'B',
          at: 'M17',
          note: 'Black pincers O17 from the D16 side. Now O17 is the stone that has to run.',
        },
      ],
    },
  ],
}
