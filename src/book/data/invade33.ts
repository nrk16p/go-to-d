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

    // Phase 2 (Task 12). Every line below follows KataGo's choices in this setup; see the verify file.
    {
      id: 'invade33-hane-hane-q18',
      name: '3-3 invasion, hane-hane, White hanes at Q18',
      difficulty: 2,
      order: 43,
      line: [
        { c: 'W', at: 'R17', note: '' },
        { c: 'B', at: 'Q17', note: '' },
        { c: 'W', at: 'R16', note: '' },
        { c: 'B', at: 'R15', note: '' },
        { c: 'W', at: 'S15', note: '' },
        { c: 'B', at: 'R14', note: '' },
        { c: 'W', at: 'S14', note: '' },
        { c: 'B', at: 'R13', note: '' },
        {
          c: 'W',
          at: 'Q18',
          note: 'White hanes at Q18 for a bit more corner. It’s a forcing move, so White can play it now or save it.',
        },
        {
          c: 'B',
          at: 'P18',
          note: 'Black blocks at P18. If Black leaves it, White pushes further along the edge toward D16.',
        },
        { c: 'W', at: 'R18', note: 'White connects. Otherwise a Black stone on R18 would put Q18 in atari.' },
        {
          c: 'B',
          at: 'O17',
          note: 'Black guards the cut at P17 with a hanging connection. A White stone on P17 would be in atari at once, and O17 also helps on the D16 side.',
        },
      ],
      branches: [
        {
          after: 11,
          move: {
            c: 'B',
            at: 'P17',
            kind: 'mistake',
            note: 'The solid connection is what older books show. It’s safe but slow: O17 guards the same cut and also works toward D16.',
            confidence: 'low',
          },
          then: [
            {
              c: 'W',
              at: 'J17',
              note: 'White uses the tempo to split the side between Q16 and D16 at J17. P17 does nothing on that side.',
            },
          ],
        },
      ],
    },
    {
      id: 'invade33-long-extend',
      name: '3-3 invasion, the long hane-and-extend',
      difficulty: 1,
      order: 44,
      line: [
        { c: 'W', at: 'R17', note: '' },
        { c: 'B', at: 'Q17', note: '' },
        { c: 'W', at: 'R16', note: '' },
        { c: 'B', at: 'R15', note: '' },
        { c: 'W', at: 'S15', note: '' },
        { c: 'B', at: 'R14', note: '' },
        { c: 'W', at: 'S14', note: '' },
        { c: 'B', at: 'R13', note: '' },
        {
          c: 'W',
          at: 'S13',
          note: 'White crawls once more on the second line. It adds a little eye space, but Black’s wall gets longer too.',
        },
        {
          c: 'B',
          at: 'R12',
          note: 'Black extends again and the wall reaches R12. White is still low and usually plays elsewhere now.',
        },
      ],
      branches: [
        {
          after: 7,
          move: {
            c: 'B',
            at: 'tenuki',
            kind: 'mistake',
            note: 'Black plays elsewhere one move too early. The crawl looked small, but R13, the head of Black’s two stones, is open now.',
          },
          then: [
            {
              c: 'W',
              at: 'R13',
              note: 'White hanes at the head of Black’s two stones. White’s group can grow along the edge now.',
            },
            { c: 'B', at: 'Q13', note: 'Black blocks the way to the center at Q13.' },
            {
              c: 'W',
              at: 'R12',
              note: 'White extends along the edge and has plenty of room. Black’s wall has cutting points at Q14 and Q15.',
            },
          ],
        },
      ],
    },
    {
      id: 'invade33-white-tenuki',
      name: '3-3 invasion, hane-hane, White plays elsewhere',
      difficulty: 2,
      order: 45,
      line: [
        { c: 'W', at: 'R17', note: '' },
        { c: 'B', at: 'Q17', note: '' },
        { c: 'W', at: 'R16', note: '' },
        { c: 'B', at: 'R15', note: '' },
        { c: 'W', at: 'S15', note: '' },
        { c: 'B', at: 'R14', note: '' },
        { c: 'W', at: 'S14', note: '' },
        { c: 'B', at: 'R13', note: '' },
        {
          c: 'W',
          at: 'tenuki',
          note: 'White takes sente and plays elsewhere. The corner can wait.',
        },
        {
          c: 'B',
          at: 'Q18',
          note: 'Black hanes at Q18 first. It’s the point White wanted for itself, and now it shrinks White’s corner instead.',
        },
        {
          c: 'W',
          at: 'S13',
          note: 'White crawls at S13 before blocking. Blocking at R18 first would let Black hane at S13, and the corner would shrink from both ends.',
        },
        { c: 'B', at: 'R12', note: 'Black extends to R12 and keeps White low.' },
        {
          c: 'W',
          at: 'R18',
          note: 'White blocks at R18 so Black gets no further into the corner. The corner is finished, and Black has sente.',
        },
      ],
    },
    {
      id: 'invade33-q18-first',
      name: '3-3 invasion, hane-hane, White hanes at Q18 first',
      difficulty: 2,
      order: 46,
      line: [
        { c: 'W', at: 'R17', note: '' },
        { c: 'B', at: 'Q17', note: '' },
        { c: 'W', at: 'R16', note: '' },
        { c: 'B', at: 'R15', note: '' },
        { c: 'W', at: 'S15', note: '' },
        { c: 'B', at: 'R14', note: '' },
        {
          c: 'W',
          at: 'Q18',
          kind: 'alternative',
          note: 'White hanes at Q18 before crawling. It works, but White still has to crawl at S14 next, so most players keep Q18 for later.',
        },
        {
          c: 'B',
          at: 'P18',
          note: 'Black blocks at P18 so White can’t push along the edge toward D16.',
        },
        {
          c: 'W',
          at: 'S14',
          note: 'White crawls before connecting. Connecting at R18 now would let Black hane at S14 and take the corner’s room.',
        },
        { c: 'B', at: 'R13', note: 'Black blocks at R13 and keeps White on the second line.' },
        {
          c: 'W',
          at: 'R18',
          note: 'Now White connects. The stones are the same as when White crawls first and hanes later.',
        },
        {
          c: 'B',
          at: 'O17',
          note: 'Black guards the cut at P17 from a distance. O17 also helps on the D16 side.',
        },
      ],
      branches: [
        {
          after: 8,
          move: {
            c: 'W',
            at: 'R18',
            kind: 'mistake',
            note: 'White connects too soon. Black hanes at S14 next, and White’s corner loses its room along the edge.',
          },
          then: [
            {
              c: 'B',
              at: 'S14',
              note: 'Black takes S14, the point White skipped. White’s group is short of eye space now and has to fight.',
              confidence: 'low',
            },
          ],
        },
      ],
    },
    {
      id: 'invade33-knight-probe',
      name: "3-3 invasion under a knight's enclosure: White crawls anyway",
      difficulty: 2,
      order: 47,
      line: [
        { c: 'W', at: 'tenuki', note: '' },
        { c: 'B', at: 'O17', note: '' },
        { c: 'W', at: 'R17', note: '' },
        { c: 'B', at: 'R16', note: '' },
        {
          c: 'W',
          at: 'Q17',
          note: 'White crawls toward O17 anyway. There’s no room there, and Black only has to block.',
        },
        {
          c: 'B',
          at: 'P17',
          note: 'Black blocks again at P17. White’s two stones are shut in, with no room for two eyes.',
          confidence: 'low',
        },
        {
          c: 'W',
          at: 'tenuki',
          note: 'White plays elsewhere and leaves the two stones for later. Under an enclosure, the 3-3 invasion is a probe, not a way to live.',
        },
      ],
    },
    {
      id: 'invade33-one-space-probe',
      name: '3-3 invasion under a one-space enclosure',
      difficulty: 2,
      order: 48,
      line: [
        { c: 'W', at: 'tenuki', note: '' },
        {
          c: 'B',
          at: 'O16',
          note: 'Black closes the corner with a one-space jump. The 3-3 point is still open.',
        },
        {
          c: 'W',
          at: 'R17',
          note: 'White invades anyway. Here it’s a probe more than a real try to live.',
        },
        {
          c: 'B',
          at: 'R16',
          note: 'Black blocks on the open side, so White could only crawl toward O16, where there’s no room.',
        },
        {
          c: 'W',
          at: 'R14',
          note: 'White leaves the 3-3 stone and starts a group on the side at R14.',
        },
        { c: 'B', at: 'Q17', note: 'Black takes the corner at Q17. R17 is shut in now.' },
        {
          c: 'W',
          at: 'R11',
          note: 'White extends to R11 for a base on the side. Black has the corner and White has the side, which is a fair trade.',
        },
      ],
    },
    {
      id: 'invade33-stand-squeeze',
      name: "3-3 invasion, stand firm, White's squeeze at R14",
      difficulty: 2,
      order: 49,
      line: [
        { c: 'W', at: 'R17', note: '' },
        { c: 'B', at: 'Q17', note: '' },
        { c: 'W', at: 'R16', note: '' },
        { c: 'B', at: 'Q15', note: '' },
        { c: 'W', at: 'S14', note: '' },
        { c: 'B', at: 'R13', note: '' },
        {
          c: 'W',
          at: 'R14',
          note: 'White wedges in at R14, between Q15 and R13. Black has to answer this one.',
        },
        { c: 'B', at: 'Q14', note: 'Black blocks at Q14, so R14 can’t come out toward the center.' },
        { c: 'W', at: 'R12', note: 'White attaches at R12, at the end of Black’s line. R13 is down to two liberties.' },
        { c: 'B', at: 'Q13', note: 'Black connects R13 to the wall at Q13.' },
        {
          c: 'W',
          at: 'S13',
          note: 'White connects at S13, so Black can’t cut R12 off. Black has sente and plays elsewhere.',
        },
      ],
      branches: [
        {
          after: 3,
          move: {
            c: 'B',
            at: 'S16',
            kind: 'mistake',
            note: 'Black hanes under White to try to kill the corner. It doesn’t work: White pushes out at R15, and S16 ends up on its own.',
          },
          then: [
            { c: 'W', at: 'R15', note: 'White pushes out at R15. Now White’s group can run along the edge.' },
            { c: 'B', at: 'Q15', note: 'Black blocks the way to the center at Q15.' },
            {
              c: 'W',
              at: 'R14',
              note: 'White extends along the edge and has room to live. S16 is a lone Black stone next to White’s group.',
              confidence: 'low',
            },
          ],
        },
      ],
    },
    {
      id: 'invade33-long-extend-r18',
      name: '3-3 invasion, the long hane-and-extend with the R18 hane',
      difficulty: 2,
      order: 50,
      line: [
        { c: 'W', at: 'R17', note: '' },
        { c: 'B', at: 'Q17', note: '' },
        { c: 'W', at: 'R16', note: '' },
        { c: 'B', at: 'R15', note: '' },
        { c: 'W', at: 'S15', note: '' },
        { c: 'B', at: 'R14', note: '' },
        { c: 'W', at: 'S14', note: '' },
        { c: 'B', at: 'R13', note: '' },
        { c: 'W', at: 'S13', note: '' },
        {
          c: 'B',
          at: 'R18',
          note: 'Black hanes at R18 before extending. It takes a point of White’s eye space, and White answers.',
        },
        { c: 'W', at: 'S18', note: 'White blocks at S18 so Black can’t push further into the corner.' },
        {
          c: 'B',
          at: 'R12',
          note: 'Now Black extends to R12. The R18 hane came for free, and White is still low on the second line.',
        },
      ],
    },
    {
      id: 'invade33-jump-cut-trick',
      name: "White's cut against the jump and the calm answer",
      difficulty: 3,
      order: 51,
      line: [
        { c: 'W', at: 'R17', note: '' },
        { c: 'B', at: 'R16', note: '' },
        { c: 'W', at: 'Q17', note: '' },
        { c: 'B', at: 'O17', note: '' },
        {
          c: 'W',
          at: 'P16',
          kind: 'trick',
          note: 'White cuts through the jump. It looks like it splits Black, but P16 is alone among Black’s stones.',
        },
        {
          c: 'B',
          at: 'P17',
          note: 'The calm answer: Black takes P17. White’s corner can’t reach P16 now, and the cutting stone has only two liberties.',
        },
        { c: 'W', at: 'S16', note: 'White hanes at S16 to make the corner as big as it can.' },
        { c: 'B', at: 'S15', note: 'Black blocks, so White can’t slide along the edge toward Q4.' },
        { c: 'W', at: 'S17', note: 'White connects. A Black stone on S17 would put S16 in atari.' },
        {
          c: 'B',
          at: 'R14',
          note: 'Black guards R15 from a distance. A White cut there would be in atari at once, and P16 is still weak.',
        },
      ],
    },
  ],
}
