// The logic of the native book check, without any process or file handling (check-book.ts does that):
// which positions to ask KataGo about, how to turn its answers into a loss per book node, which losses are
// wrong for the node's kind, and whether a committed verify file still belongs to the book.
//
// Loss is in points, from the view of the player who makes the node's move:
//   loss = max(0, best move's score - this move's score),
// with the best move picked from the corner only (allowMoves = the corner region). In a whole-board
// family (R46, region 'board') nothing is restricted: the best move is the best anywhere on the board.

import { familyHash, nodeSetups } from '../src/book/build'
import { isBoardFamily, startPosition } from '../src/book/setups'
import type { Book, BookNode, FamilyId, NodeKind, SetupId } from '../src/book/types'
import { parseGtp, toGtp, type Region } from '../src/go/coords'
import { pass, play, type Position } from '../src/go/rules'
import { stonesFromBoard, type Analysis, type AnalysisRequest, type Letter } from './katago-protocol'

/** joseki and alternative nodes may lose at most this much against the engine's best corner (or whole-board) move. */
export const MAX_LOSS_JOSEKI = 2.0
/** mistake nodes must lose at least this much, or the teacher would punish a move the engine likes. */
export const MIN_LOSS_MISTAKE = 1.5
/** A move counts as searched when it got at least this share of the root visits. */
export const MIN_VISIT_SHARE = 0.1

export type FlagReason = 'too-lossy' | 'not-a-mistake'

/** Why a node's loss is wrong for its kind, or null if it is fine. Tricks are not judged. */
export function flagFor(kind: NodeKind, loss: number): FlagReason | null {
  if ((kind === 'joseki' || kind === 'alternative') && loss > MAX_LOSS_JOSEKI) return 'too-lossy'
  if (kind === 'mistake' && loss < MIN_LOSS_MISTAKE) return 'not-a-mistake'
  return null
}

// ---------------------------------------------------------------------------------------------
// The committed result file: src/book/verify/<family>.json

export interface VerifyEntry {
  loss: number
  /** The engine's first choice in the corner at the parent position (GTP). */
  bestAt: string
  kind: NodeKind
}

export interface VerifyFile {
  familyHash: string
  model: string
  visits: number
  /** Keyed by familyId + ':' + nodeKey. */
  nodes: Record<string, VerifyEntry>
}

export function verifyKey(family: FamilyId, nodeKey: string): string {
  return `${family}:${nodeKey}`
}

const KINDS: NodeKind[] = ['joseki', 'alternative', 'mistake', 'trick']

/** Reads a verify file's text and checks its shape. Throws a message naming the first thing wrong. */
export function parseVerifyFile(text: string, where: string): VerifyFile {
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch (e) {
    throw new Error(`${where}: not valid JSON (${(e as Error).message})`)
  }
  const bad = (what: string): never => {
    throw new Error(`${where}: ${what}`)
  }
  if (typeof data !== 'object' || data === null || Array.isArray(data)) return bad('expected an object')
  const o = data as Record<string, unknown>
  if (typeof o.familyHash !== 'string' || o.familyHash === '') bad('familyHash must be a non-empty string')
  if (typeof o.model !== 'string' || o.model === '') bad('model must be a non-empty string')
  if (typeof o.visits !== 'number' || !(o.visits > 0)) bad('visits must be a positive number')
  if (typeof o.nodes !== 'object' || o.nodes === null || Array.isArray(o.nodes)) return bad('nodes must be an object')
  for (const [key, value] of Object.entries(o.nodes as Record<string, unknown>)) {
    const e = value as Partial<VerifyEntry> | null
    if (typeof e !== 'object' || e === null) return bad(`node "${key}" must be an object`)
    if (typeof e.loss !== 'number' || !Number.isFinite(e.loss) || e.loss < 0) bad(`node "${key}": loss must be a number of 0 or more`)
    if (typeof e.bestAt !== 'string' || e.bestAt === '') bad(`node "${key}": bestAt must be a point such as "Q9"`)
    if (!KINDS.includes(e.kind as NodeKind)) bad(`node "${key}": kind must be one of ${KINDS.join(', ')}`)
  }
  return data as VerifyFile
}

// ---------------------------------------------------------------------------------------------
// Which positions to ask about

/** One analysis job: a node under one setup (nearly every node has exactly one). */
export interface NodeTask {
  family: FamilyId
  node: BookNode
  setup: SetupId
  /** A pattern that goes through this node and uses `setup`; it picks the start position. */
  patternId: string
}

