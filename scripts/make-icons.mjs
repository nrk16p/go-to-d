// Draws the app icon (an original corner motif: the upper-right corner of a board, Black on the 4-4
// point and White's 3-3 invasion) as SVG, and rasterises the PNG sizes the web manifest and iOS need
// with Playwright's Chromium. The output is committed; run this again only to change the icon.
//
//   node scripts/make-icons.mjs
//
// Writes public/favicon.svg, public/apple-touch-icon.png (180) and public/icons/pwa-{192,512}.png,
// public/icons/maskable-512.png.

import fs from 'node:fs/promises'
import path from 'node:path'
import { chromium } from 'playwright'

const root = path.resolve(import.meta.dirname, '..')
const out = path.join(root, 'public')

// Colours from src/ui/theme.css (light theme).
const BOARD = '#cfdacf'
const LINE = '#3b4943'
const EDGE = '#1f2a25'
const BLACK = '#161a18'
const WHITE = '#fdfefc'
const WHITE_RIM = '#46524c'

/**
 * The motif on a 512 grid: lines `step` apart, the board's right edge at `right` and top edge at `top`.
 * The open sides run off the canvas. `radius` rounds the square (0 = full bleed).
 */
function motif({ step = 100, right = 432, top = 80, stone = 46, radius = 0 } = {}) {
  const xs = Array.from({ length: 8 }, (_, i) => right - i * step).filter((x) => x > -step)
  const ys = Array.from({ length: 8 }, (_, i) => top + i * step).filter((y) => y < 512 + step)
  const lines = [
    ...xs.map((x, i) => `<line x1="${x}" y1="${top}" x2="${x}" y2="${512 + 40}" stroke="${i === 0 ? EDGE : LINE}" stroke-width="${i === 0 ? 8 : 4}"/>`),
    ...ys.map((y, i) => `<line x1="-40" y1="${y}" x2="${right}" y2="${y}" stroke="${i === 0 ? EDGE : LINE}" stroke-width="${i === 0 ? 8 : 4}"/>`),
  ].join('')
  // Black on the 4-4 point (three lines in from both edges), White invading at the 3-3 point.
  const b = { x: right - 3 * step, y: top + 3 * step }
  const w = { x: right - 2 * step, y: top + 2 * step }
  const r = stone
  const art =
    `<g stroke-linecap="square">${lines}</g>` +
    `<circle cx="${b.x}" cy="${b.y}" r="${r}" fill="${BLACK}"/>` +
    `<circle cx="${w.x}" cy="${w.y}" r="${r - 2}" fill="${WHITE}" stroke="${WHITE_RIM}" stroke-width="4"/>`
  const clip = radius > 0 ? `<clipPath id="c"><rect width="512" height="512" rx="${radius}"/></clipPath>` : ''
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">` +
    `<defs>${clip}</defs>` +
    `<g${radius > 0 ? ' clip-path="url(#c)"' : ''}>` +
    `<rect width="512" height="512" fill="${BOARD}"/>` +
    art +
    `</g></svg>`
  )
}

const ICONS = [
  { file: 'icons/pwa-192.png', size: 192, svg: motif({ radius: 88 }) },
  { file: 'icons/pwa-512.png', size: 512, svg: motif({ radius: 88 }) },
  // Maskable: full bleed, smaller grid, and both stones well inside the safe circle (40% of the size).
  { file: 'icons/maskable-512.png', size: 512, svg: motif({ step: 80, right: 440, top: 72, stone: 37 }) },
  // iOS rounds the corners itself, and fills transparency with black.
  { file: 'apple-touch-icon.png', size: 180, svg: motif() },
]

async function main() {
  await fs.mkdir(path.join(out, 'icons'), { recursive: true })
  await fs.writeFile(path.join(out, 'favicon.svg'), motif({ radius: 88 }) + '\n')
  const browser = await chromium.launch()
  try {
    for (const icon of ICONS) {
      const page = await browser.newPage({ viewport: { width: icon.size, height: icon.size }, deviceScaleFactor: 1 })
      const svg = icon.svg.replace('width="512" height="512"', `width="${icon.size}" height="${icon.size}"`)
      await page.setContent(`<html><body style="margin:0;background:transparent">${svg}</body></html>`)
      await page.screenshot({ path: path.join(out, icon.file), omitBackground: true, clip: { x: 0, y: 0, width: icon.size, height: icon.size } })
      await page.close()
      console.log(`Wrote public/${icon.file}`)
    }
  } finally {
    await browser.close()
  }
  console.log('Wrote public/favicon.svg')
}

main().catch((err) => {
  console.error(err)
  process.exitCode = 1
})
