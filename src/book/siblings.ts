// Families that start from the same position (R42, spec 1b: one shared tree per starting position). The
// 4-4 point's approaches and the 3-3 invasion under it both start from Black's 4-4 stone in the handicap
// setup, so a move that is book in one is book in the other. They stay separate families for the course,
// the Library and the book check, and a session looks a move up in its siblings' trees before calling it
// off book. Node keys are move paths in the same canonical frame, so one position has one key in all of them.

import type { Book, BookNode, FamilyDef, FamilyId } from './types'

export interface BookIndex {
  /** `family` first, then the families that start the same way: the same setup and the same corner stones. */
  group(family: FamilyId): FamilyId[]
  /** The node with `key` in `family`'s tree ('' is the root). */
  node(family: FamilyId, key: string): BookNode | undefined
  /** The family whose tree holds `node`. */
  familyOf(node: BookNode): FamilyId | undefined
}

/** What makes two families start the same way. */
function startOf(def: FamilyDef): string {
  const stones = def.start.map((s) => `${s.c}${s.at}`).sort()
  return `${def.setup}|${stones.join(' ')}`
}

const built = new WeakMap<Book, BookIndex>()

/** The index of `book`, made once per book. */
export function bookIndex(book: Book): BookIndex {
  const known = built.get(book)
  if (known) return known

  const families = Object.keys(book.families) as FamilyId[]
  const byKey = new Map<FamilyId, Map<string, BookNode>>()
  const familyOf = new Map<BookNode, FamilyId>()
  for (const f of families) {
    const keys = new Map<string, BookNode>()
    const walk = (n: BookNode) => {
      keys.set(n.key, n)
      familyOf.set(n, f)
      n.children.forEach(walk)
    }
    walk(book.families[f].root)
    byKey.set(f, keys)
  }
  const groups = new Map<FamilyId, FamilyId[]>()
  for (const f of families) {
    const start = startOf(book.families[f].def)
    groups.set(f, [f, ...families.filter((g) => g !== f && startOf(book.families[g].def) === start)])
  }

  const index: BookIndex = {
    group: (family) => groups.get(family) ?? [family],
    node: (family, key) => byKey.get(family)?.get(key),
    familyOf: (node) => familyOf.get(node),
  }
  built.set(book, index)
  return index
}
