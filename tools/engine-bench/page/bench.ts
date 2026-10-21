// The engine benchmark page: hosts the real worker-backed TeacherEngine and exposes a few calls
// on `window.bench` for tools/engine-bench/run.ts (Playwright) to drive. Served by the Vite dev
// server only.

import { createInProcessEngine, createTeacherEngine, type Backend, type TeacherEngine } from '../../../src/engine/teacher'
import { toGtp } from '../../../src/go/coords'
import { benchPositions } from '../positions'

const positions = benchPositions()
let engine: TeacherEngine | null = null
const log = document.getElementById('log')!

function need(): TeacherEngine {
  if (!engine) throw new Error('call bench.load first')
  return engine
}

const bench = {
  ids: positions.map((p) => p.id),

  env() {
    return {
      userAgent: navigator.userAgent,
      webgpu: 'gpu' in navigator,
      crossOriginIsolated: globalThis.crossOriginIsolated === true,
      cores: navigator.hardwareConcurrency,
    }
  },

  /**
   * Starts the engine with the model; resolves when it is warmed up. `main` runs the same engine
   * code on this page's main thread instead of in the worker: Chromium's CPU throttling only slows
   * pages, not workers, so that is how the throttled run stands in for a slower phone CPU.
   */
  async load(modelUrl: string, backend?: Backend, where: 'worker' | 'main' = 'worker') {
    const t0 = performance.now()
    engine = where === 'main' ? createInProcessEngine(modelUrl, { backend }) : createTeacherEngine(modelUrl, { backend })
    const info = await engine.ready()
    const loadMs = performance.now() - t0
    log.textContent = `${info.model} on ${info.backend}, loaded in ${Math.round(loadMs)} ms`
    return { ...info, loadMs }
  },

  /** One analyzeCorner on position `index`, timed from the main thread (worker messages included). */
  async corner(index: number, visits: number, maxTimeMs = 600_000) {
    const p = positions[index]
    const t0 = performance.now()
    const a = await need().analyzeCorner(p.pos, p.komi, p.region, { visits, maxTimeMs })
    const ms = performance.now() - t0
    log.textContent = `${p.id}: ${toGtp(a.cornerBest.pt)} in ${Math.round(ms)} ms`
    return {
      ms,
      best: toGtp(a.cornerBest.pt),
      bestScore: a.cornerBest.scoreLead,
      tenuki: a.tenukiBest ? toGtp(a.tenukiBest.pt) : null,
      candidates: a.candidates.slice(0, 5).map((c) => toGtp(c.pt)),
    }
  },
}

/**
 * The teacher's reply after an off-book owner move, with the app's defaults: scoreFor (the owner's
 * score, for the verdict) and then analyzeCorner (the reply), on the same position.
 */
async function answer(index: number) {
  const p = positions[index]
  const owner = p.pos.toMove === 'black' ? 'white' : 'black'
  const t0 = performance.now()
  await need().scoreFor(p.pos, p.komi, owner)
  const a = await need().analyzeCorner(p.pos, p.komi, p.region)
  return { ms: performance.now() - t0, best: toGtp(a.cornerBest.pt) }
}

declare global {
  interface Window {
    bench: typeof bench & { answer: typeof answer }
  }
}

window.bench = { ...bench, answer }
document.body.dataset.ready = '1'
log.textContent = `Ready: ${positions.length} positions`
