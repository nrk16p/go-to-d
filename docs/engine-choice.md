# Engine choice

The teacher runs **g170-b6c96-s175395328-d26788732** (KataGo's 6-block test net, 3.8 MB) at **100 visits per search with a 2.0 s budget per answer**. It is the only candidate that answers in about 3 s on a slow phone CPU and still agrees with native KataGo about 80% of the time. The bigger nets are clearly stronger, but on a CPU without WebGPU they can't answer inside 3 s at any visit count.

Set in `src/engine/model.ts`: `MODEL_FILE`, `DEFAULT_VISITS = 100`, `DEFAULT_MAX_TIME_MS = 2000`. The model file is committed at `public/models/` (it is under 25 MB). Measured 2026-10-21/22 on an Apple M2 (8 cores), Playwright 1.64.1: Chromium 156 headless, WebKit (Safari 27.2 engine).

## How it was measured

`tools/engine-bench/run.ts` opens a dev-only page (`tools/engine-bench/page/`) that hosts the app's own `TeacherEngine`, loads a network, and times `analyzeCorner` on bench positions. Every number below goes through the same code the app uses: the vendored web-katrain engine, the teacher's two searches (one restricted to the corner region, one over the whole board), and the worker messages.

Strength uses 30 positions (`tools/engine-bench/positions.ts`): every position of the test family in `tests/book/fixture.ts`, nine common first moves against the 4-4 stone in the 4-stone handicap setup, and two even-game positions. `tools/engine-bench/reference.ts` asked native KataGo 1.18.2 with `kata1-b18c384nbt-s9996604416-d4316597426` (1600 visits, moves limited to the corner region) for its top moves; the result is `tools/engine-bench/reference.json`. A candidate scores a point when its `cornerBest` is in that top 3. The reference uses area scoring without the handicap bonus for White (`koSIMPLEscoreAREAtaxNONEsui0whb0`), because the browser engine doesn't add one.

Two things about the browsers matter for reading the tables:

- **Chromium can't throttle a worker.** DevTools CPU throttling (`Emulation.setCPUThrottlingRate`) slows the page only; asked for a worker target it answers "Operation is only supported for pages, not workers", and a throttled page left the worker's time unchanged (5.0 s vs 5.5 s). So the "Chromium 4×" rows run the same engine code on the page's main thread (`createInProcessEngine`) with 4× throttling. That is the slow-phone stand-in.
- **Headless Chromium's WebGPU is a software renderer** here (163 s for 100 visits), so Chromium rows use WASM. WebKit has real WebGPU (Metal). Neither page is cross-origin isolated, same as GitHub Pages, so WASM is single-threaded everywhere.

The GPU was shared with another session's native KataGo during some runs; the rows marked "shared GPU" are slower than they should be.

## Candidates

| Network | Download | Loads? | Elo (katagotraining.org) |
| --- | --- | --- | --- |
| g170-b6c96-s175395328-d26788732 | 3.8 MB | yes | 9965 |
| kata1-b10c128-s1141046784-d204142634 (the final g170e b10c128) | 11.1 MB | yes | 11520 |
| kata1-b15c192-s1672170752-d466197061 (the final g170e b15c192) | 37.0 MB | yes | 12222 |
| kata1-tf2-b10c384-s2941M-d5872M | 38.2 MB | no: model version 17, the vendored parser stops at 16 | 13707 |

The b10c128 and b15c192 nets are published only as `.txt.gz`; `tools/engine-bench/txt-to-bin.ts` converts them to `.bin.gz` (native KataGo gives bit-identical output for the original and the converted file). kata1-tf3-b10c512 (94 MB) and everything larger were skipped for size. Model load (parse + warm-up, from a local server, download not included) took 0.1–0.6 s for all three.

## analyzeCorner time, no time cap (median / max of 4 positions, seconds)

| Network | Browser, backend | 16 v | 32 v | 64 v | 100 v | 200 v | 400 v |
| --- | --- | --- | --- | --- | --- | --- | --- |
| b6c96 | Chromium 4×, WASM, main thread | 3.0 / 3.0 | 5.5 / 5.7 | 10.0 / 10.3 | 15.2 / 15.8 | 32.1 | – |
| b10c128 | Chromium 4×, WASM, main thread | 8.2 / 8.4 | 14.8 / 14.9 | 28.3 / 29.3 | 44.9 | – | – |
| b15c192 | Chromium 4×, WASM, main thread | 26.3 / 28.5 | 47.4 | – | – | – | – |
| b6c96 | WebKit, WebGPU, worker | 0.1 / 0.1 | 0.1 / 0.2 | 0.3 / 0.3 | 0.4 / 0.4 | 0.8 / 0.8 | 1.5 / 1.5 |
| b10c128 | WebKit, WebGPU, worker | 0.2 / 0.2 | 0.4 / 0.4 | 0.7 / 0.7 | 1.0 / 1.0 | 1.9 / 2.1 | 4.7 / 5.2 |
| b15c192 | WebKit, WebGPU, worker | 1.0 / 1.0 | 1.7 / 1.7 | 2.9 / 2.9 | 4.2 / 4.2 | 7.1 / 7.5 | 14.0 / 14.2 |
| b6c96 | WebKit, WASM, worker | 0.8 / 0.8 | 1.6 / 1.6 | 3.0 / 3.2 | 4.9 / 5.2 | 9.6 / 9.7 | 19.0 / 19.9 |
| b10c128 | WebKit, WASM, worker | 2.7 / 2.8 | 4.9 / 5.0 | 9.0 / 9.3 | 12.8 / 13.3 | 27.0 / 29.2 | 52.9 |
| b15c192 | WebKit, WASM, worker | 8.3 / 8.4 | 15.2 / 17.5 | 30.1 | – | – | – |

A dash means the run stopped after one call took over 30 s. "v" is visits per search; `analyzeCorner` runs two searches.

## Strength: cornerBest in native KataGo's top 3 (of 30)

No time cap, WebKit WebGPU:

| Network | 16 v | 32 v | 64 v | 100 v | 200 v |
| --- | --- | --- | --- | --- | --- |
| b6c96 | 25 | 25 | 25 | 24 | 23 |
| b10c128 | 27 | 24 | 25 | 25 | 26 |
| b15c192 | 29 | 27 | 27 | 29 | 28 |

More visits don't move these numbers; the spread between runs is ±2, so one position is about 3 points of percentage. Pooled over every run (the capped ones below included), b6c96 agrees 81% of the time, b10c128 85%, b15c192 93%. b6c96's misses are mostly answers to an approach where several moves are close (after W R14 it picks N17, native wants a pincer at R10–R12).

## With a time budget (100 visits, 30 positions)

A budget lets fast devices finish all 100 visits and stops slow ones in time. A search runs a little past its cap (the root evaluation and the last batch, about 0.5 s on the 4× CPU for b6c96, over 1 s for b10c128), and the teacher subtracts the first search's overrun from the second's share.

| Network | Setting | Browser, backend | Agree | analyzeCorner median / max |
| --- | --- | --- | --- | --- |
| b6c96 | 3.0 s budget (before the overrun fix) | Chromium 4×, WASM | 26 | 3.47 / 4.16 s |
| b10c128 | 3.0 s budget (before the overrun fix) | Chromium 4×, WASM | 27 | 4.32 / 6.12 s |
| b15c192 | 3.0 s budget (before the overrun fix) | Chromium 4×, WASM | 28 | 9.50 / 18.36 s |
| b6c96 | 2.5 s | Chromium 4×, WASM | 24 | 2.50 / 2.66 s |
| b10c128 | 2.5 s | Chromium 4×, WASM | 25 | 3.61 / 3.86 s |
| b10c128 | 1.5 s | Chromium 4×, WASM | 26 | 4.00 / 6.26 s |
| **b6c96** | **2.0 s (chosen)** | **Chromium 4×, WASM** | **24** | **2.14 / 2.29 s** |
| b6c96 | 2.5 s | WebKit, WebGPU (shared GPU) | 25 | 1.34 / 1.87 s |
| b6c96 | 2.5 s | WebKit, WASM | 23 | 2.50 / 2.55 s |

b10c128 can't get under 3 s on the 4× CPU whatever the budget: each search pays a fixed cost (root evaluation over 4 symmetries plus one batch) before the cap can stop it, and two of those already take about 3 s.

The teacher's reply to an off-book move is `scoreFor` (for the verdict) and then `analyzeCorner` on the same position. They share the whole-board search, and each search gets half the budget, so the pair is one answer. With the chosen defaults, over 8 positions:

| Browser, backend | Reply median / max |
| --- | --- |
| Chromium 4×, WASM, main thread | 3.03 / 3.16 s |
| WebKit, WASM, worker | 2.28 / 2.31 s |
| WebKit, WebGPU, worker (shared GPU) | 1.20 / 1.41 s |

The 2.5 s budget gave 3.62 s for the same reply on the 4× CPU, which is why the budget is 2.0 s.

## The choice

The rule from the plan: the strongest network that is at most 40 MB, answers in 3 s or less in throttled Chromium and in WebKit at the chosen visits, and agrees with native KataGo at least 80% of the time.

- b6c96 at 100 visits and a 2.0 s budget passes: 3.8 MB; 2.1 s per `analyzeCorner` and 3.0 s per reply on the 4× CPU, 0.4 s on WebGPU; 24/30 under the budget, 81% pooled. It passes at the edge: 80% is 24 of 30.
- b10c128 is stronger (85%) and 11 MB, but on the 4× CPU no budget gets it under 3.6 s.
- b15c192 is the strongest (93%) but needs 1.0 s for 16 visits even on desktop WebGPU and 26 s on the 4× CPU.
- kata1-tf2-b10c384 doesn't load in the vendored engine.

What this means in practice: on a phone with WebGPU (Safari on iOS 26, recent Chrome on Android) the teacher gets its full 100 visits in well under a second. On a phone that falls back to single-threaded WASM it stops at the budget after roughly 10–20 visits, which is about the raw network's judgement.

## Levers for later

- Pick the network by backend: b10c128 (or b15c192 at low visits) when WebGPU starts, b6c96 otherwise. That means testing WebGPU before choosing what to download.
- Multi-threaded WASM needs cross-origin isolation, which GitHub Pages can't set as headers; a service worker that adds COOP/COEP (the coi-serviceworker approach) would allow it.
- A newer parser would open the model-version-17 kata1 nets, which are much stronger per megabyte.

## Rerunning

```sh
node scripts/fetch-model.mjs --all --dir tools/engine-bench/models   # the candidates (gitignored)
npx tsx tools/engine-bench/reference.ts --visits 1600                # native reference (needs KataGo, tools/README.md)
npx tsx tools/engine-bench/run.ts --browsers webkit --strength-only --strength 16,32,64,100,200
npx tsx tools/engine-bench/run.ts --browsers chromium --backend wasm --throttle 4 --visits 16,32,64,100,200,400
npx tsx tools/engine-bench/run.ts --browsers webkit --backend webgpu --visits 16,32,64,100,200,400
npx tsx tools/engine-bench/run.ts --browsers chromium --backend wasm --throttle 4 --strength-only \
  --strength-throttled --strength 100 --max-time 2000 --models g170-b6c96-s175395328-d26788732.bin.gz
npx tsx tools/engine-bench/run.ts --browsers chromium,webkit --backend wasm --answer \
  --positions 0,1,2,3,4,19,20,25 --models g170-b6c96-s175395328-d26788732.bin.gz
```

The options are listed at the top of `run.ts`. Each run can write its raw numbers with `--out`; the runs behind this page are in `tools/engine-bench/results.json`. Stop other GPU work (a native KataGo, for one) before timing WebGPU.

## In the app (2026-10-23)

`e2e/answer-time.spec.ts` times the teacher in the real app: the production build served by `vite preview` at `/go-to-d/`, on the same M2 with Playwright 1.64.1. One page load and one engine serve all the trials, the way a session goes. A first trial warms the engine up and isn't counted.

Each trial is the knight's-move drill. The teacher plays R14, then Black plays one of five moves the book doesn't have: N17, P17, R10, Q12 or P15. Each trial turns the board by the next of the 8 symmetries, so every trial gives the engine a position it hasn't searched. Otherwise the engine's cache of recent whole-board searches answers a repeat at once. Between trials the page sits on Today for 4 s, so no search from the last trial is still queued.

Times are taken in the page, from the click that plays the move. **Verdict** runs until the verdict shows. **Reply** runs until the teacher's stone is down and it's Black's move again. A mistake stops the session, so there the reply is timed from the Play on click. "At once" plays as soon as it's Black's move. "After 3 s" waits first, as a person looking at the board would, so the look-ahead the app starts on each owner turn has finished.

| Browser, backend | Black plays | Verdict, median (range) | Reply, median (range) | Reply after Play on |
| --- | --- | --- | --- | --- |
| Chromium phone, page 4× throttled, WASM in a worker | at once | 2.37 s (2.31–2.39) | 3.50 s (3.47–3.52) | 1.15–1.19 s (2 mistakes) |
| Chromium phone, page 4× throttled, WASM in a worker | after 3 s | 1.13 s (1.08–1.17) | 2.29 s (2.21–2.33) | 1.12 s (1 mistake) |
| WebKit phone, WebGPU, shared GPU | at once | 1.58 s (1.46–1.61) | 2.38 s (2.23–2.42) | – |
| WebKit phone, WebGPU, shared GPU | after 3 s | 0.80 s (0.77–0.89) | 1.57 s (1.54–1.80) | – |

How to read it:

- **The Chromium rows aren't the slow-phone number.** DevTools throttles the page, not the engine's worker (see the top of this page), so the searches ran at full speed. They show what the app itself adds. After a pause the reply takes 2.29 s, close to the bench's full-speed WASM reply (2.28 s, WebKit worker), so the 4× slower page adds little. On a phone whose CPU is 4× slower, the engine part is the bench's 3.0 s.
- **Playing at once costs about 1.2 s more in Chromium, 0.8 s in WebKit.** The verdict needs the search of the position before the move. That search is the look-ahead, still running when the move comes in. The engine runs one search at a time, so scoring the new position waits behind it. At full speed that comes to 3.5 s, over the 3 s target. On a 4× slower worker the bench's numbers put it near 4.5 s (the rest of the look-ahead, then the 3.0 s pair). That's under the 5 s limit, but it wasn't measured. If it matters, the lever is the look-ahead: a shorter budget for it, or cutting it short when the owner moves.
- **WebKit had to share the GPU.** Two native KataGo book checks from other worktrees were running, like the "shared GPU" rows above. Expect it faster on an idle GPU.
- Answers to a mistake after Play on are quick (about 1.1 s at full speed): the scoring for the verdict already did the whole-board search, so only the corner search is left.

Rerun with `npm run e2e:answer-time` (it builds first). Stop other GPU and CPU work before timing.

## Judging from one search (R40, after the final review)

Until now an off-book verdict subtracted two searches: the best corner move's value from the search of the position before the move, minus a fresh whole-board search of the position after it. On a slow phone both searches stop at the budget after a few visits, and they don't agree closely enough to subtract. In the handicap setups the search after the move came out lower, so the owner's own best move could show as a mistake, sometimes a 5-point one.

Now, when the move is one the search before it looked at (one of `analyzeCorner`'s candidates), the loss is the difference inside that one search: best candidate minus this candidate, 0 when it is the best. A tenuki on the engine's own point elsewhere is read from the same analysis. Only a move the search didn't look at still gets the search of the position after it (`scoreFor`). The played move is never named as the better one.

What it does to the times above (not re-measured on a device):

- **Verdict.** Most moves are candidates, so the verdict needs only the look-ahead the app starts on each owner turn. "At once" no longer waits for a second search queued behind it, which was the 3.5 s at full speed in the table above. The verdict now comes as soon as the look-ahead ends.
- **Reply.** Unchanged in total. The teacher's `analyzeCorner` on the new position now runs both of its searches itself, where before it reused the whole-board search the verdict had just done. It is the same pair of searches inside the same 2 s budget.
- **Reply after Play on.** A mistake judged from one search leaves no whole-board search to reuse, so the reply after Play on takes a full `analyzeCorner`, about the reply time above instead of the 1.1 s measured here.
