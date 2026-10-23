// How long the teacher takes to answer a move off the book, in the real app with the engine on.
// A measurement, not a check: it only runs when asked (`npm run e2e:answer-time`), on the two phone
// projects. Chromium gets DevTools' 4× CPU throttle; that slows the page but not the engine's worker
// (see docs/engine-choice.md), so the worker's own slow-phone number is the bench's.
//
// One page load and one engine for all trials, as in a real session; a first trial warms the engine up
// and isn't counted. Each trial: the knight's-move drill, the teacher's R14, then one Black move the book
// doesn't have. Each trial turns the board by the next of the 8 symmetries, so the engine meets a
// position it hasn't searched (it keeps its last few whole-board searches, and a repeat would come back
// from there at once). Between trials the page waits 4 s on Today,
// so a search left over from the last trial (the look-ahead after the teacher's reply) is done and
// nothing queues in front of the next one. Timed in the page, from the click that plays the move:
//   verdict  until the verdict shows
//   reply    until the teacher's stone is down and it's the owner's move again (or the line ends).
//            After a mistake the session stops, so reply is timed from the Play on click instead.
// "at once" plays as soon as it's the owner's move; "after 3 s" first lets the look-ahead finish,
// as a person thinking would. The pauses are the scenario, not waits for the app.

import { expect, test, type Page } from 'playwright/test'
import { parseGtp, transform, type Sym } from '../src/go/coords'
import { COPY } from '../src/ui/copy'
import { sparHref } from '../src/ui/router'

/** Black answers to W R14 that are not in the book (book frame). */
const MOVES = ['N17', 'P17', 'R10', 'Q12', 'P15']
const THINK = [
  { name: 'at once', ms: 0 },
  { name: 'after 3 s', ms: 3000 },
]
/** Long enough for a search left from the last trial to end (a 2 s budget plus its overrun). */
const IDLE_MS = 4000

const drill = (sym: Sym, seed: number) =>
  sparHref({ family: 'star44', pattern: 'star44-low-knight-slide', side: 'defend', sym: String(sym), seed: String(seed) })

interface Marks {
  start?: number
  verdict?: number
  reply?: number
}

interface Trial {
  move: string
  think: string
  verdict: string
  verdictMs: number
  replyMs: number
}

/** Puts a timer in the page: the next click starts it; it marks when a verdict shows and when it's the owner's move again. */
async function installTimer(page: Page): Promise<void> {
  await page.evaluate(
    ({ yourMove, done }) => {
      const w = window as unknown as { marks: Marks; timerReset: (verdictSeen: boolean) => void }
      let m: Marks = {}
      let verdictSeen = false
      w.timerReset = (seen) => {
        m = {}
        verdictSeen = seen
        w.marks = m
      }
      w.timerReset(false)
      document.addEventListener('click', () => (m.start ??= performance.now()), { capture: true })
      const look = () => {
        if (m.start === undefined) return
        const now = performance.now()
        if (!verdictSeen && document.querySelector('.verdict')) {
          verdictSeen = true
          m.verdict = now
        }
        const status = document.querySelector('.spar-panel .bar .status')?.textContent ?? ''
        const over = location.hash === '#/report' || status === done
        if (verdictSeen && m.reply === undefined && (status === yourMove || over)) m.reply = now
      }
      new MutationObserver(look).observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true })
      window.addEventListener('hashchange', look)
    },
    { yourMove: COPY.spar.yourMove, done: COPY.spar.done },
  )
}

const resetTimer = (page: Page, verdictSeen: boolean) =>
  page.evaluate((seen) => (window as unknown as { timerReset: (s: boolean) => void }).timerReset(seen), verdictSeen)

async function replied(page: Page): Promise<Marks> {
  const marks = () => page.evaluate(() => (window as unknown as { marks: Marks }).marks)
  await expect.poll(async () => (await marks()).reply, { timeout: 30_000 }).toBeDefined()
  return marks()
}

test('the teacher answers an off-book move', async ({ page, browserName }, info) => {
  test.skip(!process.env.ANSWER_TIME, 'a measurement: run with ANSWER_TIME=1 (npm run e2e:answer-time)')
  test.skip(info.project.name === 'chromium-desktop', 'phone projects only')
  test.setTimeout(10 * 60_000)

  const throttle = browserName === 'chromium' ? 4 : 1
  if (throttle > 1) {
    const cdp = await page.context().newCDPSession(page)
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: throttle })
  }

  await page.goto('./#/settings')
  await expect(page.getByText(COPY.engine.ready)).toBeVisible({ timeout: 60_000 })
  const backend = (await page.locator('.facts dd').first().textContent()) ?? ''
  await installTimer(page)

  const trials: Trial[] = []
  const runs = [
    { move: MOVES[0], think: THINK[1], warmUp: true },
    ...THINK.flatMap((think) => MOVES.map((move) => ({ move, think, warmUp: false }))),
  ]
  for (const [i, { move, think, warmUp }] of runs.entries()) {
    const sym = (i % 8) as Sym
    await page.evaluate(() => (location.hash = '#/'))
    await page.waitForTimeout(IDLE_MS)
    await page.evaluate((h) => (location.hash = h), drill(sym, i + 1))
    await expect(page.locator('.spar-panel .bar .status')).toHaveText(COPY.spar.yourMove)
    if (think.ms) await page.waitForTimeout(think.ms)

    await resetTimer(page, false)
    const p = transform(parseGtp(move), sym)
    await page.locator(`.board .hit[data-x="${p.x}"][data-y="${p.y}"]`).click()
    const verdict = page.locator('.verdict')
    await expect(verdict).toBeVisible({ timeout: 30_000 })
    const verdictText = (await verdict.locator('strong').first().textContent()) ?? ''

    const playOn = page.getByRole('button', { name: COPY.verdict.playOn })
    let marks: Marks
    let verdictMs: number
    if (await playOn.isVisible()) {
      // Stopped on a mistake: the teacher answers after Play on, timed from that click.
      const shown = await page.evaluate(() => (window as unknown as { marks: Marks }).marks)
      verdictMs = shown.verdict! - shown.start!
      await resetTimer(page, true)
      await playOn.click()
      marks = await replied(page)
    } else {
      marks = await replied(page)
      verdictMs = marks.verdict! - marks.start!
    }
    if (!warmUp) trials.push({ move, think: think.name, verdict: verdictText, verdictMs, replyMs: marks.reply! - marks.start! })
  }

  const s = (ms: number) => (ms / 1000).toFixed(2)
  const lines = trials.map((t) => `${t.think.padEnd(9)} ${t.move.padEnd(4)} ${t.verdict.padEnd(36)} verdict ${s(t.verdictMs)} s  reply ${s(t.replyMs)} s`)
  const label = `${info.project.name}${throttle > 1 ? ` (page ${throttle}× throttled)` : ''}, ${backend}`
  console.log(`\n${label}\n${lines.join('\n')}`)
  await info.attach('answer-time.json', {
    body: JSON.stringify({ project: info.project.name, throttle, backend, trials }, null, 2),
    contentType: 'application/json',
  })
})
