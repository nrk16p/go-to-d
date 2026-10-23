// The first visit's warm-up: once the engine is ready and the page is controlled, the network is asked
// for again through the service worker, unless it is already cached. It never throws.

import { afterEach, describe, expect, it, vi } from 'vitest'
import { warmEngineCache } from '../../src/ui/warmCache'

const URL_ = '/go-to-d/models/net.bin.gz'

function setup(opts: { controlled?: boolean; cached?: boolean; sw?: boolean; fetchFails?: boolean } = {}) {
  const sw = Object.assign(new EventTarget(), { controller: opts.controlled ? {} : null })
  vi.stubGlobal('navigator', opts.sw === false ? {} : { serviceWorker: sw })
  vi.stubGlobal('caches', { match: vi.fn(async () => (opts.cached ? new Response('x') : undefined)) })
  const read = vi.fn(async () => new ArrayBuffer(1))
  const fetchMock = vi.fn(async () => {
    if (opts.fetchFails) throw new TypeError('offline')
    return { arrayBuffer: read } as unknown as Response
  })
  vi.stubGlobal('fetch', fetchMock)
  return { sw, fetchMock, read }
}

const ready = { ready: () => Promise.resolve({ backend: 'wasm' }) }
const tick = () => new Promise((r) => setTimeout(r, 0))

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('warmEngineCache', () => {
  it('fetches the network through the service worker when the page is already controlled', async () => {
    const { fetchMock, read } = setup({ controlled: true })
    await warmEngineCache(ready, URL_)
    expect(fetchMock).toHaveBeenCalledWith(URL_)
    expect(read).toHaveBeenCalled()
  })

  it('waits for the service worker to take control first', async () => {
    const { sw, fetchMock } = setup({ controlled: false })
    const done = warmEngineCache(ready, URL_)
    await tick()
    expect(fetchMock).not.toHaveBeenCalled()
    sw.dispatchEvent(new Event('controllerchange'))
    await done
    expect(fetchMock).toHaveBeenCalledWith(URL_)
  })

  it('does nothing when the network is already cached', async () => {
    const { fetchMock } = setup({ controlled: true, cached: true })
    await warmEngineCache(ready, URL_)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('does nothing when the engine never loads, or without a service worker', async () => {
    const a = setup({ controlled: true })
    await warmEngineCache({ ready: () => Promise.reject(new Error('no engine')) }, URL_)
    expect(a.fetchMock).not.toHaveBeenCalled()

    const b = setup({ sw: false })
    await warmEngineCache(ready, URL_)
    expect(b.fetchMock).not.toHaveBeenCalled()
  })

  it('swallows a failed fetch', async () => {
    const { fetchMock } = setup({ controlled: true, fetchFails: true })
    await expect(warmEngineCache(ready, URL_)).resolves.toBeUndefined()
    expect(fetchMock).toHaveBeenCalled()
  })
})
