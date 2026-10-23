// @vitest-environment jsdom
// Settings: the teacher's numbers, export, import with an in-page confirm (a bad file changes nothing),
// reset, and what the engine runs on.

import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Progress, ReviewState } from '../../src/progress/srs'
import { defaultProgress, loadProgress, STORAGE_KEY } from '../../src/progress/store'
import { COPY } from '../../src/ui/copy'
import { EngineHub } from '../../src/ui/engine'
import { Settings } from '../../src/ui/screens/Settings'
import { FakeEngine, type EngineStatus } from '../session/fakeEngine'
import { MemoryStorage } from './memoryStorage'

const TODAY = '2026-10-22'
const S = COPY.settings

let storage: MemoryStorage
let hubs: EngineHub[] = []

function hub(status: EngineStatus = 'ready'): EngineHub {
  const h = new EngineHub(() => new FakeEngine({ status })).start()
  hubs.push(h)
  return h
}

function review(box: ReviewState['box']): ReviewState {
  return { box, due: '2026-10-25', runs: 1, cleanRuns: 1, missedKeys: [] }
}

function progressWith(n: number): Progress {
  const ids = ['star44-low-knight-slide', 'star44-low-jump', 'invade33-stand', 'komoku34-tenuki']
  return {
    ...defaultProgress(),
    reviews: Object.fromEntries(ids.slice(0, n).map((id) => [`${id}:defend`, review(2)])),
    streak: { count: 2, lastDay: '2026-10-21' },
  }
}

function stored(): Progress | null {
  const raw = storage.getItem(STORAGE_KEY)
  return raw ? (JSON.parse(raw) as Progress) : null
}

async function settle(): Promise<void> {
  await act(async () => {
    for (let i = 0; i < 5; i++) await new Promise((r) => setTimeout(r, 0))
  })
}

async function pickFile(text: string, name = 'backup.json'): Promise<void> {
  const input = document.querySelector('input[type="file"]') as HTMLInputElement
  const file = new File([text], name, { type: 'application/json' })
  fireEvent.change(input, { target: { files: [file] } })
  await settle()
}

async function press(name: string): Promise<void> {
  fireEvent.click(screen.getByRole('button', { name }))
  await settle()
}

function field(label: string): HTMLInputElement {
  return screen.getByLabelText(label) as HTMLInputElement
}

beforeEach(() => {
  storage = new MemoryStorage()
  vi.stubGlobal('localStorage', storage)
})

afterEach(() => {
  cleanup()
  for (const h of hubs) h.dispose()
  hubs = []
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('Settings › Import', () => {
  it('asks in the page before replacing, with both review counts, then saves the file', async () => {
    storage.setItem(STORAGE_KEY, JSON.stringify(progressWith(1)))
    const confirm = vi.spyOn(window, 'confirm')
    render(<Settings engine={hub()} today={TODAY} />)

    await pickFile(JSON.stringify(progressWith(3)))
    expect(confirm).not.toHaveBeenCalled()
    expect(screen.getByText(S.importConfirm(3, 1))).toBeTruthy()
    expect(Object.keys(stored()!.reviews)).toHaveLength(1)

    await press(S.importReplace)
    expect(Object.keys(stored()!.reviews)).toHaveLength(3)
    expect(screen.getByText(S.imported(3))).toBeTruthy()
    expect(screen.queryByText(S.importConfirm(3, 1))).toBeNull()
  })

  it('keeps the current progress when the confirm is cancelled', async () => {
    storage.setItem(STORAGE_KEY, JSON.stringify(progressWith(1)))
    render(<Settings engine={hub()} today={TODAY} />)
    await pickFile(JSON.stringify(progressWith(3)))
    await press(S.cancel)
    expect(Object.keys(stored()!.reviews)).toHaveLength(1)
    expect(screen.queryByText(S.importConfirm(3, 1))).toBeNull()
  })

  it('shows the error for a file that is not Go-to-D progress, and changes nothing', async () => {
    storage.setItem(STORAGE_KEY, JSON.stringify(progressWith(2)))
    const before = storage.getItem(STORAGE_KEY)
    render(<Settings engine={hub()} today={TODAY} />)

    await pickFile('{"hello": "world"}', 'notes.json')
    expect(screen.getByRole('alert').textContent).toBe(S.importBad('Not a Go-to-D progress file'))
    expect(screen.queryByRole('button', { name: S.importReplace })).toBeNull()
    expect(storage.getItem(STORAGE_KEY)).toBe(before)

    await pickFile('this is not json')
    expect(screen.getByRole('alert').textContent).toBe(S.importBad('Not a Go-to-D progress file'))
    expect(storage.getItem(STORAGE_KEY)).toBe(before)
  })

  it('says so when the browser will not save the import', async () => {
    storage.setItem(STORAGE_KEY, JSON.stringify(progressWith(1)))
    render(<Settings engine={hub()} today={TODAY} />)
    await pickFile(JSON.stringify(progressWith(3)))
    storage.failWrites = true
    await press(S.importReplace)
    expect(screen.getByRole('alert').textContent).toBe(S.importSaveFailed)
    expect(Object.keys(stored()!.reviews)).toHaveLength(1)
  })
})

describe('Settings › Export', () => {
  it('downloads the progress as go-to-d-progress-<day>.json', async () => {
    storage.setItem(STORAGE_KEY, JSON.stringify(progressWith(2)))
    const blobs: Blob[] = []
    // jsdom has no object URLs; put stand-ins on URL for this test only.
    const u = URL as unknown as Record<string, unknown>
    const had = { create: u.createObjectURL, revoke: u.revokeObjectURL }
    u.createObjectURL = (b: Blob) => {
      blobs.push(b)
      return 'blob:go-to-d/1'
    }
    u.revokeObjectURL = () => {}
    const names: string[] = []
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      names.push(this.download)
    })
    try {
      render(<Settings engine={hub()} today={TODAY} />)
      await press(S.export)
      expect(names).toEqual(['go-to-d-progress-2026-10-22.json'])
      const saved = JSON.parse(await blobs[0].text()) as Progress
      expect(Object.keys(saved.reviews)).toHaveLength(2)
    } finally {
      u.createObjectURL = had.create
      u.revokeObjectURL = had.revoke
    }
  })
})

