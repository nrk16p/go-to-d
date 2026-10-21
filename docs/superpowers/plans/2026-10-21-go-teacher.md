# Go-to-D Joseki Sparring Teacher — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A static web app where a KataGo-backed "3-dan teacher" spars corner joseki (4-4, 3-3 invasion, 3-4/4-3, 3-3 point) with the owner and corrects every move.

**Architecture:** Vite + React + TypeScript single-page app on GitHub Pages. Pure TS core (rules, book tree, judge, session controller, spaced repetition) is fully unit-tested with a fake engine. The engine is web-katrain's MIT KataGo port (TF.js in a Web Worker) vendored under `src/engine/katago/`, wrapped by a small `TeacherEngine` interface. Joseki moves are authored as lines, merged into trees, and checked offline by native KataGo; the check results are committed so CI can enforce them without an engine.

**Tech Stack:** Vite 7, React 19, TypeScript 5.9, Vitest 4, @tensorflow/tfjs 4.22 (+ wasm, webgpu backends), pako, vite-plugin-pwa, Playwright (e2e/perf), native KataGo 1.18 via Homebrew (book check only, never shipped).

**Spec:** `docs/superpowers/specs/2026-10-21-go-teacher-design.md`

## Global Constraints

- Static site only, deployed to GitHub Pages (base path `/go-to-d/`); no backend, no secrets in the repo.
- Works on iPhone Safari and Android Chrome: touch board, phone width with 16px gutter and no horizontal scroll; light and dark themes.
- Engine runs in a Web Worker; first model download ≤ ~40 MB; cached afterwards; app stays usable (book-only) if the engine fails.
- Teacher answer target: ≤ ~3 s per corner move on a phone (desktop Chrome with 4× CPU throttle is the proxy); never more than ~5 s.
- Progress in localStorage, every access wrapped in try/catch; Export/Import JSON in Settings.
- Board coordinates: `Pt = {x, y}`, x 0..18 left→right, y 0..18 top→bottom (same as web-katrain `board[y][x]`); book uses GTP strings (`"Q16"`, columns skip `I`).
- Canonical book frame: studied corner is the **upper-right**; corner stone colour is **Black**; `defend` = owner plays Black, `attack` = owner plays White.
- Thresholds default: `fine ≤ 1.5` points lost, `big > 4.0`; book check: `joseki`/`alternative` within **2.0** points of engine best in region, `mistake` must lose **≥ 1.5**.
- Copy (UI text and every book `note`): English, short, concrete, a stronger friend talking. No "optimal", "it is important to note", "leverage", hype or filler. Load the `humanizer` skill before writing copy.
- Vendored code keeps its MIT notice: `LICENSES/web-katrain.txt` + a header line in each vendored file.
- Book notes are written fresh — never copied from books or websites.

## Review Focus

1. **Engine fails or is slow to load** (offline first visit, WebGPU crash on Safari) → drills still run on the book; off-book moves get an `unjudged` verdict with a short notice instead of freezing. Test in Task 5.
2. **Taps while the teacher is thinking, or double taps** → ignored; never two owner moves in a row. Test in Task 5.
3. **Illegal taps** (occupied, suicide, ko) → no move, short message, no verdict, no SRS penalty. Test in Task 5.
4. **Storage missing or corrupt** (private window, bad JSON, import of a wrong file) → app starts with fresh progress; a bad import shows an error and keeps current progress. Test in Task 6.
5. **Symmetry + captures** → every book path replays legally under all 8 symmetries with correct captures and stays inside the transformed corner region. Test in Task 2.

---

## File Structure

