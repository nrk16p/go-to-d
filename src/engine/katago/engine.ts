// Vendored from Sir-Teo/web-katrain (MIT), see LICENSES/web-katrain.txt
//
// The engine core: backend choice (WebGPU -> WASM -> CPU), model loading, and one MCTS
// analysis per call. Adapted from upstream's src/engine/katago/worker.ts: the code is the
// same, but it is exported as plain functions instead of being wired to `self.onmessage`,
// so go-to-d can run it inside its own worker (src/engine/teacher.worker.ts) or in-process
// (node tests, src/engine/teacher.ts createInProcessEngine). Dropped from upstream: the eval
// and eval-batch requests, the human SL net, tree reuse, progress reports and cancelation.
//
// TF.js keeps one backend per JS realm, so this module keeps one loaded model per realm too.

import * as tf from '@tensorflow/tfjs-core';
import '@tensorflow/tfjs-backend-cpu';
import '@tensorflow/tfjs-backend-webgpu';
import '@tensorflow/tfjs-backend-wasm';
import { setThreadsCount, setWasmPaths } from '@tensorflow/tfjs-backend-wasm';
import pako from 'pako';

import type { KataGoAnalysisPayload, KataGoAnalyzeRequest } from './types';
import { looksLikeMarkup, modelResponseError } from './modelResponse';
import type { GameRules, KataGoBackendPreference, Player } from './shared/types';
import { isGameRules } from './shared/utils/goRules';
import { publicUrl } from './shared/utils/publicUrl';
import { parseKataGoModelV8 } from './loadModelV8';
import { KataGoModelV8Tf } from './modelV8';
import { ENGINE_MAX_TIME_MS, ENGINE_MAX_VISITS } from './limits';
import { MctsSearch, rootSymmetrySamplesForBackend, type OwnershipMode } from './analyzeMcts';
import {
  getKataGoWarmupFallbackBackend,
  normalizeKataGoBackendPreference,
  shouldCacheKataGoFallbackForRequest,
} from './backendFallback';
import { BOARD_AREA, BOARD_SIZE, setBoardSize } from './fastBoard';
import { detectSearchThreadCount } from './shared/utils/workerThreads';

/** A model URL to fetch, or the model file's bytes (gzipped or not). */
export type ModelSource = string | Uint8Array;

let model: KataGoModelV8Tf | null = null;
let loadedModelName: string | undefined;
let loadedModelSource: ModelSource | null = null;
let backendPromise: Promise<void> | null = null;
let backendPreference: KataGoBackendPreference | null = null;
let prodModeEnabled = false;
let scratchBoardSize = BOARD_SIZE;
/** Where the tfjs .wasm files are served from; see scripts/copy-tfjs-wasm.mjs. */
let wasmPathPrefix: string | null = null;
type ParsedKataGoModelV8 = ReturnType<typeof parseKataGoModelV8>;

function ensureBoardSizeForWorker(boardSize: number): void {
  if (boardSize === scratchBoardSize) return;
  setBoardSize(boardSize);
  scratchBoardSize = BOARD_SIZE;
}

/**
 * Why the engine is not on the backend it was asked for. A fallback used to
 * be silent: a browser whose WASM threads or WebGPU adapter failed to start
 * showed a small "CPU" chip and analysis that was ten times slower, with no
 * record anywhere of what had gone wrong.
 */
let backendNote: string | null = null;

function describeError(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}

/** Overrides where the WASM backend loads its .wasm files from (default: `<base>/tfjs/`). */
export function setKataGoWasmPath(prefix: string): void {
  wasmPathPrefix = prefix;
}

async function initWasmBackend(): Promise<void> {
  try {
    // Vite serves `public/` at the site root.
    setWasmPaths(wasmPathPrefix ?? publicUrl('tfjs/'));
    // Use a reasonable thread count for XNNPACK when cross-origin isolated (SharedArrayBuffer).
    // Without COOP/COEP headers, browsers disable threads and TFJS will fall back to single-threaded wasm.
    const isCrossOriginIsolated = (globalThis as unknown as { crossOriginIsolated?: boolean }).crossOriginIsolated === true;
    if (isCrossOriginIsolated) {
      // Cores minus headroom for the UI, held down further on a machine short
      // of memory. See utils/workerThreads for why memory is only trusted
      // below 4GB.
      setThreadsCount(detectSearchThreadCount());
    }
    // setBackend resolves false, without throwing, when the backend fails to
    // initialise; the old bare await treated that as success.
    if (!(await tf.setBackend('wasm'))) throw new Error('tf.setBackend(\'wasm\') returned false');
    await tf.ready();
    return;
  } catch (err) {
    backendNote = [backendNote, `WASM backend failed (${describeError(err)}); using the CPU backend`]
      .filter(Boolean)
      .join('. ');
  }

  await tf.setBackend('cpu');
  await tf.ready();
}

