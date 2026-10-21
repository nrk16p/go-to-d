// A small, legal 4-4 family used by the book tests, the check tool's --fixture mode
// and the sparring controller tests. The moves are legal and alternate, they are not
// meant as serious joseki.
//
//   fixture-hane     W R14, B Q14, W Q13, B P13, W R13   (+ mistake branch: Black cuts at R13)
//   fixture-crawl    W R14, B Q14, W R13, B Q13, W R12   (+ branch: White pokes the 1-1 point and loses the stone)
//   fixture-tenuki   W R14, B Q14, W tenuki, B R13, W R15
//
// All three share the first two moves, W R14 and B Q14.

import type { FamilyDef } from '../../src/book/types'

export const FIXTURE_FAMILY: FamilyDef = {
  id: 'star44',
  name: '4-4 point',
  setup: 'handicap4',
  start: [{ c: 'B', at: 'Q16', note: 'The corner stone sits on the 4-4 point.' }],
  patterns: [
    {
      id: 'fixture-hane',
      name: 'Hane underneath',
      difficulty: 1,
      order: 1,
      line: [
        { c: 'W', at: 'R14', note: 'Low approach from the side, a knight’s move from the 4-4 stone.' },
        { c: 'B', at: 'Q14', note: 'Attach on the inside so White cannot settle for free.' },
        { c: 'W', at: 'Q13', note: 'Hane underneath. White gets room on the side.' },
        { c: 'B', at: 'P13', note: 'Block on the left. R13 is now a cutting point.' },
        { c: 'W', at: 'R13', note: 'Connect solidly. Slow, but nothing is left to cut.' },
      ],
      branches: [
        {
          after: 3,
          move: {
            c: 'B',
            at: 'R13',
            kind: 'mistake',
            note: 'Cutting too early. The stone has two liberties and White can chase it.',
          },
          then: [
            { c: 'W', at: 'R12', note: 'Atari from below. The cutting stone has one liberty left.' },
            { c: 'B', at: 'S13', note: 'Black runs along the edge but stays weak.' },
          ],
        },
      ],
    },
    {
      id: 'fixture-crawl',
      name: 'Crawl down the side',
      difficulty: 2,
      order: 2,
      line: [
        { c: 'W', at: 'R14', note: '' },
        { c: 'B', at: 'Q14', note: '' },
        { c: 'W', at: 'R13', note: 'Extend down the side and keep the stones together.' },
        { c: 'B', at: 'Q13', note: 'Black crawls along the fourth line.' },
        { c: 'W', at: 'R12', note: 'White keeps going. The third line is a safe base.' },
      ],
      branches: [
        {
          after: 2,
          move: {
            c: 'W',
            at: 'T19',
            kind: 'mistake',
            note: 'Poking the 1-1 point. The stone has no way to live.',
          },
          then: [
            { c: 'B', at: 'S19', note: 'Atari. Black takes the liberty on the edge side.' },
            { c: 'W', at: 'R13', note: 'White ignores the atari and plays on the side.' },
            { c: 'B', at: 'T18', note: 'Black captures. The 1-1 stone is gone.' },
          ],
        },
      ],
    },
    {
      id: 'fixture-tenuki',
      name: 'Leave it alone',
      difficulty: 3,
      order: 3,
      line: [
        { c: 'W', at: 'R14', note: '' },
        { c: 'B', at: 'Q14', note: '' },
        { c: 'W', at: 'tenuki', note: 'White leaves the corner for now. The fight can wait.' },
        { c: 'B', at: 'R13', note: 'Black pushes in from below and takes away White’s base.' },
        { c: 'W', at: 'R15', note: 'White extends above, next to Black’s corner stone.' },
      ],
    },
  ],
}