/** Every non-root node of the family, parents before children, one task per setup the node is played under. */
export function nodeTasks(book: Book, family: FamilyId): NodeTask[] {
  const fam = book.families[family]
  if (!fam) throw new Error(`Unknown family "${family}"`)
  const out: NodeTask[] = []
  const visit = (parent: BookNode) => {
    for (const node of parent.children) {
      for (const { setup, patternId } of nodeSetups(book, family, node)) out.push({ family, node, setup, patternId })
      visit(node)
    }
  }
  visit(fam.root)
  return out
}

/** Where the engine's replacement for a tenuki is kept: by setup and tenuki node key. */
export function substituteKey(setup: SetupId, nodeKey: string): string {
  return `${setup}|${nodeKey}`
}

/** Nodes on the way from the root (excluded) to `node`, in play order. `node` itself is included when asked. */
function pathTo(node: BookNode, includeSelf: boolean): BookNode[] {
  const out: BookNode[] = []
  for (let n: BookNode | null = includeSelf ? node : node.parent; n && n.move; n = n.parent) out.unshift(n)
  return out
}

/** The tenuki nodes strictly above `node`: their replacement moves must be known before `node` can be asked about. */
export function tenukiAncestors(node: BookNode): BookNode[] {
  return pathTo(node, false).filter((n) => n.move?.at === 'tenuki')
}

/** Points of the region where `mover` may legally play now (occupied points, suicide and ko are left out). */
function legalRegionPoints(region: Region, pos: Position, mover: 'black' | 'white'): string[] {
  const out: string[] = []
  for (let y = region.yMin; y <= region.yMax; y++) {
    for (let x = region.xMin; x <= region.xMax; x++) {
      if (pos.board[y][x] !== null) continue
      if ('illegal' in play(pos, { x, y }, mover)) continue
      out.push(toGtp({ x, y }))
    }
  }
  return out
}

/**
 * - 'region':  the position before the node's move; only corner moves are searched (allowMoves). In a
 *              whole-board family the region is the board, so nothing is restricted.
 * - 'outside': the same position; corner moves are excluded (avoidMoves), so the best move is a tenuki.
 *              A whole-board family has no outside (and no tenuki nodes, validateBook makes sure).
 * - 'free':    the same position, no restriction
 * - 'child':   the position after the node's move, no restriction
 */
export type Scope = 'region' | 'outside' | 'free' | 'child'

/**
 * The query for one node. A tenuki above the node is replayed as the engine's own best outside move
 * (`subs`, filled in by earlier rounds) or as a pass, so every later position is a real one.
 */
export function positionRequest(
  book: Book,
  task: NodeTask,
  subs: ReadonlyMap<string, string>,
  scope: Scope,
  visits: number,
): AnalysisRequest {
  const start = startPosition(book, task.family, task.patternId, 0)
  const where = `${task.family} node "${task.node.key}"`
  let pos = start.pos
  const moves: Array<[Letter, string]> = []

  for (const n of pathTo(task.node, scope === 'child')) {
    const mv = n.move!
    if (mv.color !== pos.toMove) throw new Error(`${where}: ${mv.color} plays at "${n.key}" but ${pos.toMove} is to move`)
    let gtp: string
    if (mv.at === 'tenuki') {
      const sub = subs.get(substituteKey(task.setup, n.key))
      if (sub === undefined) throw new Error(`${where}: tenuki at "${n.key}" has no replacement move yet`)
      gtp = sub
    } else {
      gtp = toGtp(mv.at)
    }
    if (gtp === 'pass') {
      pos = pass(pos)
    } else {
      const r = play(pos, parseGtp(gtp), mv.color)
      if ('illegal' in r) throw new Error(`${where}: ${gtp} at "${n.key}" is illegal (${r.illegal})`)
      pos = r.pos
    }
    moves.push([mv.color === 'black' ? 'B' : 'W', gtp])
  }

  const req: AnalysisRequest = {
    initialStones: stonesFromBoard(start.pos.board),
    initialPlayer: start.pos.toMove === 'black' ? 'B' : 'W',
    moves,
    komi: start.komi,
    maxVisits: visits,
  }
  if (scope === 'region' || scope === 'outside') {
    if (task.node.move && task.node.move.color !== pos.toMove) {
      throw new Error(`${where}: ${task.node.move.color} plays here but ${pos.toMove} is to move`)
    }
    if (isBoardFamily(book.families[task.family].def)) {
      // The whole board is the region: the engine's own first choice is the best move (R46).
      if (scope === 'outside') throw new Error(`${where}: a whole-board family has nothing outside its region`)
      return req
    }
    const points = legalRegionPoints(start.region, pos, pos.toMove)
    if (points.length === 0) throw new Error(`${where}: no legal move left in the corner`)
    if (scope === 'region') req.allowMoves = points
    else req.avoidMoves = points
  }
  return req
}

