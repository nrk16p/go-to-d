// Joseki book data model. Authors write FamilyDef objects (src/book/data/*.ts);
// buildBook() merges them into trees (BookNode) that the sparring code walks.

import type { Color, Pt } from '../go/coords'

export type NodeKind = 'joseki' | 'alternative' | 'mistake' | 'trick'

/** One move as an author writes it. Every field except `c`, `at` and `note` is optional. */
export interface MoveSpec {
  c: 'B' | 'W'
  /** A GTP point such as "R14" (upper case, no leading zero), or 'tenuki' for "play the biggest point elsewhere". */
  at: string
  /** The teacher's one- or two-line reason. May be '' on a node another pattern already explains. */
  note: string
  /** Defaults to 'joseki'. */
  kind?: NodeKind
  /** How often the teacher picks this branch. Defaults to 1. */
  weight?: number
  confidence?: 'low'
}

/**
 * A side branch of a pattern. `after` is the number of `line` moves played before it
 * (0 = the branch replaces line[0], line.length = it continues after the last move).
 * `move` is played instead of line[after]; `then` continues from there
 * (for a `mistake`, that is its punishment line).
 */
export interface Branch {
  after: number
  move: MoveSpec
  then?: MoveSpec[]
}

export type SetupId = 'handicap4' | 'even'

export type FamilyId = 'star44' | 'invade33' | 'komoku34' | 'sansan33'

export interface PatternDef {
  id: string
  name: string
  difficulty: 1 | 2 | 3
  /** Course order, ascending. */
  order: number
  /** Overrides the family's setup for this pattern. */
  setup?: SetupId
  /** The main line. It starts with the side to move in the setup (White). */
  line: MoveSpec[]
  branches?: Branch[]
}

export interface FamilyDef {
  id: FamilyId
  name: string
  /** Corner stones placed as setup (canonical frame, upper right). They are not part of the tree. */
  start: MoveSpec[]
  setup: SetupId
  patterns: PatternDef[]
}

export interface BookNode {
  /** nodeKey() of the path from the root, e.g. "W:R14/B:Q14". The root's key is ''. */
  key: string
  /** null for the root. */
  move: { color: Color; at: Pt | 'tenuki' } | null
  note: string
  kind: NodeKind
  weight: number
  confidence?: 'low'
  children: BookNode[]
  /** Every pattern whose line or branches go through this node. */
  patternIds: string[]
  parent: BookNode | null
}

export interface FamilyBook {
  def: FamilyDef
  root: BookNode
}

export interface Book {
  /** Only the families passed to buildBook are present. */
  families: Record<FamilyId, FamilyBook>
  patterns: Record<
    string,
    {
      def: PatternDef
      family: FamilyId
      /** The pattern's main line as nodes: root excluded, leaf last. Branches are not in here. */
      path: BookNode[]
    }
  >
  /** Problems buildBook noticed while merging (conflicting notes, kinds or weights; duplicate pattern ids). validateBook reports them. */
  issues: string[]
}