describe('Settings › Reset', () => {
  it('clears reviews and streak after an in-page confirm, and keeps the settings', async () => {
    const p = progressWith(3)
    p.settings.visits = 200
    storage.setItem(STORAGE_KEY, JSON.stringify(p))
    const confirm = vi.spyOn(window, 'confirm')
    render(<Settings engine={hub()} today={TODAY} />)

    await press(S.reset)
    expect(confirm).not.toHaveBeenCalled()
    expect(Object.keys(stored()!.reviews)).toHaveLength(3)
    await press(S.resetYes)
    expect(stored()!.reviews).toEqual({})
    expect(stored()!.streak).toEqual({ count: 0, lastDay: null })
    expect(stored()!.settings.visits).toBe(200)
    expect(screen.getByText(S.resetDone)).toBeTruthy()
  })
})

describe('Settings › Teacher', () => {
  it('saves thresholds, visits and new per day', async () => {
    render(<Settings engine={hub()} today={TODAY} />)
    fireEvent.change(field(S.fine), { target: { value: '1' } })
    fireEvent.change(field(S.big), { target: { value: '3.5' } })
    fireEvent.change(field(S.visits), { target: { value: '200' } })
    fireEvent.change(field(S.newPerDay), { target: { value: '3' } })
    await press(S.save)
    expect(loadProgress().settings).toMatchObject({ thresholds: { fine: 1, big: 3.5 }, visits: 200, newPerDay: 3 })
    expect(screen.getByText(S.saved)).toBeTruthy()
  })

  it('refuses fine at or above big, and visits outside 16 to 400', async () => {
    render(<Settings engine={hub()} today={TODAY} />)
    fireEvent.change(field(S.fine), { target: { value: '4' } })
    fireEvent.change(field(S.big), { target: { value: '4' } })
    await press(S.save)
    expect(screen.getByRole('alert').textContent).toBe(S.fineBelowBig)
    expect(stored()).toBeNull()

    fireEvent.change(field(S.fine), { target: { value: '1.5' } })
    fireEvent.change(field(S.visits), { target: { value: '8' } })
    await press(S.save)
    expect(screen.getByRole('alert').textContent).toBe(S.visitsRange)
    expect(stored()).toBeNull()
  })
})

describe('Settings › Engine', () => {
  it('shows the backend and network once the engine is ready', async () => {
    render(<Settings engine={hub('ready')} today={TODAY} />)
    await settle()
    expect(screen.getByText('fake')).toBeTruthy()
    expect(screen.getByText('fake-net')).toBeTruthy()
  })
})
