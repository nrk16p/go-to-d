# Book check tools

`check-book.ts` asks a native KataGo whether the joseki book teaches anything wrong. You write patterns, run it, and fix what it flags. `katago.ts` is the small engine client it uses; the in-browser engine benchmark reuses it to get reference analyses.

## Install KataGo and the network

macOS with Homebrew:

```sh
brew install katago
mkdir -p ~/.katago
curl -L -o ~/.katago/kata1-b18c384nbt-s9996604416-d4316597426.bin.gz \
  https://media.katagotraining.org/uploaded/networks/models/kata1/kata1-b18c384nbt-s9996604416-d4316597426.bin.gz
```

The Homebrew package may already ship this network under `$(brew --prefix katago)/share/katago/`; the tool looks there too. Any other build of KataGo works if `katago analysis` runs with the config in `tools/katago/`.

Where the tool looks, in order:

| What | Environment variable | Default |
| --- | --- | --- |
| KataGo program | `KATAGO_BIN` | `katago` on the PATH |
| Network | `KATAGO_MODEL` | `~/.katago/kata1-b18c384nbt-s9996604416-d4316597426.bin.gz`, then the Homebrew and `/usr/local` share folders |
| Config | `KATAGO_CONFIG` | `tools/katago/analysis.cfg` |

The network's name is written into every result file. If you change it, rerun every family.

## Run it

```sh
npx tsx tools/check-book.ts --family star44      # one family, the normal case
npx tsx tools/check-book.ts                      # every family that has patterns
npx tsx tools/check-book.ts --family star44 --visits 800   # slower, steadier
npx tsx tools/check-book.ts --fixture            # the test family in tests/book/fixture.ts
npm run check-book -- --family star44            # same thing through npm
```

It validates the family first and stops if the book is broken. Then it asks KataGo about every move in the family (400 visits each by default). On an M2 (Metal) that is about 3 seconds per position, and positions shared by several moves are asked once. The 18-node fixture family takes 80 seconds; a family of 80 nodes takes around 6 minutes.

It writes `src/book/verify/<family>.json` and prints a table of what it flagged: family, pattern ids, node key, kind, loss, the engine's move, and the node's note on the line below. The exit code is 1 when something is flagged, so you can chain it. `--fixture` writes `tests/book/fixture-verify.json` instead and always exits 0, because the fixture's moves are legal but not meant as real joseki.

Commit the JSON file with the family. `npm test` fails when the file is missing, out of date, or has flagged nodes.

## What the numbers are

**Loss** is how many points the move gives up compared with the engine's best move in the corner, from the point of view of the player who makes the move. At each node the engine looks at the position before the move, restricted to the corner region (`allowMoves`), and the loss is its best score minus the score of the move in the book. Rules are Chinese, with the komi of the setup.

If the engine barely looked at the book move (less than 10% of the visits), the position after the move is analysed as well and that score is used.

**Tenuki nodes** compare the best move in the corner with the best move anywhere else. The loss is how much better the corner is. For the moves that come after a tenuki, the engine's best outside move is played in its place, so later positions are real ones. These are the replacements, they are printed in the log only.

**Flags**

| Kind | Flagged when | What to do |
| --- | --- | --- |
| `joseki`, `alternative` | loss is more than 2.0 | The move costs too much. Change it, or make it a `mistake` if you want the teacher to punish it. |
| `mistake` | loss is less than 1.5 | The engine does not think the move is bad. Pick a worse move for the lesson, or make it an `alternative`. |
| `trick` | never | Not judged. |

Moves after a mistake (the punishment line) are `joseki` nodes and are judged against the position after the mistake, so a punishment that does not punish gets flagged too.

`bestAt` in the JSON is the engine's first choice in the corner at the parent position, in the canonical frame (corner upper right, GTP points).

## The result file

```json
{
  "familyHash": "1a2b3c4d5e6f70",
  "model": "kata1-b18c384nbt-s9996604416-d4316597426",
  "visits": 400,
  "nodes": { "star44:W:R14/B:Q14": { "loss": 0.31, "bestAt": "Q13", "kind": "joseki" } }
}
```

`familyHash` covers the family's moves, node kinds, setups and corner stones. It does not cover note text, weights, confidence, names or pattern order, so copy-editing a note does not mean a new run. Any change to a move, a kind or a setup does.

KataGo searches with several threads, so two runs differ a little. Two runs over the fixture family differed by 0.12 points on average and 0.41 at most. A node that sits right on a threshold can flip between runs; if one does, rerun the family with `--visits 800` before changing the move.

## Using the engine client elsewhere

```ts
import { KataGoEngine } from './katago.ts'

const engine = await KataGoEngine.start()
const [a] = await engine.analyseAll([
  { initialStones: [['B', 'Q16']], initialPlayer: 'W', moves: [], komi: 0.5, allowMoves: ['R14', 'Q14'] },
])
await engine.close()
// a.moves[0] is the engine's first choice; scoreLead and winrate are for the player to move.
```

Import it with the `.ts` extension: `tools/katago/` is also a folder (the config lives there), and an extensionless `katago` import can resolve to the folder under some loaders.

All scores come back from the point of view of the player to move, whatever `reportAnalysisWinratesAs` says in the config (the client reads it and converts). `analysePositions(requests)` does the same with a throwaway engine, and `withEngine(fn)` makes sure the process is stopped.

The pure parts (query building, perspective conversion, loss, flags, freshness) live in `katago-protocol.ts` and `book-check.ts` and are unit tested without an engine.

KataGo is MIT licensed, see `LICENSES/KataGo.txt`. `tools/katago/analysis.cfg` is adapted from its `analysis_example.cfg`.

## Engine benchmark

`tools/engine-bench/` picked the network the in-browser teacher runs: `reference.ts` gets native KataGo's top moves on 30 positions (with `katago.ts`), and `run.ts` drives the app's own engine in Chromium and WebKit through Playwright. The results, the choice and the commands to rerun it are in `docs/engine-choice.md`. `txt-to-bin.ts` converts KataGo's older text-format networks to the binary format the browser engine reads.
