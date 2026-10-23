// @vitest-environment jsdom
// The two ways to change language: the ไทย / EN switch in the header and the choice in Settings. Both
// hand the other language to setLang (which saves and reloads); this page loaded in English.

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { COPY } from '../../src/ui/copy'
import { EngineHub } from '../../src/ui/engine'
import { LangSwitch } from '../../src/ui/LangSwitch'
import { Settings } from '../../src/ui/screens/Settings'
import { FakeEngine } from '../session/fakeEngine'
import { MemoryStorage } from './memoryStorage'

const setLang = vi.hoisted(() => vi.fn((): boolean => true))
vi.mock('../../src/ui/lang', async (original) => ({ ...(await original<typeof import('../../src/ui/lang')>()), setLang }))

let hubs: EngineHub[] = []

beforeEach(() => {
  vi.stubGlobal('localStorage', new MemoryStorage())
  setLang.mockClear()
  setLang.mockImplementation(() => true)
})

afterEach(() => {
  cleanup()
  for (const h of hubs) h.dispose()
  hubs = []
  vi.unstubAllGlobals()
})

describe('the header switch', () => {
  it('offers Thai, labelled in Thai, and switches to it', () => {
    render(<LangSwitch />)
    const button = screen.getByRole('button', { name: 'เปลี่ยนเป็นภาษาไทย' })
    expect(button.getAttribute('lang')).toBe('th')
    expect(button.textContent).toBe('ไทย')
    fireEvent.click(button)
    expect(setLang).toHaveBeenCalledWith('th')
  })
})

describe('Settings › Language', () => {
  function renderSettings() {
    const hub = new EngineHub(() => new FakeEngine()).start()
    hubs.push(hub)
    render(<Settings engine={hub} today="2026-10-22" />)
  }

  it('shows the current language picked, and picking the other one switches', () => {
    renderSettings()
    const group = screen.getByRole('radiogroup', { name: COPY.settings.langTitle })
    expect(group).toBeTruthy()
    const english = screen.getByRole('radio', { name: 'English' }) as HTMLInputElement
    const thai = screen.getByRole('radio', { name: 'ไทย' }) as HTMLInputElement
    expect(english.checked).toBe(true)
    expect(thai.checked).toBe(false)
    fireEvent.click(thai)
    expect(setLang).toHaveBeenCalledWith('th')
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('says so when the browser will not keep the choice', () => {
    setLang.mockImplementation(() => false)
    renderSettings()
    fireEvent.click(screen.getByRole('radio', { name: 'ไทย' }))
    expect(screen.getByRole('alert').textContent).toBe(COPY.settings.saveFailed)
  })
})
