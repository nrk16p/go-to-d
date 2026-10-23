// Settings: how strict the teacher is, what the engine runs on, and the backup. Progress lives only in
// this browser, so Export and Import are the safety net. Import and Reset ask in the page first
// (never window.confirm), and nothing is replaced until the owner says so.

import { useEffect, useRef, useState, useSyncExternalStore, type ChangeEvent, type FormEvent } from 'react'
import type { Progress, Settings as SettingsData } from '../../progress/srs'
import { defaultProgress, exportProgress, importProgress, loadProgress, saveProgress, todayLocal } from '../../progress/store'
import { COPY } from '../copy'
import { EngineChip } from '../EngineChip'
import type { EngineHub } from '../engine'

const S = COPY.settings

const VISITS_MIN = 16
const VISITS_MAX = 400
const NEW_PER_DAY_MAX = 10

type Message = { error: boolean; text: string } | null

function MessageLine({ msg }: { msg: Message }) {
  if (!msg) return null
  return msg.error ? (
    <p className="form-msg is-error" role="alert">
      {msg.text}
    </p>
  ) : (
    <p className="form-msg" role="status">
      {msg.text}
    </p>
  )
}

export function Settings({ engine, today = todayLocal() }: { engine: EngineHub; today?: string }) {
  // Bumped after an import or a reset, so the teacher form shows what is saved now.
  const [version, setVersion] = useState(0)
  const [settings, setSettings] = useState(() => loadProgress().settings)

  function reloaded() {
    setSettings(loadProgress().settings)
    setVersion((v) => v + 1)
  }

  return (
    <section className="page settings">
      <header className="page-head">
        <h1>{S.title}</h1>
      </header>
      <TeacherForm key={version} initial={settings} />
      <EngineInfo engine={engine} />
      <Backup today={today} onReplaced={reloaded} />
      <Reset onCleared={reloaded} />
    </section>
  )
}

// ---------- teacher ----------

const num = (s: string) => (s.trim() === '' ? NaN : Number(s))

function readForm(f: { fine: string; big: string; visits: string; newPerDay: string }):
  | { ok: true; values: Pick<SettingsData, 'thresholds' | 'visits' | 'newPerDay'> }
  | { ok: false; error: string } {
  const fine = num(f.fine)
  const big = num(f.big)
  const visits = num(f.visits)
  const newPerDay = num(f.newPerDay)
  if (![fine, big, visits, newPerDay].every(Number.isFinite)) return { ok: false, error: S.notNumber }
  if (fine < 0 || fine >= big) return { ok: false, error: S.fineBelowBig }
  if (!Number.isInteger(visits) || visits < VISITS_MIN || visits > VISITS_MAX) return { ok: false, error: S.visitsRange }
  if (!Number.isInteger(newPerDay) || newPerDay < 0 || newPerDay > NEW_PER_DAY_MAX) return { ok: false, error: S.newRange }
  return { ok: true, values: { thresholds: { fine, big }, visits, newPerDay } }
}

function TeacherForm({ initial }: { initial: SettingsData }) {
  const [form, setForm] = useState({
    fine: String(initial.thresholds.fine),
    big: String(initial.thresholds.big),
    visits: String(initial.visits),
    newPerDay: String(initial.newPerDay),
  })
  const [msg, setMsg] = useState<Message>(null)

  const set = (k: keyof typeof form) => (e: ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [k]: e.target.value })
    setMsg(null)
  }

  function save(e: FormEvent) {
    e.preventDefault()
    const r = readForm(form)
    if (!r.ok) {
      setMsg({ error: true, text: r.error })
      return
    }
    const p = loadProgress()
    const ok = saveProgress({ ...p, settings: { ...p.settings, ...r.values } })
    setMsg(ok ? { error: false, text: S.saved } : { error: true, text: S.saveFailed })
  }

  return (
    <section className="settings-group" aria-labelledby="teacher-title">
      <h2 id="teacher-title">{S.teacherTitle}</h2>
      <form className="fields" onSubmit={save} noValidate>
        <div className="field">
          <label htmlFor="set-fine">{S.fine}</label>
          <div className="input-row">
            <input id="set-fine" type="number" inputMode="decimal" step="0.5" min="0" value={form.fine} onChange={set('fine')} aria-describedby="set-fine-unit set-fine-help" />
            <span id="set-fine-unit">{S.pointsLost}</span>
          </div>
          <p id="set-fine-help" className="help">
            {S.fineHelp}
          </p>
        </div>
        <div className="field">
          <label htmlFor="set-big">{S.big}</label>
          <div className="input-row">
            <input id="set-big" type="number" inputMode="decimal" step="0.5" min="0" value={form.big} onChange={set('big')} aria-describedby="set-big-unit" />
            <span id="set-big-unit">{S.pointsLost}</span>
          </div>
        </div>
        <div className="field">
          <label htmlFor="set-visits">{S.visits}</label>
          <div className="input-row">
            <input id="set-visits" type="number" inputMode="numeric" step="1" min={VISITS_MIN} max={VISITS_MAX} value={form.visits} onChange={set('visits')} aria-describedby="set-visits-help" />
          </div>
          <p id="set-visits-help" className="help">
            {S.visitsHelp}
          </p>
        </div>
        <div className="field">
          <label htmlFor="set-new">{S.newPerDay}</label>
          <div className="input-row">
            <input id="set-new" type="number" inputMode="numeric" step="1" min="0" max={NEW_PER_DAY_MAX} value={form.newPerDay} onChange={set('newPerDay')} />
          </div>
        </div>
        <div className="actions">
          <button type="submit" className="btn btn-primary">
            {S.save}
          </button>
        </div>
        <MessageLine msg={msg} />
      </form>
    </section>
  )
}

