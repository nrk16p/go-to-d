// The whole app in a real browser, as the owner uses it: Today → the first new pattern → its book line
// → a clean report that survives a reload → Today no longer offers it; then a drill of the book's known
// mistake → Retry → finish; then Settings: Export, and an Import of a bad file.
//
// It runs twice. "Book only" blocks the engine's network (and the service worker, whose own fetch the
// block can't reach), so the teacher answers from the book alone and book moves and book mistakes are
// still judged. "Engine on" is the real setup: service worker, engine loaded, look-ahead searches
// running while the owner plays. Every move comes from the book module, mapped through the symmetry
// the Spar screen picked and wrote into the address.
//
// No fixed sleeps. Every wait is on a state that lasts: the state between the owner's stone and the
// teacher's answer is held for under half a second, so the owner's move is checked once the teacher
// has answered (the verdict stays up, and the move list keeps it).

import { readFileSync } from 'node:fs'
import { expect, test, type Page } from 'playwright/test'
import { BOOK } from '../src/book/data'
import type { BookNode } from '../src/book/types'
import { toGtp, transform, type Pt, type Sym } from '../src/go/coords'
import { newItems } from '../src/progress/course'
import { addDays, BOX_DAYS, reviewKey, type Progress } from '../src/progress/srs'
import { defaultProgress, STORAGE_KEY, todayLocal } from '../src/progress/store'
import { DEFAULT_THRESHOLDS, round1 } from '../src/session/judge'
import { orientNote } from '../src/session/orient'
import { ownerColor, type Side } from '../src/session/sides'
// English: the browser is held to English below, whatever language the machine running this speaks.
import { COPY } from '../src/ui/copy.en'
import { LANG_KEY } from '../src/ui/lang'

/** Ruling R4: the e2e uses a real book pattern with a `mistake` branch (Black's S17 here). */
const MISTAKE_PATTERN = 'star44-low-knight-slide'

const V = COPY.verdict

/** The book check's points lost for a node (src/book/verify), read as a file: Node won't import JSON bare. */
function checkedLoss(family: string, node: BookNode): number {
  const file = JSON.parse(readFileSync(new URL(`../src/book/verify/${family}.json`, import.meta.url), 'utf8'))
  const loss = file.nodes[`${family}:${node.key}`]?.loss
  if (typeof loss !== 'number') throw new Error(`No checked loss for ${node.key}`)
  return loss
}

function bookPt(node: BookNode): Pt {
  const at = node.move?.at
  if (!at || at === 'tenuki') throw new Error(`${node.key} is not a stone on the board`)
  return at
}