```
index.html, vite.config.ts, tsconfig*.json, package.json, eslint.config.js
LICENSES/web-katrain.txt
public/models/                       model file(s) fetched by script (gitignored if > 25 MB)
scripts/fetch-model.mjs              downloads the chosen model into public/models
scripts/copy-tfjs-wasm.mjs           copies tfjs wasm binaries into public/
tools/check-book.ts                  native-KataGo book check → src/book/verify/<family>.json
tools/engine-bench/                  Playwright model/backend benchmark (Task 3)
docs/engine-choice.md                benchmark results + chosen model
src/go/coords.ts                     Pt, GTP parse/format, 8 symmetries, regions
src/go/rules.ts                      Position, play(), captures, ko, legality
src/book/types.ts                    book data types
src/book/build.ts                    lines → trees, pattern paths
src/book/validate.ts                 structural + replay checks
src/book/setups.ts                   whole-board setups
src/book/data/{star44,invade33,komoku34,sansan33}.ts   authored content
src/book/verify/<family>.json        committed native-KataGo results, one file per family
src/engine/katago/**                 vendored web-katrain engine (+ the few utils it imports)
src/engine/teacher.ts                TeacherEngine interface + worker-backed impl
src/engine/model.ts                  MODEL_URL, visits defaults
src/session/judge.ts                 move → Verdict
src/session/pick.ts                  teacher branch choice
src/session/controller.ts            SparController (state machine + engine calls)
src/progress/srs.ts                  Leitner scheduling
src/progress/store.ts                persistence, export/import, streak
src/ui/Board.tsx                     SVG board, corner zoom, touch, markers
src/ui/screens/{Today,Spar,Report,Library,Pattern,Settings}.tsx
src/ui/router.ts                     hash routes
src/ui/copy.ts                       fixed UI strings
src/ui/theme.css                     tokens, light/dark
tests/**                             vitest; e2e/** Playwright
.github/workflows/ci.yml, deploy.yml
```

---

### Task 1: Scaffold + Go core (coords, rules)

**Files:**
- Create: project scaffold (Vite React TS), `src/go/coords.ts`, `src/go/rules.ts`
- Test: `tests/go/coords.test.ts`, `tests/go/rules.test.ts`

**Interfaces:**
- Produces:
  - `type Pt = { x: number; y: number }`, `type Color = 'black' | 'white'`, `type Board = (Color | null)[][]`, `type Move = { x: number; y: number; player: Color }`
  - `parseGtp(s: string): Pt`, `toGtp(p: Pt): string`
  - `type Sym = 0|1|2|3|4|5|6|7`; `transform(p: Pt, sym: Sym): Pt` (0 = identity; 1–3 rotations; 4–7 reflections); `inverse(sym: Sym): Sym`
  - `type Region = { xMin: number; xMax: number; yMin: number; yMax: number }`; `CORNER_REGION: Region = { xMin: 8, xMax: 18, yMin: 0, yMax: 10 }`; `transformRegion(r: Region, sym: Sym): Region`; `inRegion(p: Pt, r: Region): boolean`
  - `interface Position { board: Board; toMove: Color; ko: Pt | null; history: Move[]; boards: Board[] }` (boards = previous boards, newest last, for engine history)
  - `emptyPosition(): Position`, `placeSetup(pos: Position, stones: Move[], toMove: Color): Position`
  - `play(pos: Position, p: Pt, color: Color): { pos: Position; captured: Pt[] } | { illegal: 'occupied' | 'suicide' | 'ko' }`
  - `otherColor(c: Color): Color`

- [ ] **Step 1:** Scaffold with `npm create vite@latest . -- --template react-ts`, add vitest, eslint; `vite.config.ts` base `/go-to-d/`. `npm test` runs vitest.
- [ ] **Step 2: Write failing tests**
  - `parseGtp('Q16')` → `{x:15,y:3}`; `parseGtp('A19')` → `{x:0,y:0}`; `parseGtp('T1')` → `{x:18,y:18}`; `toGtp` round-trips all 361 points; `parseGtp('I5')` throws.
  - `transform` of all 8 syms is a bijection on the board; `transform(transform(p,s), inverse(s))` = p; `transform(parseGtp('Q16'), s)` lands on each of the four star points across syms.
  - `transformRegion(CORNER_REGION, s)` contains `transform(Q16, s)` for every s.
  - `play`: single capture removes the stone; capturing a group of 3; suicide → `{illegal:'suicide'}`; immediate ko recapture → `{illegal:'ko'}`, legal again after one move elsewhere; occupied → `{illegal:'occupied'}`; snapback capture is legal.
- [ ] **Step 3:** Run `npx vitest run tests/go` → FAIL.
- [ ] **Step 4:** Implement (simple ko only; flood-fill liberties).
- [ ] **Step 5:** Run → PASS. `npx tsc -b` clean.
- [ ] **Step 6:** Commit `feat: go coords and rules core`.

### Task 2: Book format, tree builder, validator, setups

