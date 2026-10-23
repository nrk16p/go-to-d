// Node 25 has a localStorage of its own that shadows jsdom's; screen tests stub in this plain one.

export class MemoryStorage {
  private m = new Map<string, string>()
  /** When set, setItem throws, as a full or blocked storage does. */
  failWrites = false

  get length() {
    return this.m.size
  }
  key(i: number) {
    return [...this.m.keys()][i] ?? null
  }
  getItem(k: string) {
    return this.m.get(k) ?? null
  }
  setItem(k: string, v: string) {
    if (this.failWrites) throw new Error('QuotaExceededError')
    this.m.set(k, String(v))
  }
  removeItem(k: string) {
    this.m.delete(k)
  }
  clear() {
    this.m.clear()
  }
}
