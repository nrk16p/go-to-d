// @vitest-environment jsdom
// The Pattern page steps through the main line with its notes, and drills from each drillable side.
// The Library lists every pattern with a level for each of its sides.

import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { BOOK } from '../../src/book/data'
import { drillableSides } from '../../src/session/sides'
import { COPY } from '../../src/ui/copy'
import { Library } from '../../src/ui/screens/Library'
import { Pattern } from '../../src/ui/screens/Pattern'
import { MemoryStorage } from './memoryStorage'

const P = COPY.pattern

beforeEach(() => {
  vi.stubGlobal('localStorage', new MemoryStorage())
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

const step = () => `${document.querySelector('.step-count')?.textContent} ${document.querySelector('.step')?.textContent}`
const stones = () => document.querySelectorAll('[data-stone]').length

describe('Pattern', () => {
  it('steps forward and back through the main line, one note at a time', () => {
    render(<Pattern id="star44-low-knight-slide" />)
    const path = BOOK.patterns['star44-low-knight-slide'].path
    expect(step()).toContain(P.start)
    const atStart = stones()
    expect(screen.getByRole('button', { name: P.prev })).toHaveProperty('disabled', true)

    fireEvent.click(screen.getByRole('button', { name: P.next }))
    expect(step()).toContain(P.step(1, path.length))
    expect(step()).toContain(P.move('white', 'R14'))
    expect(step()).toContain(path[0].note)
    expect(stones()).toBe(atStart + 1)

    for (let i = 1; i < path.length; i++) fireEvent.click(screen.getByRole('button', { name: P.next }))
    expect(step()).toContain(P.step(path.length, path.length))
    expect(screen.getByRole('button', { name: P.next })).toHaveProperty('disabled', true)

    fireEvent.keyDown(window, { key: 'ArrowLeft' })
    expect(step()).toContain(P.step(path.length - 1, path.length))
  })

  it('offers a drill per drillable side (watch first, or test), and only one side for a pattern with a trick', () => {
    render(<Pattern id="star44-low-jump" />)
    const hrefs = () =>
      screen
        .getAllByRole('link')
        .map((a) => a.getAttribute('href')!)
        .filter((h) => h.startsWith('#/spar'))
    expect(hrefs()).toEqual([
      '#/spar?family=star44&pattern=star44-low-jump&side=defend&phase=watch',
      '#/spar?family=star44&pattern=star44-low-jump&side=defend',
      '#/spar?family=star44&pattern=star44-low-jump&side=attack&phase=watch',
      '#/spar?family=star44&pattern=star44-low-jump&side=attack',
    ])
    cleanup()

    render(<Pattern id="invade33-cut-trick" />)
    expect(hrefs()).toEqual([
      '#/spar?family=invade33&pattern=invade33-cut-trick&side=defend&phase=watch',
      '#/spar?family=invade33&pattern=invade33-cut-trick&side=defend',
    ])
    expect(screen.getByText(P.oneSide)).toBeTruthy()
  })

  it('says there is nothing there for an unknown id', () => {
    render(<Pattern id="no-such-pattern" />)
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(COPY.notFound.title)
  })
})

describe('Library', () => {
  it('lists every pattern with a level per drillable side', () => {
    render(<Library />)
    const rows = document.querySelectorAll('a.queue-item')
    expect(rows).toHaveLength(Object.keys(BOOK.patterns).length)
    const sides = Object.keys(BOOK.patterns).reduce((n, id) => n + drillableSides(BOOK, id).length, 0)
    expect(document.querySelectorAll('.side-level')).toHaveLength(sides)
    expect(screen.getAllByRole('img', { name: COPY.level(0, false) })).toHaveLength(sides)
  })

  it('lists the openings in a section of their own after the corners, with colours for sides (R46)', () => {
    render(<Library />)
    const section = screen.getByRole('region', { name: COPY.library.openingsTitle })
    const h4 = BOOK.families['open-h4']
    const even = BOOK.families['open-even']
    expect(within(section).getByRole('heading', { name: h4.def.name })).toBeTruthy()
    expect(within(section).getByRole('heading', { name: even.def.name })).toBeTruthy()
    const rows = [...section.querySelectorAll('a.queue-item')]
    expect(rows).toHaveLength(h4.def.patterns.length + even.def.patterns.length)
    // Each side's Watch and Test sit in a group named by colour.
    expect(within(section).getAllByRole('group', { name: P.drillColor('black') }).length).toBeGreaterThan(0)
    const sides = [...section.querySelectorAll('.side-level')].map((e) => e.textContent)
    expect(sides).toContain(COPY.colorName('black'))
    expect(sides).toContain(COPY.colorName('white'))
    expect(sides).not.toContain(COPY.library.sideShort('defend'))
    // Corner families come first and keep defend/attack.
    const all = [...document.querySelectorAll('a.queue-item')]
    expect(all.indexOf(rows[0])).toBe(all.length - rows.length)
  })
})

describe('Pattern: an opening (R46)', () => {
  const first = (family: 'open-h4' | 'open-even') => BOOK.families[family].def.patterns[0].id
  /** The drill sides' labels, one per side (each with its Watch and Test). */
  const drills = () => [...document.querySelectorAll('.drill .drill-who')].map((e) => e.textContent)

  it('starts the even game on an empty board and drills it as Black or White', () => {
    render(<Pattern id={first('open-even')} />)
    expect(step()).toContain(P.emptyBoard)
    expect(stones()).toBe(0)
    expect(drills()).toEqual([P.drillColor('black'), P.drillColor('white')])
  })

  it('drills the 4-stone opening as Black only, and says why', () => {
    render(<Pattern id={first('open-h4')} />)
    expect(drills()).toEqual([P.drillColor('black')])
    expect(screen.getByText(P.blackOnly)).toBeTruthy()
    expect(screen.queryByText(P.oneSide)).toBeNull()
    // The whole board: 361 points, 19 row numbers and 19 column letters.
    expect(document.querySelectorAll('[data-x]')).toHaveLength(361)
    expect(document.querySelectorAll('.board .labels text')).toHaveLength(38)
  })
})
