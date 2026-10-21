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
