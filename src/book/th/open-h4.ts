// Thai names and notes for the open-h4 family (whole-board opening, four handicap stones). See types.ts
// for the rules and the glossary at the top of invade33.ts for the words. Extra words for openings:
//   opening = เปิดเกม · handicap game = เกมต่อ (ต่อสี่เม็ด) · even game = เกมเสมอ · star point = จุดดาว
//   side (of the board) = ด้าน · big point = จุดใหญ่ · direction = ทิศทาง · framework = เขตใหญ่
//
// A stub: the content lane fills it with the real lines. `complete` stays false until every name and
// note has Thai.

import type { FamilyTh } from './types'

const TH: FamilyTh = {
  complete: false,
  names: {
    'open-h4-approach-pincer': 'ขาวประชิดต่ำ ดำประกบ',
  },
  notes: {
    'W:R14': 'ขาวประชิดต่ำที่ Q16 เป็นตาแรกที่เจอบ่อยในเกมต่อสี่เม็ด',
    'W:R14/B:Q12': 'ดำประกบโดยมี Q4 คอยช่วย หมากประชิดของขาวเลยโดนหมากดำขนาบสองข้าง',
  },
}

export default TH
