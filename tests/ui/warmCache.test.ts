// Which engine files the first visit puts in the offline cache.

import { describe, expect, it } from 'vitest'
import { MODEL_URL } from '../../src/engine/model'
import { engineFiles } from '../../src/ui/warmCache'

describe('engineFiles', () => {
  it('is the network alone on WebGPU or CPU, plus the .wasm file TF.js loads on WASM', () => {
    // The app is built under /go-to-d/; Vitest runs at /.
    const base = import.meta.env.BASE_URL
    expect(MODEL_URL).toBe(`${base}models/g170-b6c96-s175395328-d26788732.bin.gz`)
    expect(engineFiles('webgpu')).toEqual([MODEL_URL])
    expect(engineFiles('cpu')).toEqual([MODEL_URL])
    expect(engineFiles('wasm', true)).toEqual([MODEL_URL, `${base}tfjs/tfjs-backend-wasm-simd.wasm`])
    expect(engineFiles('wasm', false)).toEqual([MODEL_URL, `${base}tfjs/tfjs-backend-wasm.wasm`])
  })
})
