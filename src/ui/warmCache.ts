// Puts the engine's files into the service worker's cache on the very first visit, so the engine works
// offline from then on (not only from the second visit).
//
// The engine starts loading before the service worker controls the page, so its first fetches go
// straight to the network and nothing is cached. Once the engine has loaded and the page is
// controlled, this asks for the same files again through the service worker. They usually come from
// the browser's HTTP cache, so nothing downloads twice. Files already cached are skipped.

import { MODEL_URL } from '../engine/model'

const TFJS = `${import.meta.env.BASE_URL}tfjs/`

/** WebAssembly SIMD, tested the way TF.js tests it: TF.js loads the -simd file when this validates. */
function hasWasmSimd(): boolean {
  try {
    return WebAssembly.validate(
      new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0, 1, 4, 1, 96, 0, 0, 3, 2, 1, 0, 10, 9, 1, 7, 0, 65, 0, 253, 15, 26, 11]),
    )
  } catch {
    return false
  }
}

/** The files an engine on `backend` fetched. */
export function engineFiles(backend: string, simd = hasWasmSimd()): string[] {
  if (backend !== 'wasm') return [MODEL_URL]
  return [MODEL_URL, `${TFJS}${simd ? 'tfjs-backend-wasm-simd.wasm' : 'tfjs-backend-wasm.wasm'}`]
}

async function warm(urls: string[]): Promise<void> {
  for (const url of urls) {
    if (await caches.match(url)) continue
    const res = await fetch(url)
    // Reading the body lets the service worker finish storing its copy.
    await res.arrayBuffer()
  }
}

export function warmEngineCache(engine: { ready(): Promise<{ backend: string }> }): void {
  try {
    const sw = navigator.serviceWorker
    if (!sw || typeof caches === 'undefined') return
    engine.ready().then(
      ({ backend }) => {
        const go = () => warm(engineFiles(backend)).catch(() => {})
        if (sw.controller) go()
        else sw.addEventListener('controllerchange', go, { once: true })
      },
      () => {},
    )
  } catch {
    // No service worker here (private mode, old browser): the engine just isn't cached.
  }
}
