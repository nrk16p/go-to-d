// Hash routes, and what the Spar route makes of its parameters (R28), good and bad.

import { describe, expect, it } from 'vitest'
import { BOOK } from '../../src/book/data'
import { defaultProgress } from '../../src/progress/store'
import { COPY } from '../../src/ui/copy'
import { parseRoute, sparHref } from '../../src/ui/router'
import { resolveSpar } from '../../src/ui/sparSetup'

describe('parseRoute', () => {
  it('names each screen', () => {
    expect(parseRoute('')).toEqual({ name: 'today' })
    expect(parseRoute('#/')).toEqual({ name: 'today' })
    expect(parseRoute('#/report')).toEqual({ name: 'report' })
    expect(parseRoute('#/library/')).toEqual({ name: 'library' })
    expect(parseRoute('#/settings')).toEqual({ name: 'settings' })
    expect(parseRoute('#/pattern/star44-low-jump')).toEqual({ name: 'pattern', id: 'star44-low-jump' })
  })

  it('keeps the spar parameters as given, dropping unknown and empty ones', () => {
    expect(parseRoute('#/spar?family=star44&side=defend&junk=1&pattern=')).toEqual({
      name: 'spar',
      params: { family: 'star44', side: 'defend' },
    })
    expect(parseRoute('#/spar?sym=9&side=up&family=x&pattern=nope&seed=-4')).toEqual({
      name: 'spar',
      params: { sym: '9', side: 'up', family: 'x', pattern: 'nope', seed: '-4' },
    })
  })

  it('sends anything else to not-found, including a broken escape', () => {
    expect(parseRoute('#/nowhere')).toMatchObject({ name: 'not-found' })
    expect(parseRoute('#/pattern/%E0%A4')).toMatchObject({ name: 'not-found' })
    expect(parseRoute('#spar')).toMatchObject({ name: 'not-found' })
  })

  it('round-trips a spar link', () => {
    const params = { family: 'star44', pattern: 'star44-low-jump', side: 'attack' }
    expect(parseRoute(sparHref(params))).toEqual({ name: 'spar', params })
  })
})

describe('resolveSpar', () => {
  const progress = defaultProgress()
  const fixed = () => 0.5

  it('ignores a bad sym, seed or side and picks the defaults', () => {
    const r = resolveSpar({ pattern: 'star44-low-jump', sym: '9', seed: 'x', side: 'up' }, BOOK, progress, fixed)
    expect(r).toMatchObject({ ok: true, config: { mode: 'drill', side: 'defend', sym: 4, seed: 0x80000000 } })
    const neg = resolveSpar({ pattern: 'star44-low-jump', sym: '-1' }, BOOK, progress, () => 0.99)
    expect(neg.ok && neg.config.sym).toBe(7)
  })

  it('keeps a good sym and seed', () => {
    const r = resolveSpar({ pattern: 'star44-low-jump', sym: '3', seed: '42', side: 'attack' }, BOOK, progress, fixed)
    expect(r).toMatchObject({ ok: true, config: { sym: 3, seed: 42, side: 'attack' } })
  })

  it('refuses an unknown pattern or family', () => {
    expect(resolveSpar({ pattern: 'nope' }, BOOK, progress)).toEqual({ ok: false, error: COPY.spar.unknownPattern('nope') })
    expect(resolveSpar({ family: 'x' }, BOOK, progress)).toEqual({ ok: false, error: COPY.spar.unknownFamily })
    expect(resolveSpar({}, BOOK, progress)).toEqual({ ok: false, error: COPY.spar.unknownFamily })
    expect(resolveSpar({ family: '__proto__' }, BOOK, progress)).toEqual({ ok: false, error: COPY.spar.unknownFamily })
  })

  it('takes the family from the pattern when the two disagree', () => {
    const r = resolveSpar({ family: 'komoku34', pattern: 'star44-low-jump' }, BOOK, progress, fixed)
    expect(r).toMatchObject({ ok: true, config: { family: 'star44', patternId: 'star44-low-jump' } })
  })

  it('drills a one-sided pattern from the side it has', () => {
    const r = resolveSpar({ pattern: 'invade33-cut-trick', side: 'attack' }, BOOK, progress, fixed)
    expect(r).toMatchObject({ ok: true, config: { side: 'defend' } })
  })

  it('is free sparring without a pattern, or with mode=free', () => {
    expect(resolveSpar({ family: 'star44' }, BOOK, progress, fixed)).toMatchObject({ ok: true, config: { mode: 'free' } })
    const r = resolveSpar({ pattern: 'star44-low-jump', mode: 'free' }, BOOK, progress, fixed)
    expect(r).toMatchObject({ ok: true, config: { mode: 'free', family: 'star44' } })
    expect(r.ok && r.config.patternId).toBeUndefined()
  })

  it('steers free sparring toward the family’s missed positions on that side', () => {
    const p = defaultProgress()
    p.reviews['star44-low-jump:defend'] = { box: 1, due: '2026-10-23', runs: 1, cleanRuns: 0, missedKeys: ['W:R14/B:O16'] }
    p.reviews['star44-low-jump:attack'] = { box: 1, due: '2026-10-23', runs: 1, cleanRuns: 0, missedKeys: ['W:R14'] }
    p.reviews['invade33-stand:defend'] = { box: 1, due: '2026-10-23', runs: 1, cleanRuns: 0, missedKeys: ['W:R17'] }
    const r = resolveSpar({ family: 'star44', side: 'defend' }, BOOK, p, fixed)
    expect(r.ok && [...r.config.missed]).toEqual(['W:R14/B:O16'])
  })
})