/** The symmetry the Spar screen picked: it writes sym and seed into the address once it starts. */
async function sparSym(page: Page): Promise<Sym> {
  await expect(page).toHaveURL(/#\/spar\?.*\bsym=[0-7]\b/)
  const query = new URL(page.url()).hash.split('?')[1]
  return Number(new URLSearchParams(query).get('sym')) as Sym
}

/** The page fits the screen's width: nothing to scroll sideways (16 px gutters, no overflow). */
async function fitsWidth(page: Page): Promise<void> {
  const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  expect(over, `${page.url()} scrolls sideways`).toBeLessThanOrEqual(0)
}

const hit = (page: Page, p: Pt) => page.locator(`.board .hit[data-x="${p.x}"][data-y="${p.y}"]`)
const status = (page: Page) => page.locator('.spar-panel .bar .status')

class Drill {
  /** Owner moves confirmed so far, to alternate between the "Play X" button and a second tap. */
  private confirms = 0

  constructor(
    private readonly page: Page,
    private readonly sym: Sym,
    private readonly touch: boolean,
  ) {}

  board(p: Pt): Pt {
    return transform(p, this.sym)
  }

  /** Waits for the teacher's stone (the last-move dot) and the owner's turn. */
  async teacherPlayed(node: BookNode, movesSoFar: number): Promise<void> {
    const p = this.board(bookPt(node))
    await expect(this.page.locator(`[data-last="${p.x},${p.y}"]`)).toBeVisible()
    await expect(this.page.getByText(COPY.spar.movesSoFar(movesSoFar))).toBeVisible()
    await expect(status(this.page)).toHaveText(COPY.spar.yourMove)
    // Its note, with the points in it turned to this board.
    if (node.note) await expect(this.page.locator('.talk .move-line').last()).toContainText(this.note(node))
  }

  note(node: BookNode): string {
    return orientNote(node.note, this.sym)
  }

  /** Plays the owner's stone. On touch: a tap shows the ghost, then the button or a second tap plays it. */
  async ownerPlays(node: BookNode): Promise<void> {
    const p = this.board(bookPt(node))
    const gtp = toGtp(p)
    await expect(status(this.page)).toHaveText(COPY.spar.yourMove)
    if (!this.touch) {
      await hit(this.page, p).click()
      return
    }
    await hit(this.page, p).tap()
    await expect(this.page.locator(`[data-ghost="${p.x},${p.y}"]`)).toBeVisible()
    await expect(status(this.page)).toHaveText(COPY.spar.tapAgain(gtp))
    if (this.confirms++ % 2 === 0) {
      // The confirm button sits right under the board, on screen without scrolling.
      const confirm = this.page.getByRole('button', { name: COPY.spar.playPoint(gtp) })
      await expect(confirm).toBeInViewport()
      await confirm.tap()
    } else {
      await hit(this.page, p).tap()
    }
  }

  /** The owner's move number `n`, as the verdict and the move list show it. */
  async judged(node: BookNode, n: number, word: string): Promise<void> {
    const item = this.page.locator('.feed li').nth(n - 1)
    await expect(item.locator('strong')).toHaveText(toGtp(this.board(bookPt(node))))
    await expect(item.locator('em')).toHaveText(word)
    const verdict = this.page.locator('.verdict')
    await expect(verdict).toContainText(word)
    if (node.note) await expect(verdict).toContainText(this.note(node))
  }

  /**
   * Plays `nodes`, a stretch of the line after `from` moves. With `ends`, the stretch runs to the end of
   * the line: the teacher's last move ends the session and the report takes over.
   */
  async play(nodes: BookNode[], owner: string, from: number, ends = false): Promise<void> {
    for (const [i, node] of nodes.entries()) {
      const n = from + i + 1
      if (node.move!.color === owner) {
        await this.ownerPlays(node)
      } else if (!(ends && i === nodes.length - 1)) {
        await this.teacherPlayed(node, n)
        const before = nodes[i - 1]
        if (before?.move!.color === owner) await this.judged(before, n - 1, before.kind === 'alternative' ? V.alternative : V.good)
      }
    }
  }
}

async function readProgress(page: Page): Promise<Progress> {
  const raw = await page.evaluate((key) => localStorage.getItem(key), STORAGE_KEY)
  if (!raw) throw new Error('No progress saved')
  return JSON.parse(raw) as Progress
}

/** The names listed under a Today heading ("New today", "Reviews due"). */
function queueNames(page: Page, title: string) {
  return page.locator('section.queue').filter({ has: page.getByRole('heading', { name: title }) }).locator('.queue-name')
}

test.beforeEach(async ({ page }) => {
  // The app picks Thai on a Thai browser (R38); these checks read the English text.
  await page.addInitScript((key) => localStorage.setItem(key, 'en'), LANG_KEY)
  // A headless browser has no share sheet. On iOS the app hands Export to navigator.share, so stand in
  // for the sheet and keep the file it was given.
  await page.addInitScript(() => {
    if (typeof navigator.share !== 'function') return
    const w = window as unknown as { sharedFiles?: { name: string; type: string; text: string }[] }
    Object.defineProperty(navigator, 'share', {
      configurable: true,
      value: async (data: ShareData) => {
        w.sharedFiles = await Promise.all((data.files ?? []).map(async (f) => ({ name: f.name, type: f.type, text: await f.text() })))
      },
    })
  })
})

for (const engine of ['book only', 'engine on'] as const) {
  test.describe(engine, () => {
    if (engine === 'book only') {
      test.use({ serviceWorkers: 'block' })
      test.beforeEach(async ({ context }) => {
        await context.route('**/models/**', (r) => r.abort())
      })
    }
    test('a drill from Today to the report, a book mistake with Retry, then backup in Settings', async ({ page, hasTouch }) => {
      await drillFlow(page, hasTouch, engine)
    })
  })
}

async function drillFlow(page: Page, hasTouch: boolean, engine: 'book only' | 'engine on'): Promise<void> {
  const today = todayLocal()
  const first = newItems(BOOK, defaultProgress(), 1)[0]
  const entry = BOOK.patterns[first.patternId]
  const family = BOOK.families[entry.family].def
  const side: Side = first.side
  const owner = ownerColor(family, side)
  expect(side).toBe('defend')

  await test.step('Today → the first new pattern, played on the book line → a clean report', async () => {
    await page.goto('./')
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(COPY.today.title)
    const fresh = queueNames(page, COPY.today.newTitle)
    await expect(fresh).toHaveCount(defaultProgress().settings.newPerDay)
    await expect(fresh.first()).toHaveText(entry.def.name)
    await fitsWidth(page)

    await page.locator('a.queue-item.is-next').click()
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(entry.def.name)
    await expect(page.getByText(COPY.spar.youAre(owner, side))).toBeVisible()
    const drill = new Drill(page, await sparSym(page), hasTouch)
    // Book only: the chip says the engine is off, and the drill goes on from the book.
    // Engine on: wait for it, so its look-ahead searches run while the drill is played.
    await expect(page.getByText(engine === 'book only' ? COPY.engine.off : COPY.engine.ready)).toBeVisible({ timeout: 30_000 })
    await fitsWidth(page)

    await drill.play(entry.path, owner, 0, true)
    await expect(page).toHaveURL(/#\/report$/)
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(COPY.report.clean)
    const ownerMoves = entry.path.filter((n) => n.move!.color === owner).length
    await expect(page.locator('.stats > div').filter({ hasText: COPY.report.right }).locator('dd')).toHaveText(String(ownerMoves))
    await expect(page.getByText(COPY.report.nextTomorrow)).toBeVisible()
    await fitsWidth(page)
  })

  await test.step('after a reload the report is still there, and Today no longer offers the pattern', async () => {
    await page.reload()
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(COPY.report.clean)

    const review = (await readProgress(page)).reviews[first.key]
    expect(review).toMatchObject({ box: 1, runs: 1, cleanRuns: 1, due: addDays(today, BOX_DAYS[1]) })

    await page.getByRole('navigation').getByRole('link', { name: COPY.nav.today }).click()
    await page.reload()
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(COPY.today.title)
    const fresh = queueNames(page, COPY.today.newTitle)
    await expect(fresh).toHaveCount(defaultProgress().settings.newPerDay)
    expect(await fresh.allTextContents()).not.toContain(entry.def.name)
    // Due later, not today: there is no "Reviews due" list at all.
    await expect(page.getByRole('heading', { name: COPY.today.dueTitle })).toHaveCount(0)
  })

  await test.step('the book mistake: big mistake with the checked loss, Retry, then the line to the end', async () => {
    const m = BOOK.patterns[MISTAKE_PATTERN]
    const mFamily = BOOK.families[m.family]
    const mOwner = ownerColor(mFamily.def, 'defend')
    // The first owner move on the line that has a `mistake` sibling in the book.
    const at = m.path.findIndex((n, i) => {
      const parent = i === 0 ? mFamily.root : m.path[i - 1]
      return n.move!.color === mOwner && parent.children.some((c) => c.kind === 'mistake' && c.move?.color === mOwner)
    })
    expect(at).toBeGreaterThan(0)
    const parent = m.path[at - 1]
    const mistake = parent.children.find((c) => c.kind === 'mistake' && c.move?.color === mOwner)!
    const lost = round1(checkedLoss(m.family, mistake))

    await page.getByRole('navigation').getByRole('link', { name: COPY.nav.library }).click()
    await fitsWidth(page)
    await page.locator('a.queue-item').filter({ hasText: m.def.name }).click()
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(m.def.name)
    await fitsWidth(page)
    await page.getByRole('link', { name: COPY.pattern.drill('defend', mOwner) }).click()
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(m.def.name)
    const sym = await sparSym(page)
    const drill = new Drill(page, sym, hasTouch)

    // A reload in the middle of a drill comes back on the same board: same address, same first stone.
    expect(m.path[0].move!.color).not.toBe(mOwner)
    const address = page.url()
    await drill.teacherPlayed(m.path[0], 1)
    await page.reload()
    await expect(page).toHaveURL(address)
    await drill.teacherPlayed(m.path[0], 1)

    await drill.play(m.path.slice(0, at), mOwner, 0)
    await drill.ownerPlays(mistake)
    await expect(page.getByText(COPY.spar.movesSoFar(at + 1))).toBeVisible()
    const better = drill.board(bookPt(m.path[at]))
    const wrong = drill.board(bookPt(mistake))
    const verdict = page.locator('.verdict')
    await expect(verdict).toContainText(lost > DEFAULT_THRESHOLDS.big ? V.bigMistake : V.mistake)
    await expect(verdict).toContainText(V.better(toGtp(better), lost))
    await expect(verdict).toContainText(drill.note(mistake))
    await expect(page.locator(`[data-marker="better"][data-at="${better.x},${better.y}"]`)).toBeVisible()
    await expect(page.locator(`[data-marker="mistake"][data-at="${wrong.x},${wrong.y}"]`)).toBeVisible()

    const retry = page.getByRole('button', { name: V.retry })
    await expect(retry).toBeInViewport()
    if (hasTouch) await retry.tap()
    else await retry.click()
    // Back to before the mistake: the stone and the pen marks are gone, the teacher's move is the last one.
    await expect(status(page)).toHaveText(COPY.spar.yourMove)
    await expect(page.locator('[data-marker]')).toHaveCount(0)
    await expect(page.getByText(COPY.spar.movesSoFar(at))).toBeVisible()
    const prev = drill.board(bookPt(parent))
    await expect(page.locator(`[data-last="${prev.x},${prev.y}"]`)).toBeVisible()
    await expect(hit(page, wrong).locator('.hover')).toHaveCount(1) // the point is empty again

    await drill.play(m.path.slice(at), mOwner, at, true)
    await expect(page).toHaveURL(/#\/report$/)
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(COPY.report.mistakes(1))
    await expect(page.locator('.stats > div').filter({ hasText: COPY.report.wrong }).locator('dd')).toHaveText('1')
    await expect(page.locator('.stats > div').filter({ hasText: COPY.report.lost }).locator('dd')).toHaveText(String(lost))
  })

  await test.step('Settings: Export gives the progress as JSON; a bad Import says so and changes nothing', async () => {
    await page.getByRole('navigation').getByRole('link', { name: COPY.nav.settings }).click()
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(COPY.settings.title)
    await fitsWidth(page)
    const stored = await page.evaluate((key) => localStorage.getItem(key), STORAGE_KEY)

    const exportButton = page.getByRole('button', { name: COPY.settings.export })
    const ios = await page.evaluate(() => /iPhone|iPad/.test(navigator.userAgent))
    let file: { name: string; text: string }
    if (ios) {
      // iOS: the share sheet ("Save to Files") gets the file.
      await exportButton.tap()
      const shared = await page.waitForFunction(() => (window as unknown as { sharedFiles?: unknown }).sharedFiles)
      const files = (await shared.jsonValue()) as { name: string; type: string; text: string }[]
      expect(files).toHaveLength(1)
      expect(files[0].type).toBe('application/json')
      file = files[0]
    } else {
      const download = page.waitForEvent('download')
      if (hasTouch) await exportButton.tap()
      else await exportButton.click()
      const d = await download
      file = { name: d.suggestedFilename(), text: readFileSync((await d.path())!, 'utf8') }
    }
    expect(file.name).toBe(`go-to-d-progress-${today}.json`)
    const exported = JSON.parse(file.text) as Progress
    expect(Object.keys(exported.reviews).sort()).toEqual([...new Set([first.key, reviewKey(MISTAKE_PATTERN, 'defend')])].sort())

    const input = page.locator('input[type="file"]')
    // The exported file is one Import accepts: it asks first.
    const n = Object.keys(exported.reviews).length
    await input.setInputFiles({ name: file.name, mimeType: 'application/json', buffer: Buffer.from(file.text) })
    await expect(page.getByText(COPY.settings.importConfirm(n, n))).toBeVisible()
    await page.getByRole('button', { name: COPY.settings.cancel }).click()

    await input.setInputFiles({ name: 'notes.json', mimeType: 'application/json', buffer: Buffer.from('{"notes":"not progress"}') })
    await expect(page.getByRole('alert')).toHaveText(COPY.settings.importBad('Not a Go-to-D progress file'))
    expect(await page.evaluate((key) => localStorage.getItem(key), STORAGE_KEY)).toBe(stored)
  })
}
