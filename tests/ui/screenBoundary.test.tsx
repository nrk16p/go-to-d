// @vitest-environment jsdom
// A screen that throws while drawing shows a way back instead of blanking the app (M3).

import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { COPY } from '../../src/ui/copy'
import { href } from '../../src/ui/router'
import { ScreenBoundary } from '../../src/ui/ScreenBoundary'

function Broken(): never {
  throw new Error('a stale report in sessionStorage')
}

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('ScreenBoundary', () => {
  it('shows what happened and a link back to Today', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    render(
      <ScreenBoundary>
        <Broken />
      </ScreenBoundary>,
    )
    expect(screen.getByRole('alert')).toBeTruthy()
    expect(screen.getByRole('heading', { name: COPY.broken.title })).toBeTruthy()
    expect(screen.getByText(COPY.broken.body)).toBeTruthy()
    expect(screen.getByRole('link', { name: COPY.spar.backToToday }).getAttribute('href')).toBe(href.today)
    expect(error).toHaveBeenCalled()
  })

  it('shows the screen itself when nothing throws', () => {
    render(
      <ScreenBoundary>
        <p>Today</p>
      </ScreenBoundary>,
    )
    expect(screen.getByText('Today')).toBeTruthy()
    expect(screen.queryByRole('alert')).toBeNull()
  })
})
