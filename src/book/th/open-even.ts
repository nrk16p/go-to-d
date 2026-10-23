// Thai names and notes for the open-even family (whole-board opening, even game). See types.ts for the
// rules and the glossary at the top of invade33.ts (plus the opening words in open-h4.ts).
//
// A stub: the content lane fills it with the real lines. `complete` stays false until every name and
// note has Thai.

import type { FamilyTh } from './types'

const TH: FamilyTh = {
  complete: false,
  names: {
    'open-even-three-stars': 'ยึดมุมก่อน จุดดาวสามมุม',
  },
  notes: {
    'B:Q16': 'ดำเริ่มที่มุมก่อน เพราะมุมทำเขตได้ง่ายที่สุด',
    'B:Q16/W:D4': 'ขาวเอามุมที่ทแยงกับ Q16',
    'B:Q16/W:D4/B:Q4': 'ดำเอามุมที่สาม Q4 กับ Q16 จะได้ช่วยกันคุมด้านเดียวกัน',
  },
}

export default TH
