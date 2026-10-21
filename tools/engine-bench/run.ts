// Engine benchmark: candidate KataGo networks in real browsers, through the app's own worker-backed
// TeacherEngine (tools/engine-bench/page/). Chromium runs with DevTools CPU throttling (a phone
// stand-in), WebKit as is. See docs/engine-choice.md for the results and how the model was picked.
//
//   npx tsx tools/engine-bench/run.ts --models g170-b6c96-s175395328-d26788732.bin.gz \
//     --browsers chromium,webkit --visits 100,200,400 --strength 100 --out tools/engine-bench/results.json
//
// Models are read from tools/engine-bench/models/ (gitignored; see docs/engine-choice.md for the
// downloads). Options:
//   --models a,b         model files in tools/engine-bench/models/ (default: all of them)
//   --browsers           chromium,webkit (default both)
//   --backend            webgpu | wasm | cpu: the engine's preferred backend (default webgpu, the app's)
//   --throttle N         Chromium CPU slowdown (default 4; 1 = off). Chromium cannot throttle a
//                        worker, so a throttled Chromium run hosts the engine on the page's main
//                        thread (the same code, createInProcessEngine); everything else uses the worker.
//   --visits a,b,c       visits for the timing runs (default 100,200,400)
//   --positions i,j      bench position indexes timed at each visits level (default 0,2,19,25)
//   --skip-above MS      stop timing higher visits once one call takes longer (default 30000)
//   --strength a,b       also play all 30 positions at each of these visits and score them against
//                        reference.json (how often the corner move is in native KataGo's top 3)
//   --strength-only      skip the timing runs
//   --strength-throttled keep Chromium's throttling on for the strength runs (with --max-time, this
//                        scores what a slow device actually gets when the time cap cuts the search)
//   --max-time MS        analyzeCorner's time budget (default 600000, i.e. no cap: visits decide)
//   --answer             time the reply after an off-book move with the app's defaults (scoreFor,
//                        then analyzeCorner, same position) on --positions; replaces the timing runs
//   --out FILE           write the raw results as JSON