**Files:**
- Create: `src/book/types.ts`, `src/book/build.ts`, `src/book/validate.ts`, `src/book/setups.ts`, `tests/book/fixture.ts`
- Test: `tests/book/build.test.ts`, `tests/book/validate.test.ts`

**Interfaces:**
- Consumes: Task 1 `parseGtp`, `transform`, `play`, `placeSetup`, `CORNER_REGION`.
- Produces:
  - `type NodeKind = 'joseki' | 'alternative' | 'mistake' | 'trick'`
  - `interface MoveSpec { c: 'B' | 'W'; at: string /* GTP or 'tenuki' */; note: string; kind?: NodeKind; weight?: number; confidence?: 'low' }`
  - `interface Branch { after: number; move: MoveSpec; then?: MoveSpec[] }` — `after` = number of `line` moves played before the branch; `then` = continuation (for a `mistake`, its punishment line).
  - `interface PatternDef { id: string; name: string; difficulty: 1 | 2 | 3; order: number; setup?: SetupId; line: MoveSpec[]; branches?: Branch[] }`
  - `type FamilyId = 'star44' | 'invade33' | 'komoku34' | 'sansan33'`; `type SetupId = 'handicap4' | 'even'`
  - `interface FamilyDef { id: FamilyId; name: string; start: MoveSpec[]; setup: SetupId; patterns: PatternDef[] }`
  - `interface BookNode { key: string; move: { color: Color; at: Pt | 'tenuki' } | null /* null = root */; note: string; kind: NodeKind; weight: number; confidence?: 'low'; children: BookNode[]; patternIds: string[]; parent: BookNode | null }`
  - `interface Book { families: Record<FamilyId, { def: FamilyDef; root: BookNode }>; patterns: Record<string, { def: PatternDef; family: FamilyId; path: BookNode[] /* root excluded, leaf last */ }> }`
  - `buildBook(families: FamilyDef[]): Book`
  - `validateBook(book: Book): string[]` (empty = valid)
  - `SETUPS: Record<SetupId, (cornerStones: Move[]) => { stones: Move[]; toMove: Color; komi: number }>`
  - `startPosition(book: Book, family: FamilyId, patternId: string | null, sym: Sym): { pos: Position; komi: number; region: Region }`
  - `nodeKey(path: Array<{color: Color; at: Pt | 'tenuki'}>): string` (canonical frame, e.g. `"W:R14/B:O17"`)
- Setups (canonical frame): `handicap4` = studied corner stones + Black D4, D16, Q4; White to move; komi 0.5. `even` = studied corner stones + Black D4, White D16, White Q4; White to move; komi 7.5. `tenuki` in a line means "play the biggest point elsewhere"; during replay it is applied as no board change but flips the colour to move.

- [ ] **Step 1: Write failing tests** with a fixture family of 3 patterns sharing a 2-move prefix plus one `mistake` branch with a 2-move `then`:
  - shared prefix nodes are merged (one node, `patternIds` has all 3 ids); each pattern's `path` ends on its leaf.
  - a shared node with an empty `note` in a later pattern inherits the first note; two different non-empty notes on the same node → `validateBook` error mentioning the node key.
  - `validateBook` errors: a node with no note after merging; an illegal move (occupied); colours not alternating (except after `tenuki`); a move outside `CORNER_REGION`; duplicate pattern id.
  - **Replay under symmetry:** for every pattern and every `Sym`, replaying `startPosition` + path via `play` is legal and every move lies in `transformRegion(CORNER_REGION, sym)`; a fixture branch that captures a stone gives the same captures under all 8 syms.
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Implement `buildBook`, `validateBook`, `SETUPS`, `startPosition`, `nodeKey`.
- [ ] **Step 4:** Run → PASS.
- [ ] **Step 5:** Commit `feat: joseki book format, builder and validator`.

### Task 3: Engine — vendor, model benchmark, TeacherEngine

**Files:**
- Create: `src/engine/katago/**` (vendored from github.com/Sir-Teo/web-katrain `src/engine/katago/*` plus only the utils it imports: `utils/goRules`, `utils/gameLogic`, `utils/superko`, `utils/analysisQueue`, `utils/animationFrame`, `utils/workerThreads`, `utils/publicUrl`, `utils/browserWorker`, `lib/gtp`, and the needed parts of `types.ts`), `LICENSES/web-katrain.txt`, `scripts/fetch-model.mjs`, `scripts/copy-tfjs-wasm.mjs`, `src/engine/model.ts`, `src/engine/teacher.ts`, `tools/engine-bench/`, `docs/engine-choice.md`
- Test: `tests/engine/teacher.test.ts` (node, tfjs CPU backend, tiny model)

