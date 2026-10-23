// A whole-board opening (R46) in a real browser, book only: Today's opening → watched first on the whole
// board (R45) → Try it yourself → the drill at phone width with the touch ghost and its confirm button →
// a clean report. The moves come from the book module, turned by the symmetry the screen wrote into the
// address. Nothing on the way talks about a corner.

import { expect, test, type Page } from 'playwright/test'
import { BOOK } from '../src/book/data'
import type { BookNode } from '../src/book/types'
import { toGtp, transform, type Pt, type Sym } from '../src/go/coords'
import { openingOrder } from '../src/progress/course'
import { ownerColor } from '../src/session/sides'
import { COPY } from '../src/ui/copy.en'
import { LANG_KEY } from '../src/ui/lang'

test.use({ serviceWorkers: 'block' })

test.beforeEach(async ({ page, context }) => {
  await page.addInitScript((key) => localStorage.setItem(key, 'en'), LANG_KEY)
  await context.route('**/models/**', (r) => r.abort())
})

function bookPt(node: BookNode): Pt {
  const at = node.move?.at
  if (!at || at === 'tenuki') throw new Error(`${node.key} is not a stone on the board`)
  return at
}

async function fitsWidth(page: Page): Promise<void> {
  const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  expect(over, `${page.url()} scrolls sideways`).toBeLessThanOrEqual(0)
}

test('the day’s opening, drilled on the whole board, to a clean report', async ({ page, hasTouch }) => {
  const item = openingOrder(BOOK)[0]
  const entry = BOOK.patterns[item.patternId]
  const owner = ownerColor(BOOK.families[item.family].def, item.side)

  await page.goto('./')
  const section = page.locator('section.queue').filter({ has: page.getByRole('heading', { name: COPY.today.openingsTitle }) })
  await expect(section.locator('.queue-name')).toHaveText([entry.def.name])
  await expect(section.locator('.queue-meta')).toContainText(COPY.colorName(owner))
  await section.locator('a.queue-item').click()

  // A new opening is watched first, on the whole board.
  await expect(page).toHaveURL(/[?&]phase=watch\b/)
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(entry.def.name)
  await expect(page.getByText(COPY.watch.leadColor(owner))).toBeVisible()
  await expect(page.locator('.spar-board .hit')).toHaveCount(361)
  await expect(page.locator('.spar-head .who')).not.toContainText('corner')
  await fitsWidth(page)
  const tryIt = page.getByRole('link', { name: COPY.watch.tryIt })
  if (hasTouch) await tryIt.tap()
  else await tryIt.click()

  await expect(page).not.toHaveURL(/phase=watch/)
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(entry.def.name)
  await expect(page.getByText(COPY.spar.youAreColor(owner))).toBeVisible()
  await expect(page.locator('.spar-head .who')).not.toContainText('corner')
  await expect(page).toHaveURL(/#\/spar\?.*\bsym=[0-7]\b/)
  const sym = Number(new URLSearchParams(new URL(page.url()).hash.split('?')[1]).get('sym')) as Sym
  await expect(page.locator('.spar-board .hit')).toHaveCount(361)
  await expect(page.getByRole('button', { name: COPY.spar.playElsewhere })).toHaveCount(0)
  await expect(page.getByRole('button', { name: COPY.spar.fullBoard })).toHaveCount(0)
  await fitsWidth(page)

  const status = page.locator('.spar-panel .bar .status')
  for (const node of entry.path) {
    if (node.move!.color !== owner) continue
    const p = transform(bookPt(node), sym)
    const hit = page.locator(`.board .hit[data-x="${p.x}"][data-y="${p.y}"]`)
    await expect(status).toHaveText(COPY.spar.yourMove)
    if (!hasTouch) {
      await hit.click()
      continue
    }
    await hit.tap()
    await expect(page.locator(`[data-ghost="${p.x},${p.y}"]`)).toBeVisible()
    const confirm = page.getByRole('button', { name: COPY.spar.playPoint(toGtp(p)) })
    await expect(confirm).toBeInViewport()
    await confirm.tap()
  }

  await expect(page).toHaveURL(/#\/report$/)
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(COPY.report.clean)
  await expect(page.getByText(COPY.report.subtitleColor(entry.def.name, owner))).toBeVisible()
  await fitsWidth(page)
})