import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium, webkit, type Browser, type Page } from 'playwright'
import { createServer } from 'vite'
import { benchPositions } from './positions'
import type { ReferenceFile } from './reference'

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..', '..')
const modelsDir = join(here, 'models')

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`)
  return i > 0 ? process.argv[i + 1] : undefined
}
const list = (s: string | undefined, d: string[]) => (s ? s.split(',').filter(Boolean) : d)

const models = list(arg('models'), readdirSync(modelsDir).filter((f) => f.endsWith('.bin.gz')).sort())
const browsers = list(arg('browsers'), ['chromium', 'webkit'])
const backend = arg('backend') ?? 'webgpu'
const throttle = Number(arg('throttle') ?? 4)
const visitsLevels = list(arg('visits'), ['100', '200', '400']).map(Number)
const timingPositions = list(arg('positions'), ['0', '2', '19', '25']).map(Number)
const skipAbove = Number(arg('skip-above') ?? 30_000)
const strengthLevels = list(arg('strength'), []).map(Number)
const strengthOnly = process.argv.includes('--strength-only')
const outFile = arg('out')
const strengthThrottled = process.argv.includes('--strength-throttled')
const maxTimeMs = Number(arg('max-time') ?? 600_000)
const answerMode = process.argv.includes('--answer')

interface CornerResult {
  ms: number
  best: string
  bestScore: number
  tenuki: string | null
  candidates: string[]
}

interface RunResult {
  browser: string
  throttle: number
  /** Where the engine ran: the app's worker, or the page's main thread (throttled Chromium). */
  where: 'worker' | 'main'
  model: string
  bytes: number
  env: { userAgent: string; webgpu: boolean; crossOriginIsolated: boolean; cores: number }
  backend: string
  loadMs: number
  timing: Array<{ visits: number; ms: number[] }>
  /** --answer: ms per reply (scoreFor + analyzeCorner, app defaults). */
  answer: number[]
  /** analyzeCorner's time budget in this run. */
  maxTimeMs: number
  strength: Array<{
    visits: number
    throttled: boolean
    agree: number
    total: number
    /** Time per analyzeCorner during the strength run. */
    ms: number[]
    misses: Array<{ id: string; got: string; top3: string[] }>
  }>
  error?: string
}

/** What the bench page puts on `window.bench` (tools/engine-bench/page/bench.ts). */
interface BenchApi {
  env(): RunResult['env']
  load(modelUrl: string, backend?: string, where?: 'worker' | 'main'): Promise<{ backend: string; model: string; loadMs: number }>
  corner(index: number, visits: number, maxTimeMs?: number): Promise<CornerResult>
  answer(index: number): Promise<{ ms: number; best: string }>
}
/** The page's globalThis. page.evaluate sends the callback's source text, so it cannot call helpers from here. */
type PageGlobal = { bench: BenchApi }

let reference: ReferenceFile | null = null

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b)
  return s.length === 0 ? NaN : s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2
}

async function corner(page: Page, index: number, visits: number): Promise<CornerResult> {
  return page.evaluate(([i, v, t]) => (globalThis as unknown as PageGlobal).bench.corner(i, v, t), [index, visits, maxTimeMs] as const)
}

async function runOne(browser: Browser, browserName: string, model: string, baseUrl: string): Promise<RunResult> {
  const context = await browser.newContext()
  const page = await context.newPage()
  page.on('console', (m) => {
    if (m.type() === 'warning' || m.type() === 'error') console.log(`    [${browserName} console] ${m.text()}`)
  })
  const result: RunResult = {
    browser: browserName,
    throttle: browserName === 'chromium' ? throttle : 1,
    where: browserName === 'chromium' && throttle !== 1 ? 'main' : 'worker',
    model,
    bytes: statSync(join(modelsDir, model)).size,
    env: { userAgent: '', webgpu: false, crossOriginIsolated: false, cores: 0 },
    backend: '',
    loadMs: NaN,
    timing: [],
    answer: [],
    maxTimeMs,
    strength: [],
  }
  try {
    page.setDefaultTimeout(0)
    await page.goto(`${baseUrl}tools/engine-bench/page/bench.html`)
    await page.waitForSelector('body[data-ready="1"]')
    result.env = await page.evaluate(() => (globalThis as unknown as PageGlobal).bench.env())
    if (browserName === 'chromium' && throttle !== 1) {
      const cdp = await context.newCDPSession(page)
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: throttle })
    }
    const modelUrl = `${baseUrl}${relative(root, join(modelsDir, model))}`
    const info = await page.evaluate(([u, b, w]) => (globalThis as unknown as PageGlobal).bench.load(u, b, w), [modelUrl, backend, result.where] as const)
    result.backend = info.backend
    result.loadMs = info.loadMs
    console.log(`  ${browserName} ${model}: ${info.backend} in the ${result.where === 'main' ? 'page' : 'worker'}, load ${Math.round(info.loadMs)} ms`)
    // Warm-up (first search compiles kernels / JITs); position 29 is not in the timing set.
    await corner(page, 29, 16)

    if (answerMode) {
      for (const idx of timingPositions) {
        const r = await page.evaluate((i) => (globalThis as unknown as PageGlobal).bench.answer(i), idx)
        result.answer.push(r.ms)
      }
      console.log(`    reply (defaults): median ${Math.round(median(result.answer))} ms, max ${Math.round(Math.max(...result.answer))} ms (${result.answer.length} runs)`)
    } else if (!strengthOnly) {
      let tooSlow = false
      for (const v of visitsLevels) {
        if (tooSlow) break
        const ms: number[] = []
        for (const idx of timingPositions) {
          const r = await corner(page, idx, v)
          ms.push(r.ms)
          if (r.ms > skipAbove) {
            tooSlow = true
            break
          }
        }
        result.timing.push({ visits: v, ms })
        console.log(`    ${v} visits: median ${Math.round(median(ms))} ms, max ${Math.round(Math.max(...ms))} ms (${ms.length} runs)`)
      }
    }

    if (strengthLevels.length > 0 && reference) {
      // Without a time cap, throttling changes nothing here but the wall time.
      if (browserName === 'chromium' && throttle !== 1 && !strengthThrottled) {
        const cdp = await context.newCDPSession(page)
        await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 })
      }
      for (const visits of strengthLevels) {
        let agree = 0
        const misses: Array<{ id: string; got: string; top3: string[] }> = []
        const ms: number[] = []
        for (let i = 0; i < reference.positions.length; i++) {
          const ref = reference.positions[i]
          const r = await corner(page, i, visits)
          ms.push(r.ms)
          const top3 = ref.top.slice(0, 3)
          if (top3.includes(r.best)) agree++
          else misses.push({ id: ref.id, got: r.best, top3 })
        }
        const throttled = browserName === 'chromium' && throttle !== 1 && strengthThrottled
        result.strength.push({ visits, throttled, agree, total: reference.positions.length, ms, misses })
        console.log(
          `    strength @${visits}${throttled ? ' throttled' : ''}: ${agree}/${reference.positions.length} in native top-3, median ${Math.round(median(ms))} ms, max ${Math.round(Math.max(...ms))} ms`,
        )
      }
    }
  } catch (e) {
    result.error = e instanceof Error ? e.message : String(e)
    console.log(`  ${browserName} ${model}: FAILED ${result.error}`)
  } finally {
    await context.close()
  }
  return result
}

async function main() {
  if (strengthLevels.length > 0) {
    reference = JSON.parse(readFileSync(join(here, 'reference.json'), 'utf8')) as ReferenceFile
    // The page and reference.json must describe the same 30 positions, in order.
    const ids = benchPositions().map((p) => p.id)
    if (JSON.stringify(ids) !== JSON.stringify(reference.positions.map((p) => p.id))) {
      throw new Error('reference.json is out of date with positions.ts; rerun tools/engine-bench/reference.ts')
    }
  }

  // No HMR and no file watching: an edit while the bench runs must not reload the page mid-search.
  const server = await createServer({
    root,
    server: { port: 5199, strictPort: false, hmr: false, watch: null },
    logLevel: 'error',
  })
  await server.listen()
  const port = (server.httpServer?.address() as { port: number }).port
  const baseUrl = `http://localhost:${port}/go-to-d/`
  const results: RunResult[] = []
  try {
    for (const name of browsers) {
      const browser =
        name === 'webkit'
          ? await webkit.launch()
          : await chromium.launch({ args: ['--enable-unsafe-webgpu', '--enable-features=Vulkan'] })
      try {
        for (const model of models) results.push(await runOne(browser, name, model, baseUrl))
      } finally {
        await browser.close()
      }
    }
  } finally {
    await server.close()
  }

  console.log('\nbrowser   throttle  thread  model                                     MB    backend  load s  ' + visitsLevels.map((v) => `${v}v med/max s`.padEnd(15)).join('') + 'top-3')
  for (const r of results) {
    const cells = visitsLevels.map((v) => {
      const t = r.timing.find((x) => x.visits === v)
      return (t ? `${(median(t.ms) / 1000).toFixed(1)}/${(Math.max(...t.ms) / 1000).toFixed(1)}` : '-').padEnd(15)
    })
    const s = r.strength.map((x) => `${x.agree}/${x.total}@${x.visits}`).join(' ') || '-'
    console.log(
      `${r.browser.padEnd(10)}${String(r.throttle).padEnd(10)}${r.where.padEnd(8)}${r.model.replace(/\.bin\.gz$/, '').padEnd(42)}${(r.bytes / 1e6).toFixed(1).padEnd(6)}${(r.backend || 'n/a').padEnd(9)}${(r.loadMs / 1000).toFixed(1).padEnd(8)}${cells.join('')}${r.error ? `ERROR ${r.error}` : s}`,
    )
  }
  if (outFile) {
    writeFileSync(outFile, `${JSON.stringify({ date: new Date().toISOString(), backendPreference: backend, results }, null, 2)}\n`)
    console.log(`Wrote ${outFile}`)
  }
}

main().catch((e) => {
  console.error(e)
  process.exitCode = 1
})
