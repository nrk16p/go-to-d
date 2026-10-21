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

// One request at a time: a search must not start while the model is still loading.
let queue: Promise<void> = Promise.resolve()

scope.onmessage = (ev) => {
  const msg = ev.data
  queue = queue.then(async () => scope.postMessage(await handle(msg)))
}