**Interfaces:**
- Consumes: Task 1 `Position`, `Region`, `Pt`, `Color`.
- Produces:
  - `interface CornerAnalysis { toMove: Color; cornerBest: { pt: Pt; scoreLead: number }; tenukiBest: { pt: Pt; scoreLead: number } | null; candidates: Array<{ pt: Pt; scoreLead: number; prior: number }> }` — all `scoreLead` from `toMove`'s point of view; `candidates` are inside the region, best first.
  - `interface TeacherEngine { status(): 'loading' | 'ready' | 'failed'; ready(): Promise<{ backend: string; model: string }>; analyzeCorner(pos: Position, komi: number, region: Region, opts?: { visits?: number; maxTimeMs?: number }): Promise<CornerAnalysis>; scoreFor(pos: Position, komi: number, color: Color, opts?: { visits?: number }): Promise<number> }`
  - `createTeacherEngine(modelUrl?: string): TeacherEngine` (worker-backed); `MODEL_URL`, `DEFAULT_VISITS`, `DEFAULT_MAX_TIME_MS` in `src/engine/model.ts`.
- Approach: `analyzeCorner` runs two searches — one with `regionOfInterest = region` (→ `cornerBest`, `candidates`) and one unrestricted (→ `tenukiBest` = best move outside region, or null if none in top-K). Convert web-katrain's Black-perspective scores to `toMove` perspective.

- [ ] **Step 1:** Vendor the engine; add `// Vendored from Sir-Teo/web-katrain (MIT), see LICENSES/web-katrain.txt` to each file; get `npx tsc -b` clean with no unused UI code pulled in.
- [ ] **Step 2: Write failing test** (tiny `g170-b6c96` model, tfjs CPU backend, visits 16): on `handicap4` setup with White to move and region = `CORNER_REGION`, `analyzeCorner` returns `cornerBest.pt` inside the region, `candidates.length > 0`, all candidates inside the region, and `tenukiBest` (if non-null) outside it. `scoreFor` returns a finite number and flips sign (±1 tolerance) between `black` and `white`.
- [ ] **Step 3:** Run → FAIL; implement `teacher.ts`; run → PASS.
- [ ] **Step 4: Model benchmark.** `tools/engine-bench` (Playwright) loads the app's engine page in Chromium with 4× CPU throttle and in WebKit, for each candidate model: `g170-b6c96` (~3.8 MB), a g170 `b10c128` net, a g170 `b15c192` net, and any small kata1 net the vendored parser supports (try `kata1-tf2-b10c384`). Record per model × browser: download size, load time, ms per `analyzeCorner` at 100/200/400 visits, backend used. Strength check: on 30 positions from the native-KataGo reference (Task 4's tool, `b18c384nbt`), how often the model's `cornerBest` is in the reference's top-3.
- [ ] **Step 5:** Pick the strongest model with size ≤ 40 MB, `analyzeCorner` ≤ 3 s in throttled Chromium **and** WebKit at the chosen visits, and top-3 agreement ≥ 80%. Write numbers + choice to `docs/engine-choice.md`; set `MODEL_URL`/`DEFAULT_VISITS`. If nothing passes, stop and report BLOCKED with the table.
- [ ] **Step 6:** Commit `feat: in-browser KataGo teacher engine` (model binary not committed if > 25 MB; `fetch-model.mjs` runs in `prebuild`).

### Task 4: Native KataGo book check

**Files:**
- Create: `tools/check-book.ts` (arg: `--family <id>`), `src/book/verify/<family>.json`, `tools/README.md`
- Test: `tests/book/verify.test.ts`