async function initBackend(preferredBackend: KataGoBackendPreference): Promise<void> {
  if (preferredBackend === 'cpu') {
    await tf.setBackend('cpu');
    await tf.ready();
    return;
  }

  if (preferredBackend === 'webgpu') {
    try {
      if (!(await tf.setBackend('webgpu'))) throw new Error('tf.setBackend(\'webgpu\') returned false');
      await tf.ready();
      return;
    } catch (err) {
      // Fall back to WASM/CPU if WebGPU isn't available or fails to initialize.
      backendNote = `WebGPU backend failed (${describeError(err)}); trying WASM`;
    }
  }

  await initWasmBackend();
}

function maybeUngzip(data: Uint8Array): Uint8Array {
  // gzip magic bytes 0x1f8b
  if (data.length >= 2 && data[0] === 0x1f && data[1] === 0x8b) return pako.ungzip(data);
  return data;
}

async function ensureBackend(backend?: KataGoBackendPreference): Promise<void> {
  const preferredBackend = normalizeKataGoBackendPreference(backend);
  if (backendPromise && backendPreference === preferredBackend) {
    await backendPromise;
    return;
  }

  model?.dispose();
  model = null;
  loadedModelName = undefined;
  loadedModelSource = null;

  backendPreference = preferredBackend;
  backendPromise = initBackend(preferredBackend)
      .then(() => {
        if (!prodModeEnabled) {
          tf.enableProdMode();
          prodModeEnabled = true;
        }
      })
      .catch((err) => {
        backendPromise = null;
        backendPreference = null;
        throw err;
      });
  await backendPromise;
}

async function warmupModel(candidate: KataGoModelV8Tf): Promise<void> {
  const spatial = tf.zeros([1, 19, 19, 22], 'float32') as tf.Tensor4D;
  const global = tf.zeros([1, 19], 'float32') as tf.Tensor2D;
  let out: ReturnType<KataGoModelV8Tf['forwardValueOnly']> | null = null;
  try {
    out = candidate.forwardValueOnly(spatial, global);
    const results = await Promise.allSettled([out.value.data(), out.scoreValue.data()]);
    for (const result of results) {
      if (result.status === 'rejected') throw result.reason;
    }
  } finally {
    spatial.dispose();
    global.dispose();
    out?.value.dispose();
    out?.scoreValue.dispose();
  }
}

async function createWarmedModel(parsed: ParsedKataGoModelV8): Promise<KataGoModelV8Tf> {
  const candidate = new KataGoModelV8Tf(parsed);
  try {
    await warmupModel(candidate);
    return candidate;
  } catch (err) {
    candidate.dispose();
    throw err;
  }
}

function installModel(nextModel: KataGoModelV8Tf, parsed: ParsedKataGoModelV8, source: ModelSource): void {
  model?.dispose();
  model = nextModel;
  loadedModelName = parsed.modelName;
  loadedModelSource = source;
}

async function switchToFallbackBackendForRequest(
  requestedBackend: KataGoBackendPreference,
  fallbackBackend: KataGoBackendPreference
): Promise<void> {
  backendPromise = null;
  backendPreference = null;
  await ensureBackend(fallbackBackend);
  if (shouldCacheKataGoFallbackForRequest({ requestedBackend, fallbackBackend: tf.getBackend() })) {
    backendPreference = requestedBackend;
  }
}

async function readModelBytes(source: ModelSource): Promise<Uint8Array> {
  if (typeof source !== 'string') return source;
  const res = await fetch(source);
  if (!res.ok) throw new Error(`Failed to fetch model: ${res.status} ${res.statusText}`);
  const buf = new Uint8Array(await res.arrayBuffer());
  if (looksLikeMarkup(buf)) throw modelResponseError(source);
  return buf;
}

async function ensureModel(source: ModelSource, backend?: KataGoBackendPreference): Promise<void> {
  const requestedBackend = normalizeKataGoBackendPreference(backend);
  if (!backendPromise || backendPreference !== requestedBackend) backendNote = null;
  await ensureBackend(requestedBackend);
  if (model && loadedModelSource === source) return;

  const data = maybeUngzip(await readModelBytes(source));

  const parsed = parseKataGoModelV8(data);
  const attemptedFallbacks = new Set<KataGoBackendPreference>();
  while (true) {
    try {
      installModel(await createWarmedModel(parsed), parsed, source);
      return;
    } catch (err) {
      const fallbackBackend = getKataGoWarmupFallbackBackend({
        requestedBackend,
        activeBackend: tf.getBackend(),
        stage: 'warmup',
      });
      if (!fallbackBackend || attemptedFallbacks.has(fallbackBackend)) {
        throw err;
      }

      attemptedFallbacks.add(fallbackBackend);
      backendNote = [
        backendNote,
        `Model warm-up failed on ${tf.getBackend()} (${describeError(err)}); switching to ${fallbackBackend}`,
      ]
        .filter(Boolean)
        .join('. ');
      await switchToFallbackBackendForRequest(requestedBackend, fallbackBackend);
    }
  }
}

export interface KataGoEngineInfo {
  backend: string;
  modelName: string;
  /** Why the engine is not on the backend it was asked for, if it is not. */
  backendNote: string | null;
}

