// A page whose visibility a test sets, for the deadlines and the engine hub (R41).

import type { PageVisibility } from '../../src/engine/deadline'

/** A page whose visibility the test sets. `quiet` changes it without telling anyone (a missed event). */
export class FakeVisibility implements PageVisibility {
  isHidden = false
  private readonly fns = new Set<() => void>()
  hidden(): boolean {
    return this.isHidden
  }
  onChange(fn: () => void): () => void {
    this.fns.add(fn)
    return () => this.fns.delete(fn)
  }
  set(hidden: boolean, quiet = false): void {
    this.isHidden = hidden
    if (!quiet) for (const fn of [...this.fns]) fn()
  }
  get listeners(): number {
    return this.fns.size
  }
}