**Interfaces:**
- Consumes: Task 2 `buildBook`, `startPosition`, `nodeKey`; Task 1 rules.
- Produces: `src/book/verify/<family>.json` = `{ familyHash: string; model: string; visits: number; nodes: Record<string /* familyId + ':' + nodeKey */, { loss: number; bestAt: string; kind: NodeKind }> }`; `familyHash(book: Book, family: FamilyId): string` (stable hash of that family's moves, kinds, setup) exported from `src/book/build.ts`. One file per family so content tasks for different families never touch the same file.
- Approach: `npx tsx tools/check-book.ts` spawns `katago analysis` (Homebrew, model `kata1-b18c384nbt-s9996604416-d4316597426.bin.gz` in `~/.katago/`), for each non-root book node analyses the parent position restricted to the corner region (KataGo `allowMoves` = region points) at 400 visits; `loss` = best scoreLead − scoreLead of the node's move (mover's view). `tenuki` nodes: compare best-in-region vs best-outside-region. Prints flagged nodes; writes the cache.

- [ ] **Step 1: Write failing test:** for every family with patterns, `verify/<family>.json.familyHash === familyHash(book, family)` (cache is fresh); every `joseki`/`alternative` node has `loss ≤ 2.0`; every `mistake` node has `loss ≥ 1.5`; message lists offending node keys with their `note`.
- [ ] **Step 2:** `brew install katago`, download the b18 model, implement the tool, run it on the fixture-only book; test PASS.
- [ ] **Step 3:** Commit `feat: native KataGo book check with committed cache`.

### Task 5: Session core — judge, pick, SparController

**Files:**
- Create: `src/session/judge.ts`, `src/session/pick.ts`, `src/session/controller.ts`, `tests/session/fakeEngine.ts`
- Test: `tests/session/judge.test.ts`, `tests/session/pick.test.ts`, `tests/session/controller.test.ts`

**Interfaces:**
- Consumes: Tasks 1–3 (`Position`, `play`, `Book`, `BookNode`, `startPosition`, `TeacherEngine`, `CornerAnalysis`).
- Produces:
  - `type Side = 'attack' | 'defend'`; `interface Thresholds { fine: number; big: number }` (defaults 1.5 / 4.0)
  - `type Verdict = { type: 'good'; note: string; kind: 'joseki' | 'alternative' } | { type: 'other-joseki'; note: string; patternIds: string[] } | { type: 'mistake'; better: Pt | 'tenuki'; pointsLost: number | null; big: boolean; note?: string; inBook: boolean } | { type: 'fine-offbook'; pointsLost: number; bookMove: Pt | 'tenuki' | null } | { type: 'unjudged'; reason: 'engine-failed' | 'engine-loading' }`
  - `judgeMove(args: { node: BookNode | null; played: Pt | 'tenuki'; mode: 'drill' | 'free'; drillPatternId?: string; before: CornerAnalysis | null; scoreAfter: number | null; thresholds: Thresholds }): Verdict`
    - in-book child with kind joseki/alternative: drill mode and child not on the drilled pattern's path → `other-joseki`; else `good`.
    - in-book child with kind `mistake` → `mistake` with `inBook: true`, `note`, `better` = the drilled path's move (drill) or the highest-weight joseki child (free), `pointsLost` from engine if available else null.
    - off-book: no engine data → `unjudged`; loss = `max(0, before.cornerBest.scoreLead − scoreAfter)` (tenuki: use `before.tenukiBest.scoreLead`); loss ≤ fine → `fine-offbook`; else `mistake` with `big = loss > thresholds.big`, `better = before.cornerBest.pt`.
  - `pickTeacherMove(node: BookNode, opts: { mode: 'drill' | 'free'; drillPath?: BookNode[]; missed: Set<string> /* node keys */; rng: () => number }): BookNode | null` — drill: the child on the path; free: weighted random over joseki/alternative/trick children, weight ×2 for children whose subtree contains a missed key; null if leaf.
  - `mulberry32(seed: number): () => number`
  - `class SparController` with `constructor(book: Book, engine: TeacherEngine, config: { mode: 'drill' | 'free'; family: FamilyId; patternId?: string; side: Side; sym: Sym; seed: number; thresholds: Thresholds; missed: Set<string> })`, `subscribe(fn: (s: SparState) => void): () => void`, `start(): Promise<void>`, `ownerPlay(p: Pt | 'tenuki'): Promise<void>`, `retry(): void`, `playOn(): Promise<void>`, `switchTo(patternId: string): void`, `state: SparState`
  - `interface SparState { pos: Position; komi: number; region: Region; node: BookNode | null; offBookMoves: number; status: 'teacher-thinking' | 'owner-to-move' | 'stopped' | 'done'; lastVerdict: Verdict | null; log: Array<{ move: Move | { tenuki: Color }; by: 'owner' | 'teacher'; verdict?: Verdict }>; result: SessionResult | null; message: string | null }`
  - `interface SessionResult { patternIds: string[]; side: Side; clean: boolean; mistakes: number; pointsLost: number; missedKeys: string[] }`
