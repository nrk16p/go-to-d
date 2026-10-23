// R46/R47 merge check: wherever an opening shows the owner's side, it says the colour, never a corner.
// Shared by openingSeats.test.tsx (English) and openingSeats.th.test.tsx (Thai): each opens the watch
// screen, the drill, the Pattern page, the Library and Today for every opening family and side, and
// collects the words that name the side (headers, labels, buttons). Book names and notes are left out:
// they are content ("Corners first" is a fair name for an opening).

import { act, cleanup, render } from '@testing-library/react'
import { expect } from 'vitest'
import { BOOK } from '../../src/book/data'
import { isBoardFamily } from '../../src/book/setups'
import type { FamilyId } from '../../src/book/types'
import { drillableSides, ownerColor } from '../../src/session/sides'
import { COPY } from '../../src/ui/copy'
import { EngineHub } from '../../src/ui/engine'
import { Library } from '../../src/ui/screens/Library'
import { Pattern } from '../../src/ui/screens/Pattern'
import { Spar } from '../../src/ui/screens/Spar'
import { Today } from '../../src/ui/screens/Today'
import { Watch } from '../../src/ui/screens/Watch'
import { FakeEngine } from '../session/fakeEngine'

const OPENINGS = (Object.keys(BOOK.families) as FamilyId[]).filter((f) => isBoardFamily(BOOK.families[f].def))

/** The side-naming words on the page: the header line, labels, groups and every button and link but book names. */
function sideWords(): string[] {
  const out: string[] = []
  const texts = (sel: string) => document.querySelectorAll(sel).forEach((e) => out.push(e.textContent ?? ''))
  texts('.spar-head .who')
  texts('.drill-who')
  texts('.drill p.muted')
  texts('.side-level')
  texts('.queue-meta')
  texts('button')
  texts('.btn')
  texts('.free .link-list a[href*="family=open-"]')
  document.querySelectorAll('[role="group"][aria-label]').forEach((e) => out.push(e.getAttribute('aria-label') ?? ''))
  return out.filter((t) => t.trim() !== '')
}

async function settle(): Promise<void> {
  await act(async () => {
    for (let i = 0; i < 5; i++) await new Promise((r) => setTimeout(r, 0))
  })
}

/** Opens every screen that shows an opening's side and checks its words against `corner`. */
export async function checkOpeningSeats(corner: RegExp): Promise<void> {
  expect(OPENINGS.length).toBeGreaterThan(0)
  const hubs: EngineHub[] = []
  const seen: string[] = []
  const check = (where: string) => {
    const words = sideWords()
    seen.push(...words)
    for (const w of words) expect(w, `${where}: "${w}"`).not.toMatch(corner)
    cleanup()
  }
  try {
    for (const family of OPENINGS) {
      const def = BOOK.families[family].def
      for (const pattern of def.patterns) {
        for (const side of drillableSides(BOOK, pattern.id)) {
          const params = { family, pattern: pattern.id, side, sym: '0', seed: '1' }
          render(<Watch params={{ ...params, phase: 'watch' }} />)
          expect(document.querySelector('.spar-head .who')?.textContent).toBe(COPY.watch.leadColor(ownerColor(def, side)))
          check(`watch ${pattern.id} ${side}`)

          const hub = new EngineHub(() => new FakeEngine({ status: 'loading' }))
          hubs.push(hub.start())
          render(<Spar params={params} engine={hub} gapMs={0} />)
          await settle()
          expect(document.querySelector('.spar-head .who')?.textContent).toBe(COPY.spar.youAreColor(ownerColor(def, side)))
          check(`drill ${pattern.id} ${side}`)
        }
        render(<Pattern id={pattern.id} />)
        check(`pattern ${pattern.id}`)
      }
    }
    render(<Library />)
    const section = document.querySelector('section.openings')
    expect(section).toBeTruthy()
    // Only the openings' part of the Library: the corners are allowed to talk about corners.
    document.querySelectorAll('section.family').forEach((s) => {
      if (!section!.contains(s)) s.remove()
    })
    check('library')
    render(<Today today="2026-10-22" />)
    document.querySelectorAll('section.queue').forEach((s) => {
      if (!s.querySelector('#openings-title')) s.remove()
    })
    // Teacher's choice: the corner switch and corner links aren't the openings'.
    document.querySelectorAll('.free .segmented, .free .link-list a:not([href*="family=open-"])').forEach((e) => e.remove())
    check('today')
  } finally {
    for (const h of hubs) h.dispose()
  }
  // The colours did show up.
  expect(seen.some((w) => w.includes(COPY.colorName('black')))).toBe(true)
}
