// Thai text for every family. Each family file is filled on its own, so lanes never touch the same file.

import type { FamilyId } from '../types'
import INVADE33 from './invade33'
import KOMOKU34 from './komoku34'
import OPEN_EVEN from './open-even'
import OPEN_H4 from './open-h4'
import SANSAN33 from './sansan33'
import STAR44 from './star44'
import type { FamilyTh } from './types'

export type { FamilyTh } from './types'

export const TH: Record<FamilyId, FamilyTh> = {
  star44: STAR44,
  invade33: INVADE33,
  komoku34: KOMOKU34,
  sansan33: SANSAN33,
  'open-h4': OPEN_H4,
  'open-even': OPEN_EVEN,
}