- Behaviour: start → if teacher moves first, teacher plays. On owner's turn the controller precomputes `analyzeCorner` (non-blocking). `ownerPlay` ignored unless `status === 'owner-to-move'`; illegal → `message` set, nothing else changes. Verdict `mistake` → `status: 'stopped'` (retry undoes the owner move; playOn continues with the punishment line or engine reply). Teacher off-book reply = `cornerBest` (or random among candidates within 0.5 pts of best, via rng); teacher plays tenuki and ends the session if `tenukiBest.scoreLead > cornerBest.scoreLead + 1.0`. Done when a book leaf is reached (drill: the drilled pattern's leaf), after 6 moves off book, or after teacher tenuki. `tenuki` by either side places the stone at `tenukiBest.pt` (or the biggest free star/side point from a fixed list if no engine).

- [ ] **Step 1: Write failing tests** (with `FakeEngine` returning scripted analyses):
  - judge: each Verdict branch above incl. drill `other-joseki`, free-mode `good` for the same move, `unjudged` when `before` is null, tenuki loss uses `tenukiBest`.
  - pick: drill always follows the path; free with seeded rng over 1000 picks matches weights ±5%; missed-subtree weight doubled; never returns `mistake` nodes.
  - controller: full clean drill run → `status 'done'`, `result.clean === true`; a book mistake → `stopped`, `retry()` restores the position before the owner's move; `playOn()` plays the punishment line; **double `ownerPlay` while teacher-thinking → second call ignored** (log has one owner move); **illegal tap → `message` set, log unchanged, no verdict**; **engine `ready()` rejects → in-book drill still completes, off-book move gives `unjudged`**; 6 off-book moves → done.
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement. **Step 4:** Run → PASS.
- [ ] **Step 5:** Commit `feat: sparring session core`.

### Task 6: Progress — SRS and storage

**Files:**
- Create: `src/progress/srs.ts`, `src/progress/store.ts`
- Test: `tests/progress/srs.test.ts`, `tests/progress/store.test.ts`

**Interfaces:**
- Consumes: Task 5 `SessionResult`, `Side`, `Thresholds`.
- Produces:
  - `interface ReviewState { box: 0 | 1 | 2 | 3 | 4 | 5; due: string /* local YYYY-MM-DD */; runs: number; cleanRuns: number; missedKeys: string[] }`
  - `BOX_DAYS = [0, 1, 3, 7, 14, 30]`; `reviewKey(patternId: string, side: Side): string` (`"id:side"`)
  - `applyResult(prev: ReviewState | undefined, clean: boolean, missedKeys: string[], today: string): ReviewState` — clean: box+1 (max 5), due = today + BOX_DAYS[newBox]; missed: box 1, due tomorrow, missedKeys merged (keep last 20).
  - `isMastered(r: ReviewState): boolean` (box ≥ 4); `dueKeys(p: Progress, today: string): string[]`
  - `interface Settings { thresholds: Thresholds; visits: number; newPerDay: number /* 2 */ ; iosHintDismissed: boolean }`
  - `interface Progress { version: 1; reviews: Record<string, ReviewState>; streak: { count: number; lastDay: string | null }; settings: Settings }`
  - `loadProgress(): Progress`, `saveProgress(p: Progress): void`, `recordSession(p: Progress, r: SessionResult, today: string): Progress` (updates every pattern in `r.patternIds` and the streak once per day), `exportProgress(p: Progress): string`, `importProgress(json: string): Progress` (throws `Error('Not a Go-to-D progress file')` on bad input), `todayLocal(d?: Date): string`
- [ ] **Step 1: Write failing tests:** box transitions and due dates across month ends; mastered; streak +1 next day, unchanged same day, reset to 1 after a gap; **`localStorage` getItem throws → `loadProgress` returns defaults; corrupt JSON → defaults; `saveProgress` with throwing setItem doesn't throw; `importProgress('{"foo":1}')` throws the message above and leaves stored progress unchanged**; export→import round-trips.
- [ ] **Step 2:** FAIL → implement → PASS.
- [ ] **Step 3:** Commit `feat: spaced repetition and progress storage`.

