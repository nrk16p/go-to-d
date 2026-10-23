// R29: the points each book move lost in the native KataGo book check (src/book/verify/<family>.json,
// written by tools/check-book.ts). An in-book mistake shows this number: the browser engine is much
// weaker and can rate a real mistake at a few tenths of a point. The files are a few kB each.

import type { FamilyId } from './types'
import invade33 from './verify/invade33.json'
import komoku34 from './verify/komoku34.json'
import openEven from './verify/open-even.json'
import openH4 from './verify/open-h4.json'
import sansan33 from './verify/sansan33.json'
import star44 from './verify/star44.json'

/** Points lost by the book move at `nodeKey` in `family`, or null when the check has no number for it. */
export type CheckedLoss = (family: FamilyId, nodeKey: string) => number | null

type VerifyFile = { nodes: Record<string, { loss?: unknown }> }

const FILES: Record<FamilyId, VerifyFile> = {
  star44,
  invade33,
  komoku34,
  sansan33,
  'open-h4': openH4,
  'open-even': openEven,
}

export const checkedLoss: CheckedLoss = (family, nodeKey) => {
  const nodes = Object.hasOwn(FILES, family) ? FILES[family].nodes : undefined
  const id = `${family}:${nodeKey}`
  const loss = nodes && Object.hasOwn(nodes, id) ? nodes[id].loss : undefined
  return typeof loss === 'number' && Number.isFinite(loss) ? loss : null
}