// ---------------------------------------------------------------------------------------------
// Turning answers into a loss

export interface Verdict {
  /** Points lost against the engine's best corner move, 0 or more, two decimals. */
  loss: number
  /** The engine's first choice in the corner (GTP). */
  bestAt: string
}

function round2(x: number): number {
  return Math.round(x * 100) / 100
}

/**
 * `parent`: the corner-restricted analysis of the position before the move.
 * Uses the move's own entry when the engine gave it a fair share of the visits; otherwise asks for a child analysis.
 */
export function cornerVerdict(parent: Analysis, move: string): Verdict | 'need-child' {
  const best = parent.moves[0]
  const info = parent.moves.find((m) => m.move === move)
  if (!info || info.visits < MIN_VISIT_SHARE * parent.visits) return 'need-child'
  return { loss: round2(Math.max(0, best.scoreLead - info.scoreLead)), bestAt: best.move }
}

/** `child`: unrestricted analysis after the move, so its score is the opponent's; the mover's is the negative. */
export function childVerdict(parent: Analysis, child: Analysis): Verdict {
  const best = parent.moves[0]
  return { loss: round2(Math.max(0, best.scoreLead + child.scoreLead)), bestAt: best.move }
}

/** Tenuki: the best corner move against the best move anywhere else. `substitute` stands in for the tenuki in later positions. */
export function tenukiVerdict(region: Analysis, outside: Analysis): Verdict & { substitute: string } {
  const corner = region.moves[0]
  const away = outside.moves[0]
  return { loss: round2(Math.max(0, corner.scoreLead - away.scoreLead)), bestAt: corner.move, substitute: away.move }
}

export type AnalyseAll = (reqs: AnalysisRequest[]) => Promise<Analysis[]>

export interface FamilyResult {
  /** Keyed by familyId + ':' + nodeKey, in tree order. */
  nodes: Record<string, VerifyEntry>
  /** The move each tenuki node was replaced by in later positions (GTP or "pass"), keyed "family:nodeKey@setup". For the log only. */
  substitutes: Record<string, string>
}

function chunkKey(task: NodeTask, suffix: string): string {
  return `${task.setup}|${task.node.parent?.key ?? ''}|${suffix}`
}

/**
 * Asks the engine about every node of one family. The queries go out in rounds: a node under a tenuki has to
 * wait until the round that learned the tenuki's replacement move, so a book without tenuki takes one round.
 * Siblings share one query for their common parent position.
 */
export async function analyseFamily(
  book: Book,
  family: FamilyId,
  analyseAll: AnalyseAll,
  opts: { visits: number; log?: (message: string) => void },
): Promise<FamilyResult> {
  const { visits, log } = opts
  const tasks = nodeTasks(book, family)
  const subs = new Map<string, string>()
  const done = new Map<NodeTask, Verdict>()
  const substitutes: Record<string, string> = {}
  let remaining = tasks.slice()
  let round = 0

  while (remaining.length > 0) {
    round++
    const ready = remaining.filter((t) => tenukiAncestors(t.node).every((a) => subs.has(substituteKey(t.setup, a.key))))
    if (ready.length === 0) throw new Error(`${family}: cannot order the nodes (a tenuki never got a replacement move)`)

    // One query per parent position, shared by its children.
    const wanted = new Map<string, AnalysisRequest>()
    for (const t of ready) {
      if (t.node.move?.at === 'tenuki') {
        wanted.set(chunkKey(t, 'outside'), positionRequest(book, t, subs, 'outside', visits))
      }
      const key = chunkKey(t, 'region')
      if (!wanted.has(key)) wanted.set(key, positionRequest(book, t, subs, 'region', visits))
    }
    log?.(`${family} round ${round}: ${ready.length} nodes, ${wanted.size} positions`)
    const keys = [...wanted.keys()]
    const answers = new Map<string, Analysis>()
    ;(await analyseAll([...wanted.values()])).forEach((a, i) => answers.set(keys[i], a))

    const needChild: NodeTask[] = []
    for (const t of ready) {
      const region = answers.get(chunkKey(t, 'region'))!
      const at = t.node.move!.at
      if (at === 'tenuki') {
        const v = tenukiVerdict(region, answers.get(chunkKey(t, 'outside'))!)
        done.set(t, { loss: v.loss, bestAt: v.bestAt })
        subs.set(substituteKey(t.setup, t.node.key), v.substitute)
        substitutes[`${verifyKey(family, t.node.key)}@${t.setup}`] = v.substitute
      } else {
        const v = cornerVerdict(region, toGtp(at))
        if (v === 'need-child') needChild.push(t)
        else done.set(t, v)
      }
    }

    if (needChild.length > 0) {
      log?.(`${family} round ${round}: ${needChild.length} moves need a look at the position after them`)
      const children = await analyseAll(needChild.map((t) => positionRequest(book, t, subs, 'child', visits)))
      needChild.forEach((t, i) => {
        done.set(t, childVerdict(answers.get(chunkKey(t, 'region'))!, children[i]))
      })
    }
    remaining = remaining.filter((t) => !done.has(t))
  }

  // One entry per node, in tree order. A node judged under two setups keeps the worse of the two.
  const nodes: Record<string, VerifyEntry> = {}
  for (const t of tasks) {
    const v = done.get(t)!
    const key = verifyKey(family, t.node.key)
    const old = nodes[key]
    if (!old || v.loss > old.loss) nodes[key] = { loss: v.loss, bestAt: v.bestAt, kind: t.node.kind }
  }
  return { nodes, substitutes }
}

