// The app's engine hub passes the owner's visits setting on to every search that doesn't name its own.

import { afterEach, describe, expect, it } from 'vitest'
import { CORNER_REGION } from '../../src/go/coords'
import { emptyPosition } from '../../src/go/rules'
import type { TeacherEngine } from '../../src/engine/teacher'
import { EngineHub } from '../../src/ui/engine'
import { FakeEngine } from '../session/fakeEngine'

class RecordingEngine extends FakeEngine {
  readonly opts: Array<{ visits?: number } | undefined> = []
  analyzeCorner(...args: Parameters<TeacherEngine['analyzeCorner']>) {
    this.opts.push(args[3])
    return super.analyzeCorner(args[0], args[1], args[2])
  }
  scoreFor(...args: Parameters<TeacherEngine['scoreFor']>) {
    this.opts.push(args[3])
    return super.scoreFor(args[0], args[1], args[2])
  }
}

let hubs: EngineHub[] = []
afterEach(() => {
  for (const h of hubs) h.dispose()
  hubs = []
})

describe('EngineHub visits', () => {
  it("fills in the visits setting, read at each call, and leaves a caller's own visits alone", async () => {
    const engine = new RecordingEngine()
    let visits = 64
    const h = new EngineHub(() => engine, { visits: () => visits }).start()
    hubs.push(h)
    const pos = emptyPosition()

    await h.analyzeCorner(pos, 7.5, CORNER_REGION)
    visits = 300
    await h.scoreFor(pos, 7.5, 'black')
    await h.analyzeCorner(pos, 7.5, CORNER_REGION, { visits: 20, maxTimeMs: 500 })
    expect(engine.opts).toEqual([{ visits: 64 }, { visits: 300 }, { visits: 20, maxTimeMs: 500 }])
  })

  it('passes nothing extra without a visits source', async () => {
    const engine = new RecordingEngine()
    const h = new EngineHub(() => engine).start()
    hubs.push(h)
    await h.analyzeCorner(emptyPosition(), 7.5, CORNER_REGION)
    expect(engine.opts).toEqual([undefined])
  })
})