### Task 7: Board + Spar + Report screens

**Files:**
- Create: `src/ui/Board.tsx`, `src/ui/screens/Spar.tsx`, `src/ui/screens/Report.tsx`, `src/ui/copy.ts`, `src/ui/theme.css`, `src/ui/router.ts`, `src/App.tsx`
- Test: `tests/ui/board.test.tsx` (vitest + @testing-library/react, jsdom)

**Interfaces:**
- Consumes: Task 5 `SparController`, `SparState`, `Verdict`; Task 6 `recordSession`, `loadProgress`, `saveProgress`; Task 3 `createTeacherEngine` (one shared instance, created at app start).
- Produces: `<Board board: Board; region?: Region; lastMove?: Pt; markers?: Array<{ pt: Pt; kind: 'better' | 'mistake' | 'hint' }>; onPlay?: (p: Pt) => void; disabled?: boolean />`; routes `#/`, `#/spar?family=&pattern=&side=&mode=`, `#/report`, `#/library`, `#/pattern/:id`, `#/settings`.
- UI decisions: board is SVG, shows the region with 1 line of margin (full board toggle); stones sized for ≥ 44px touch targets on a 375px-wide phone; tap = play on desktop, tap-then-confirm on touch (a ghost stone, second tap on it plays). Verdict panel under the board: `good` = one line, play continues; `mistake` = better move marked on board, points lost, note, buttons **Retry** / **Play on**; `other-joseki` = note + **Retry this drill** / **Switch to that pattern**; `unjudged` = "The teacher's engine isn't ready, so this move wasn't checked." A note with `confidence: 'low'` shows a small line under it: "Not 100% sure about this one. Check with a stronger player." A **Play elsewhere** button sends `'tenuki'`. Engine status chip shows loading progress. Use the `frontend-design` skill for look and feel: calm, wood-free flat board, clear in light and dark.
- [ ] **Step 1: Write failing tests:** Board renders 361 intersections hit areas within region view; clicking an intersection on desktop calls `onPlay` with the right `Pt`; with `disabled` it doesn't; region view under sym 2 shows the lower-left corner.
- [ ] **Step 2:** FAIL → implement Board → PASS.
- [ ] **Step 3:** Implement Spar + Report wired to the controller; on `done`, `recordSession` + `saveProgress`, navigate to Report (moves right/wrong, points lost, patterns now due).
- [ ] **Step 4:** `npm run dev`, play one fixture drill in the browser at 375px and 1280px; screenshot both into `docs/screens/`.
- [ ] **Step 5:** Commit `feat: board, sparring and report screens`.

### Task 8: Today, Library, Pattern, Settings, PWA, deploy

**Files:**
- Create: `src/ui/screens/{Today,Library,Pattern,Settings}.tsx`, PWA config in `vite.config.ts`, `public/manifest.webmanifest` icons, `.github/workflows/ci.yml`, `.github/workflows/deploy.yml`
- Test: `tests/ui/today.test.tsx`

**Interfaces:**
- Consumes: Task 6 `dueKeys`, `isMastered`, `Progress`; Task 2 `Book` (patterns sorted by `order`).
- Produces: Today = due reviews (play each), next new patterns (`newPerDay`, by `order`, defend side first for star44/invade33), "Teacher's choice" free sparring, streak, mastered count `n / (patterns × 2)`. Library = families → patterns, each with side badges and box; Pattern page = step through the main line with notes (prev/next) + Drill buttons per side. Settings = thresholds, visits, Export/Import progress (file download / file picker), engine info, reset progress (confirm in-page, no `window.confirm`). PWA: `vite-plugin-pwa` (autoUpdate), precache app shell, runtime CacheFirst for `models/*`; iOS Safari (not standalone) shows a dismissible "Add to Home Screen so your progress isn't wiped" card on Today.
- [ ] **Step 1: Write failing test:** Today with a progress fixture lists the due keys first, then exactly `newPerDay` unseen patterns in `order`; mastered count correct.
- [ ] **Step 2:** FAIL → implement → PASS.
- [ ] **Step 3:** CI workflow: `npm ci && npm run lint && npm test && npm run build`. Deploy workflow: build (runs `fetch-model`) → `actions/deploy-pages`. Don't push yet.
- [ ] **Step 4:** `npm run build && npx vite preview`; check Lighthouse PWA installable and offline reload after first visit.
- [ ] **Step 5:** Commit `feat: today, library, settings, PWA and deploy workflow`.