// ---------------------------------------------------------------------------------------------
// Checking a result file against the book

export interface Flagged {
  family: FamilyId
  nodeKey: string
  kind: NodeKind
  loss: number
  bestAt: string
  reason: FlagReason
  patternIds: string[]
  note: string
}

export interface CacheCheck {
  /** The file was made for this exact version of the family. */
  fresh: boolean
  /** Node keys the file has no result for. */
  missing: string[]
  flagged: Flagged[]
}

/** Every non-root node once, parents before children. */
function allNodes(book: Book, family: FamilyId): BookNode[] {
  const fam = book.families[family]
  if (!fam) throw new Error(`Unknown family "${family}"`)
  const out: BookNode[] = []
  const visit = (parent: BookNode) => {
    for (const node of parent.children) {
      out.push(node)
      visit(node)
    }
  }
  visit(fam.root)
  return out
}

/** Freshness, missing nodes and flagged losses. A node is judged by the kind it has now. */
export function checkCache(book: Book, family: FamilyId, file: VerifyFile): CacheCheck {
  const check: CacheCheck = { fresh: file.familyHash === familyHash(book, family), missing: [], flagged: [] }
  for (const node of allNodes(book, family)) {
    const key = verifyKey(family, node.key)
    const entry = Object.hasOwn(file.nodes, key) ? file.nodes[key] : undefined
    if (!entry) {
      check.missing.push(node.key)
      continue
    }
    const reason = flagFor(node.kind, entry.loss)
    if (reason) {
      check.flagged.push({
        family,
        nodeKey: node.key,
        kind: node.kind,
        loss: entry.loss,
        bestAt: entry.bestAt,
        reason,
        patternIds: node.patternIds.slice(),
        note: node.note,
      })
    }
  }
  return check
}

function why(f: Flagged): string {
  return f.reason === 'too-lossy'
    ? `loses ${f.loss} points, the limit is ${MAX_LOSS_JOSEKI.toFixed(1)}`
    : `loses only ${f.loss} points, a mistake must lose at least ${MIN_LOSS_MISTAKE.toFixed(1)}`
}

/** One line per problem, for test failures and the CLI. Empty when the cache is fresh, complete and clean. */
export function describeCheck(family: FamilyId, check: CacheCheck): string[] {
  const lines: string[] = []
  if (!check.fresh) {
    lines.push(`${family}: verify file is out of date, the family changed since the engine ran. Run: npx tsx tools/check-book.ts --family ${family}`)
  }
  if (check.missing.length > 0) {
    lines.push(`${family}: no engine result for ${check.missing.length} node(s): ${check.missing.join(', ')}`)
  }
  for (const f of check.flagged) {
    lines.push(
      `${family} ${f.nodeKey} (${f.kind}, ${why(f)}; engine prefers ${f.bestAt}; pattern ${f.patternIds.join(', ')}): ${JSON.stringify(f.note)}`,
    )
  }
  return lines
}

/** The table the CLI prints: one row per flagged node, the note on the line below. */
export function formatFlagTable(flagged: Flagged[]): string {
  if (flagged.length === 0) return 'Nothing flagged.'
  const rows = flagged.map((f) => [f.family, f.patternIds.join(','), f.nodeKey, f.kind, f.loss.toFixed(2), f.bestAt])
  const header = ['FAMILY', 'PATTERNS', 'NODE', 'KIND', 'LOSS', 'ENGINE']
  const widths = header.map((h, i) => Math.max(h.length, ...rows.map((r) => r[i].length)))
  const line = (cells: string[]) => cells.map((c, i) => (i === cells.length - 1 ? c : c.padEnd(widths[i] + 2))).join('')
  const out = [line(header)]
  flagged.forEach((f, i) => {
    out.push(line(rows[i]))
    out.push(`    ${f.note === '' ? '(no note)' : f.note}`)
  })
  return out.join('\n')
}
