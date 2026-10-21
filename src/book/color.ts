// Book colour letters. Kept apart from build.ts so setups.ts and build.ts do not import each other.

import type { Color } from '../go/coords'

export function colorOf(c: 'B' | 'W'): Color {
  if (c === 'B') return 'black'
  if (c === 'W') return 'white'
  throw new Error(`Bad colour "${String(c)}", use 'B' or 'W'`)
}
