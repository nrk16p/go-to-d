// The teacher's Web Worker: loads the KataGo network once and runs searches one at a time.
// The engine code is vendored web-katrain (src/engine/katago/); this file is only the message pump.

import { analyzeKataGo, loadKataGoModel } from './katago/engine'
import { compactSearch, type WorkerRequest, type WorkerResponse } from './search'

const scope = self as unknown as {
  onmessage: ((ev: MessageEvent<WorkerRequest>) => void) | null
  postMessage(msg: WorkerResponse): void
}

function message(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}

async function handle(msg: WorkerRequest): Promise<WorkerResponse> {
  if (msg.type === 'load') {
    try {
      const info = await loadKataGoModel(msg.modelUrl, msg.backend)
      return { type: 'loaded', ok: true, backend: info.backend, model: info.modelName, note: info.backendNote }
    } catch (err) {
      return { type: 'loaded', ok: false, error: message(err) }
    }
  }
  try {
    return { type: 'searched', id: msg.id, ok: true, search: compactSearch(await analyzeKataGo(msg.req)) }
  } catch (err) {
    return { type: 'searched', id: msg.id, ok: false, error: message(err) }
  }
}

/** The error answer for a request whose real answer could not be posted. */
function failure(msg: WorkerRequest, err: unknown): WorkerResponse {
  const error = `The engine could not send its answer: ${message(err)}`
  return msg.type === 'load' ? { type: 'loaded', ok: false, error } : { type: 'searched', id: msg.id, ok: false, error }
}

// One request at a time: a search must not start while the model is still loading.
// The chain must never reject, or every later request would be skipped.
let queue: Promise<void> = Promise.resolve()

scope.onmessage = (ev) => {
  const msg = ev.data
  queue = queue
    .then(async () => {
      const answer = await handle(msg)
      try {
        scope.postMessage(answer)
      } catch (err) {
        scope.postMessage(failure(msg, err))
      }
    })
    .catch(() => {
      // Even the error answer could not be posted; the caller's deadline will give up on it.
    })
}
