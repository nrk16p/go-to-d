// How the teacher chooses its next book move.

import type { BookNode } from '../book/types'

/** A small seeded PRNG (mulberry32): the same seed gives the same session. Returns numbers in [0, 1). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** True if `node` or anything below it has one of `keys`. */
function subtreeHas(node: BookNode, keys: Set<string>): boolean {
  if (keys.has(node.key)) return true
  return node.children.some((c) => subtreeHas(c, keys))
}

/**
 * The teacher's next book move from `node`, or null if there is none to play.
 *
 * - drill: the child on the drilled path (null at the path's end or off the path).
 * - free: a weighted random choice among the joseki, alternative and trick children (never a mistake).
 *   A child whose subtree holds a key the owner missed before counts double, so old misses come back.
 */
export function pickTeacherMove(
  node: BookNode,
  opts: { mode: 'drill' | 'free'; drillPath?: BookNode[]; missed: Set<string>; rng: () => number },
): BookNode | null {
  if (opts.mode === 'drill') {
    return node.children.find((c) => opts.drillPath?.includes(c)) ?? null
  }
  const options = node.children
    .filter((c) => c.kind === 'joseki' || c.kind === 'alternative' || c.kind === 'trick')
    .map((c) => ({ node: c, weight: c.weight * (opts.missed.size > 0 && subtreeHas(c, opts.missed) ? 2 : 1) }))
    .filter((o) => o.weight > 0)
  if (options.length === 0) return null
  const total = options.reduce((sum, o) => sum + o.weight, 0)
  let r = opts.rng() * total
  for (const o of options) {
    r -= o.weight
    if (r < 0) return o.node
  }
  return options[options.length - 1].node
}