// ---------- engine ----------

function EngineInfo({ engine }: { engine: EngineHub }) {
  const status = useSyncExternalStore(engine.subscribe, engine.snapshot)
  const [info, setInfo] = useState<{ backend: string; model: string } | null>(null)

  useEffect(() => {
    if (status !== 'ready') return
    let live = true
    engine.ready().then(
      (i) => {
        if (live) setInfo(i)
      },
      () => {},
    )
    return () => {
      live = false
    }
  }, [engine, status])

  return (
    <section className="settings-group" aria-labelledby="engine-title">
      <h2 id="engine-title">{S.engineTitle}</h2>
      <EngineChip engine={engine} />
      {status === 'failed' && <p className="help">{COPY.engine.offHelp}</p>}
      {status === 'ready' && info && (
        <dl className="facts">
          <div>
            <dt>{S.backend}</dt>
            <dd>{S.backendName(info.backend)}</dd>
          </div>
          <div>
            <dt>{S.model}</dt>
            <dd>{info.model}</dd>
          </div>
        </dl>
      )}
    </section>
  )
}

// ---------- backup ----------

function download(name: string, text: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }))
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

function readText(file: File): Promise<string> {
  if (typeof file.text === 'function') return file.text()
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result))
    r.onerror = () => reject(r.error ?? new Error('read failed'))
    r.readAsText(file)
  })
}

type ImportState = { kind: 'idle' } | { kind: 'confirm'; file: Progress; now: number } | { kind: 'said'; msg: Message }

function Backup({ today, onReplaced }: { today: string; onReplaced: () => void }) {
  const [state, setState] = useState<ImportState>({ kind: 'idle' })
  const confirmRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (state.kind === 'confirm') confirmRef.current?.focus()
  }, [state.kind])

  async function picked(e: ChangeEvent<HTMLInputElement>) {
    const input = e.target
    const file = input.files?.[0]
    if (!file) return
    let text: string
    try {
      text = await readText(file)
    } catch {
      setState({ kind: 'said', msg: { error: true, text: S.importUnreadable } })
      return
    } finally {
      // The same file can be picked again later.
      input.value = ''
    }
    try {
      const p = importProgress(text)
      setState({ kind: 'confirm', file: p, now: Object.keys(loadProgress().reviews).length })
    } catch (err) {
      setState({ kind: 'said', msg: { error: true, text: S.importBad(err instanceof Error ? err.message : String(err)) } })
    }
  }

  function replace(p: Progress) {
    if (saveProgress(p)) {
      setState({ kind: 'said', msg: { error: false, text: S.imported(Object.keys(p.reviews).length) } })
      onReplaced()
    } else {
      setState({ kind: 'said', msg: { error: true, text: S.importSaveFailed } })
    }
  }

  return (
    <section className="settings-group" aria-labelledby="backup-title">
      <h2 id="backup-title">{S.backupTitle}</h2>
      <p className="help">{S.backupBody}</p>
      <div className="actions">
        <button type="button" className="btn" onClick={() => download(`go-to-d-progress-${today}.json`, exportProgress(loadProgress()))}>
          {S.export}
        </button>
        <label className="btn file-btn">
          <input type="file" accept=".json,application/json" className="visually-hidden" onChange={picked} />
          {S.import}
        </label>
      </div>
      {state.kind === 'confirm' && (
        <div className="confirm" ref={confirmRef} tabIndex={-1} role="group" aria-labelledby="import-question">
          <p id="import-question">{S.importConfirm(Object.keys(state.file.reviews).length, state.now)}</p>
          <div className="actions">
            <button type="button" className="btn btn-primary" onClick={() => replace(state.file)}>
              {S.importReplace}
            </button>
            <button type="button" className="btn" onClick={() => setState({ kind: 'idle' })}>
              {S.cancel}
            </button>
          </div>
        </div>
      )}
      {state.kind === 'said' && <MessageLine msg={state.msg} />}
    </section>
  )
}

// ---------- reset ----------

type ResetState = { kind: 'idle' } | { kind: 'confirm'; now: number } | { kind: 'said'; msg: Message }

function Reset({ onCleared }: { onCleared: () => void }) {
  const [state, setState] = useState<ResetState>({ kind: 'idle' })
  const confirmRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (state.kind === 'confirm') confirmRef.current?.focus()
  }, [state.kind])

  function clear() {
    const p = loadProgress()
    if (saveProgress({ ...defaultProgress(), settings: p.settings })) {
      setState({ kind: 'said', msg: { error: false, text: S.resetDone } })
      onCleared()
    } else {
      setState({ kind: 'said', msg: { error: true, text: S.resetFailed } })
    }
  }

  return (
    <section className="settings-group" aria-labelledby="reset-title">
      <h2 id="reset-title">{S.resetTitle}</h2>
      <p className="help">{S.resetBody}</p>
      {state.kind === 'confirm' ? (
        <div className="confirm" ref={confirmRef} tabIndex={-1} role="group" aria-labelledby="reset-question">
          <p id="reset-question">{S.resetConfirm(state.now)}</p>
          <div className="actions">
            <button type="button" className="btn btn-danger" onClick={clear}>
              {S.resetYes}
            </button>
            <button type="button" className="btn" onClick={() => setState({ kind: 'idle' })}>
              {S.cancel}
            </button>
          </div>
        </div>
      ) : (
        <div className="actions">
          <button
            type="button"
            className="btn"
            onClick={() => setState({ kind: 'confirm', now: Object.keys(loadProgress().reviews).length })}
          >
            {S.reset}
          </button>
        </div>
      )}
      {state.kind === 'said' && <MessageLine msg={state.msg} />}
    </section>
  )
}
