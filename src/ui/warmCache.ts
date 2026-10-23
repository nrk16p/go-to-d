// Puts the engine's network into the service worker's cache on the very first visit, so the engine
// works offline from then on (not only from the second visit). TF.js's .wasm files don't need this:
// the service worker precaches them (vite.config.ts).
//
// The engine starts loading before the service worker controls the page, so its first fetch of the
// network goes straight to the network and nothing is cached. Once the engine has loaded and the page
// is controlled, this asks for the same file again through the service worker. It usually comes from
// the browser's HTTP cache, so nothing downloads twice. Nothing happens when it is already cached.

import { MODEL_URL } from '../engine/model'

async function warm(url: string): Promise<void> {
  if (await caches.match(url)) return
  const res = await fetch(url)
  // Reading the body lets the service worker finish storing its copy.
  await res.arrayBuffer()
}

/** Returns a promise for tests; the app ignores it. It never rejects. */
export function warmEngineCache(engine: { ready(): Promise<unknown> }, url: string = MODEL_URL): Promise<void> {
  return new Promise<void>((resolve) => {
    try {
      const sw = navigator.serviceWorker
      if (!sw || typeof caches === 'undefined') return resolve()
      engine.ready().then(
        () => {
          const go = () => warm(url).catch(() => {}).then(resolve)
          if (sw.controller) go()
          else sw.addEventListener('controllerchange', go, { once: true })
        },
        () => resolve(),
      )
    } catch {
      // No service worker here (private mode, old browser): the network just isn't cached.
      resolve()
    }
  })
}
