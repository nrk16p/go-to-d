// Hash routes, so the app works from any folder on GitHub Pages:
//   #/                         Today
//   #/spar?family=&pattern=&side=&mode=&sym=&seed=&phase=   (phase=watch: watch the line first, R45)
//   #/report                   the last session's report
//   #/library   #/pattern/:id   #/settings

import { useSyncExternalStore } from 'react'

export type SparParams = Partial<Record<'family' | 'pattern' | 'side' | 'mode' | 'sym' | 'seed' | 'phase', string>>

export type Route =
  | { name: 'today' }
  | { name: 'spar'; params: SparParams }
  | { name: 'report' }
  | { name: 'library' }
  | { name: 'pattern'; id: string }
  | { name: 'settings' }
  | { name: 'not-found'; path: string }

const SPAR_KEYS = ['family', 'pattern', 'side', 'mode', 'sym', 'seed', 'phase'] as const

export function parseRoute(hash: string): Route {
  const raw = hash.replace(/^#/, '')
  const q = raw.indexOf('?')
  const path = (q < 0 ? raw : raw.slice(0, q)).replace(/\/+$/, '') || '/'
  const query = new URLSearchParams(q < 0 ? '' : raw.slice(q + 1))
  if (path === '/') return { name: 'today' }
  if (path === '/spar') {
    const params: SparParams = {}
    for (const k of SPAR_KEYS) {
      const v = query.get(k)
      if (v !== null && v !== '') params[k] = v
    }
    return { name: 'spar', params }
  }
  if (path === '/report') return { name: 'report' }
  if (path === '/library') return { name: 'library' }
  if (path === '/settings') return { name: 'settings' }
  const m = /^\/pattern\/([^/]+)$/.exec(path)
  if (m) {
    try {
      return { name: 'pattern', id: decodeURIComponent(m[1]) }
    } catch {
      return { name: 'not-found', path }
    }
  }
  return { name: 'not-found', path }
}

/** A link to a spar. Leave out sym and seed for a fresh orientation each time. */
export function sparHref(p: SparParams): string {
  const query = new URLSearchParams()
  for (const k of SPAR_KEYS) if (p[k] !== undefined) query.set(k, p[k]!)
  const s = query.toString()
  return `#/spar${s ? `?${s}` : ''}`
}

/** The Spar address asks to watch the line first (R45). Free sparring has no single line, so it never does. */
export function wantsWatch(p: SparParams): boolean {
  return p.phase === 'watch' && p.pattern !== undefined && p.mode !== 'free'
}

/**
 * A drill in one phase (R45): `watch` plays the line through first, `test` is the drill itself. Keeps the
 * family, pattern, side, sym and seed given, so watching and then testing happen on the same board.
 */
export function phaseHref(p: SparParams, phase: 'watch' | 'test'): string {
  const { family, pattern, side, sym, seed } = p
  return sparHref({ family, pattern, side, sym, seed, ...(phase === 'watch' ? { phase } : {}) })
}

export const href = {
  today: '#/',
  report: '#/report',
  library: '#/library',
  settings: '#/settings',
  pattern: (id: string) => `#/pattern/${encodeURIComponent(id)}`,
}

export function navigate(to: string): void {
  if (window.location.hash === to) return
  window.location.hash = to
}

/**
 * Changes the address bar without telling the app (no hashchange), so a reload lands on `to` but the
 * screen on show stays mounted. The router keeps its own copy of the hash for that reason.
 */
export function replaceQuietly(to: string): void {
  try {
    window.history.replaceState(window.history.state, '', to)
  } catch {
    // Some embedded browsers refuse; the address just stays as it was.
  }
}

let current = typeof window === 'undefined' ? '' : window.location.hash

function subscribe(fn: () => void): () => void {
  current = window.location.hash
  const on = () => {
    current = window.location.hash
    fn()
  }
  window.addEventListener('hashchange', on)
  return () => window.removeEventListener('hashchange', on)
}

/** The current hash, updated on hashchange only (see replaceQuietly). */
export function useHash(): string {
  return useSyncExternalStore(
    subscribe,
    () => current,
    () => '',
  )
}
