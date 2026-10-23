// @vitest-environment jsdom
// The Pattern page steps through the main line with its notes, and drills from each drillable side.
// The Library lists every pattern with a level for each of its sides.

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { BOOK } from '../../src/book/data'
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

  it('offers a drill per drillable side, and only one for a pattern with a trick', () => {
    render(<Pattern id="star44-low-jump" />)
    const hrefs = () =>
      screen
        .getAllByRole('link')
        .map((a) => a.getAttribute('href')!)
        .filter((h) => h.startsWith('#/spar'))
    expect(hrefs()).toEqual([
      '#/spar?family=star44&pattern=star44-low-jump&side=defend',
      '#/spar?family=star44&pattern=star44-low-jump&side=attack',
    ])
    cleanup()

    render(<Pattern id="invade33-cut-trick" />)
    expect(hrefs()).toEqual(['#/spar?family=invade33&pattern=invade33-cut-trick&side=defend'])
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
    expect(document.querySelectorAll('.side-level')).toHaveLength(39)
    expect(screen.getAllByRole('img', { name: COPY.level(0) })).toHaveLength(39)
  })
})