/** Loads (and warms up) the model on the best backend available, or does nothing if it is already loaded. */
export async function loadKataGoModel(source: ModelSource, backend?: KataGoBackendPreference): Promise<KataGoEngineInfo> {
  await ensureModel(source, backend);
  return { backend: tf.getBackend(), modelName: loadedModelName ?? 'unknown', backendNote };
}

/** One MCTS analysis of a position with the loaded model. Call loadKataGoModel first. */
export async function analyzeKataGo(msg: KataGoAnalyzeRequest): Promise<KataGoAnalysisPayload> {
  if (!model) throw new Error('Model not loaded');

  ensureBoardSizeForWorker(msg.board.length);

  const maxVisits = Math.max(16, Math.min(msg.visits ?? 256, ENGINE_MAX_VISITS));
  const maxTimeMs = Math.max(25, Math.min(msg.maxTimeMs ?? 800, ENGINE_MAX_TIME_MS));
  // `??` catches a missing batch size but not a broken one; NaN is a number.
  const requestedBatchSize = Number.isFinite(msg.batchSize) ? msg.batchSize! : (tf.getBackend() === 'webgpu' ? 16 : 4);
  const batchSize = Math.max(1, Math.min(requestedBatchSize, 64));
  const maxChildren = Math.max(4, Math.min(msg.maxChildren ?? 64, BOARD_AREA));
  const topK = Math.max(1, Math.min(msg.topK ?? 10, 50));
  const ownershipMode: OwnershipMode = msg.ownershipMode ?? 'root';
  const analysisPvLen = Math.max(0, Math.min(msg.analysisPvLen ?? 15, 60));
  const wideRootNoise = Math.max(0, Math.min(msg.wideRootNoise ?? 0.04, 5));
  const rootPolicyTemperature = Math.max(0.01, Math.min(msg.rootPolicyTemperature ?? 1, 100));
  const fillDameBeforePass = msg.fillDameBeforePass !== false;
  const rules: GameRules = isGameRules(msg.rules) ? msg.rules : 'japanese';
  const nnRandomize = msg.nnRandomize !== false;
  const rootSymmetrySamples = rootSymmetrySamplesForBackend(tf.getBackend());
  const conservativePass = msg.conservativePass !== false;

  // KataGo avoidMoveUntilByLoc: how deep into the search each move stays off
  // limits for each player, which is how an analysis answers "and if that move
  // were not available?". An untilDepth of 1 bans it at the root alone.
  let avoidMoveUntilBlack: Int32Array | null = null;
  let avoidMoveUntilWhite: Int32Array | null = null;
  const avoidArrayFor = (player: Player): Int32Array => {
    if (player === 'black') return (avoidMoveUntilBlack ??= new Int32Array(BOARD_AREA + 1));
    return (avoidMoveUntilWhite ??= new Int32Array(BOARD_AREA + 1));
  };
  const moveIndexOf = (move: { x: number; y: number }): number => {
    if (move.x < 0 || move.y < 0) return BOARD_AREA;
    if (move.x >= BOARD_SIZE || move.y >= BOARD_SIZE) return -1;
    return move.y * BOARD_SIZE + move.x;
  };
  for (const move of msg.avoidMoves ?? []) {
    const idx = moveIndexOf(move);
    if (idx < 0) continue;
    const untilDepth = Math.max(1, Math.min(Math.floor(move.untilDepth ?? 1), 1000));
    const player: Player = move.player ?? msg.currentPlayer;
    avoidArrayFor(player)[idx] = untilDepth;
  }
  // allowMoves is the complement: everything else is off limits for that player.
  for (const allow of msg.allowMoves ?? []) {
    const player: Player = allow.player ?? msg.currentPlayer;
    const untilDepth = Math.max(1, Math.min(Math.floor(allow.untilDepth ?? 1), 1000));
    const allowed = new Set<number>();
    for (const move of allow.moves) {
      const idx = moveIndexOf(move);
      if (idx >= 0) allowed.add(idx);
    }
    if (allowed.size === 0) continue;
    const array = avoidArrayFor(player);
    for (let p = 0; p <= BOARD_AREA; p++) {
      if (!allowed.has(p)) array[p] = untilDepth;
    }
  }

  const search = await MctsSearch.create({
    model,
    board: msg.board,
    previousBoard: msg.previousBoard,
    previousPreviousBoard: msg.previousPreviousBoard,
    currentPlayer: msg.currentPlayer,
    moveHistory: msg.moveHistory,
    repetitionHistory: msg.repetitionHistory,
    komi: msg.komi,
    rules,
    nnRandomize,
    conservativePass,
    maxChildren,
    ownershipMode,
    wideRootNoise,
    rootPolicyTemperature,
    fillDameBeforePass,
    rootSymmetrySamples,
    regionOfInterest: msg.regionOfInterest,
    avoidMoveUntilBlack,
    avoidMoveUntilWhite,
  });

  await search.run({ visits: maxVisits, maxTimeMs, batchSize, shouldAbort: () => false });
  return search.getAnalysis({ topK, analysisPvLen, cloneBuffers: false });
}