### Task 9: Book content — Phase 1 (20 patterns)

**Files:**
- Modify: `src/book/data/{star44,invade33,komoku34,sansan33}.ts`, `src/book/verify/*.json`

**Interfaces:**
- Consumes: Task 2 types; Task 4 tool.
- Content (names fixed, exact AI-era lines chosen by the author; every move gets a note; add 1–2 `mistake` branches with punishment where kyu players commonly go wrong, and `trick` nodes where a common trick exists):
  - star44 (setup `handicap4`), order 1–8: low approach → knight's-move answer → 3-3 slide → block → extend; low approach → attach-and-extend (modern main line); low approach → one-space jump answer; low approach → one-space low pincer; high approach → attach underneath; high approach → knight's-move answer; double approach after tenuki → attach on the stronger side; low approach → tenuki is fine (Black plays elsewhere, then what White does next).
  - invade33 (setup `handicap4`), order 9–14: 3-3 invasion → block on the wide side → modern hane-hane line (White keeps sente); same with block on the other side (direction from setup); Black double-hane line; invasion when Black already answered an approach with a knight's move; common kyu mistake: Black blocks from the wrong side (as a `mistake` branch with note); White's hane-cut trick and the calm answer.
  - komoku34 (setup `even`), order 15–18: small-knight approach → attach-and-draw-back; small-knight approach → one-space low pincer → 3-3 attach; one-space high approach → attach underneath → standard; small-knight approach → Black tenuki (what White does).
  - sansan33 (setup `even`), order 19–20: shoulder hit on 3-3 → standard; approach on the 4th line → Black's answer.
- [ ] **Step 1:** Author star44 + invade33; `npx vitest run tests/book` (validator) PASS.
- [ ] **Step 2:** `npx tsx tools/check-book.ts`; fix every flagged node (wrong coordinate, outdated line, `mistake` that isn't one); re-run until clean; mark notes you aren't sure of `confidence: 'low'`.
- [ ] **Step 3:** Author komoku34 + sansan33, same two steps.
- [ ] **Step 4:** Load the `humanizer` skill and reread every note against the copy rules.
- [ ] **Step 5:** `npm test` all green (incl. verify file freshness). Commit `content: phase 1 joseki book (20 patterns)`.

### Task 10: End-to-end check

**Files:**
- Create: `e2e/drill.spec.ts`, `playwright.config.ts`

- [ ] **Step 1: Write e2e test** (Chromium + WebKit, phone viewport 390×844, built app via `vite preview`): open Today → start the first new pattern (defend) → play the book moves (read from the book module) → Report shows clean → reload → that pattern no longer listed as new and is due later; second run: play the fixture's known `mistake` → Retry appears → Retry → finish; Settings → Export downloads JSON → Import of a bad file shows the error text.
- [ ] **Step 2:** Run `npx playwright test` → PASS on both browsers.
- [ ] **Step 3:** Measure the teacher's off-book answer time in throttled Chromium and WebKit; append to `docs/engine-choice.md`.
- [ ] **Step 4:** Commit `test: end-to-end drill flow`. **Phase 1 done — report to the owner, ask before `git push` / enabling Pages.**

### Tasks 11–14: Book content — Phase 2 (grow to ~100)

Each task follows Task 9's steps (author → validator → native check → fix → humanizer pass → commit) for one family, continuing `order` numbers, most common lines first:

- **Task 11:** star44 to 30 patterns (pincer families, large knight's answer, approach from the other side, common handicap-game invasions/reductions near star points).
- **Task 12:** invade33 to 15 patterns (all main AI-era variations, timing: when Black should block which way given the setup, the old-style line marked as `alternative` with a note on why it's out of fashion).
- **Task 13:** komoku34 to 45 patterns (small-knight, one-space high, two-space high/low approaches; common pincers; 4-3 orientation comes from symmetry, no separate entries).
- **Task 14:** sansan33 to 10 patterns.

Tasks 11–14 touch different files and can run in parallel. Each ends with `npm test` green and a commit `content: <family> to N patterns`.
