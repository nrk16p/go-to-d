// White invades at the 3-3 point under Black's 4-4 stone on Q16. Setup: four handicap stones, White to move.
// Black also has D16 and Q4, so the two sides of the corner are the same width; where the direction of a
// block matters, a pattern puts other stones on the board first (an approach, an enclosure).
//
// Copy rules for notes (R13, R16): name the players and describe the move (no "you", no imperatives), and no
// absolute directions. Name points instead ("toward Q4", "on the D16 side"); the UI maps them through the
// board symmetry. "Under" in the Go sense (between the stones and the edge) is fine.

import type { FamilyDef } from '../types'

export const INVADE33: FamilyDef = {
  id: 'invade33',
  name: '3-3 invasion',
  setup: 'handicap4',
  start: [{ c: 'B', at: 'Q16', note: 'Black’s stone on the 4-4 point.' }],
  patterns: [
    {
      id: 'invade33-hane-hane',
      name: '3-3 invasion, block, hane-hane',
      difficulty: 1,
      order: 9,
      line: [
        { c: 'W', at: 'R17', note: 'The 3-3 invasion. White takes the corner and gives Black the outside.' },
        {
          c: 'B',
          at: 'Q17',
          note: 'Black blocks on the D16 side, so White has to crawl toward Q4 and Black’s wall works toward D16. With star points on both sides, either block works here.',
        },
        { c: 'W', at: 'R16', note: 'White crawls along the edge to make room for eyes.' },
        { c: 'B', at: 'R15', note: 'Black hanes in front of White to keep its space small.' },
        { c: 'W', at: 'S15', note: 'White hanes back underneath.' },
        {
          c: 'B',
          at: 'R14',
          note: 'Black extends instead of playing a second hane. A second hane would leave a cut at R14.',
        },
        { c: 'W', at: 'S14', note: 'White crawls one more step on the second line.' },
        {
          c: 'B',
          at: 'R13',
          note: 'Black keeps blocking. White’s corner stays small, and Black’s wall faces the center and D16.',
        },
      ],
    },
    {
      id: 'invade33-other-side-jump',
      name: '3-3 invasion, block on the other side',
      difficulty: 2,
      order: 10,
      line: [
        { c: 'W', at: 'R17', note: '' },
        {
          c: 'B',
          at: 'R16',
          note: 'This time Black blocks on the Q4 side. White has to crawl toward D16, and Black’s wall faces Q4.',
        },
        { c: 'W', at: 'Q17', note: 'White crawls along the edge toward D16.' },
        {
          c: 'B',
          at: 'O17',
          note: 'Black jumps ahead of White instead of playing a hane. It’s the modern move, and White’s crawl stays short.',
        },
        { c: 'W', at: 'P17', note: 'White crawls one more step and touches O17.' },
        { c: 'B', at: 'P16', note: 'Black blocks on the center side. White is boxed in along the edge.' },
        { c: 'W', at: 'O18', note: 'White hanes under O17 on the second line for eye space.' },
        {
          c: 'B',
          at: 'S17',
          note: 'Black hanes at the other end, so White’s corner shrinks from both sides.',
        },
        { c: 'W', at: 'S18', note: 'White blocks and lives. Black has sente to play elsewhere.' },
      ],
    },
    {
      id: 'invade33-stand',
      name: '3-3 invasion, block, stand firm',
      difficulty: 1,
      order: 11,
      line: [
        { c: 'W', at: 'R17', note: '' },
        { c: 'B', at: 'Q17', note: '' },
        { c: 'W', at: 'R16', note: '' },
        {
          c: 'B',
          at: 'Q15',
          note: 'The simple way: Black stands at Q15. The stones are solid and leave White nothing to cut.',
        },
        { c: 'W', at: 'S14', note: 'White slides along the edge on the second line to make eye space.' },
        {
          c: 'B',
          at: 'R13',
          note: 'Black stops the slide at R13. White’s corner stays small, and Black’s wall has no weak points.',
        },
      ],
    },
    {
      id: 'invade33-after-knight',
      name: "3-3 invasion after a knight's-move answer",
      difficulty: 2,
      order: 12,
      line: [
        { c: 'W', at: 'R14', note: 'The low approach.' },
        {
          c: 'B',
          at: 'O17',
          note: 'Black answers with a knight’s move. The corner looks safe, but the 3-3 point is still open.',
        },
        { c: 'W', at: 'R11', note: 'White extends along the edge and leaves the corner for later.' },
        { c: 'B', at: 'tenuki', note: 'Black plays elsewhere. The corner is fine for now.' },
        { c: 'W', at: 'R17', note: 'Now White slips into the 3-3 point, hoping to link up with R14.' },
        {
          c: 'B',
          at: 'R16',
          note: 'Black blocks on the side of White’s stones. The 3-3 stone can’t reach R14, so it has to live on its own.',
        },
        { c: 'W', at: 'S16', note: 'White crawls under the block to make room.' },
        { c: 'B', at: 'Q17', note: 'Black blocks the D16 side as well. White has very little room now.' },
        { c: 'W', at: 'S18', note: 'White makes eye shape on the edge.' },
        {
          c: 'B',
          at: 'R18',
          note: 'Black ataris from the edge. R17 is down to one liberty, so White has to connect.',
        },
        { c: 'W', at: 'S17', note: 'White connects and lives small in the corner.', confidence: 'low' },
        {
          c: 'B',
          at: 'Q12',
          note: 'Black leans on R14 and R11 from the center side. Black’s wall is close by, so this fight favours Black.',
        },
      ],
      branches: [
        {
          after: 5,
          move: {
            c: 'B',
            at: 'Q17',
            kind: 'mistake',
            note: 'Blocking on the D16 side lets the 3-3 stone crawl along the edge to R14. White gets one big group.',
          },
          then: [
            { c: 'W', at: 'R16', note: 'White heads along the edge. The corner and R14 are about to join.' },
            {
              c: 'B',
              at: 'Q15',
              note: 'Black stands firm and keeps White low. White’s corner and R14 are as good as joined.',
            },
            {
              c: 'W',
              at: 'S13',
              note: 'White makes eye space along the edge. The corner and the side stones live as one group.',
              confidence: 'low',
            },
          ],
        },
      ],
    },
    {
      id: 'invade33-wrong-side',
      name: 'Common mistake: blocking from the wrong side',
      difficulty: 2,
      order: 13,
      line: [
        { c: 'W', at: 'tenuki', note: 'White plays elsewhere first.' },
        {
          c: 'B',
          at: 'O17',
          note: 'Black closes the corner with a knight’s move. It looks sealed, but the 3-3 point is still open.',
        },
        { c: 'W', at: 'R17', note: 'White invades at the 3-3 point anyway.' },
        {
          c: 'B',
          at: 'R16',
          note: 'Black blocks on the open side. White has to crawl toward O17, and there’s no room there for eyes.',
          confidence: 'low',
        },
      ],
      branches: [
        {
          after: 3,
          move: {
            c: 'B',
            at: 'Q17',
            kind: 'mistake',
            note: 'Wrong side. White crawls along the open edge toward Q4 and lives easily. The block belongs on the open side, so White has to crawl toward O17.',
          },
          then: [
            { c: 'W', at: 'R16', note: 'White pushes along the open edge.' },
            { c: 'B', at: 'R14', note: 'Black stops White here, but White already has room.' },
            { c: 'W', at: 'R15', note: 'White extends to R15 and blocks Black. Now it has a base along the edge.' },
            {
              c: 'B',
              at: 'Q14',
              note: 'Black shores up the outside. White lives, and the enclosure has lost its corner.',
            },
          ],
        },
      ],
    },
    {
      id: 'invade33-cut-trick',
      name: "White's hane-cut trick and the calm answer",
      difficulty: 3,
      order: 14,
      line: [
        { c: 'W', at: 'R17', note: '' },
        { c: 'B', at: 'Q17', note: '' },
        { c: 'W', at: 'R16', note: '' },
        { c: 'B', at: 'R15', note: '' },
        {
          c: 'W',
          at: 'Q15',
          kind: 'trick',
          note: 'White cuts behind the hane. It looks scary, but this stone is weaker than anything of Black’s.',
        },
        {
          c: 'B',
          at: 'R14',
          note: 'The calm answer: Black extends the hane stone. R15 is safe, and the cutting stone has only two liberties.',
        },
        { c: 'W', at: 'Q18', note: 'White hanes at Q18 to grab what corner space it can.' },
        { c: 'B', at: 'P18', note: 'Black blocks, so White can’t crawl toward D16.' },
        { c: 'W', at: 'R18', note: 'White connects. A Black stone on R18 would put Q18 in atari.' },
        {
          c: 'B',
          at: 'O17',
          note: 'Black guards P17 from a distance. A White cut there is in atari at once, and O17 helps chase Q15.',
        },
      ],
    },
  ],
}
