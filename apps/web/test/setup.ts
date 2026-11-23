/**
 * Node 22 and newer expose their own experimental `localStorage` global, which
 * shadows the one jsdom would install and is empty unless the process is
 * started with --localstorage-file. The app reads the bare global, so tests get
 * a deterministic in-memory Storage instead.
 */
class MemoryStorage implements Storage {
  private store = new Map<string, string>();

  get length(): number {
    return this.store.size;
  }

  clear(): void {
    this.store.clear();
  }

  getItem(key: string): string | null {
    return this.store.has(key) ? (this.store.get(key) as string) : null;
  }

  key(index: number): string | null {
    return [...this.store.keys()][index] ?? null;
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }

  setItem(key: string, value: string): void {
    this.store.set(String(key), String(value));
  }
}

function install(name: 'localStorage' | 'sessionStorage'): void {
  const storage = new MemoryStorage();
  for (const target of [globalThis, typeof window === 'undefined' ? undefined : window]) {
    if (!target) continue;
    try {
      Object.defineProperty(target, name, { value: storage, configurable: true, writable: true });
    } catch {
      (target as unknown as Record<string, Storage>)[name] = storage;
    }
  }
}

if (!globalThis.localStorage) install('localStorage');
if (!globalThis.sessionStorage) install('sessionStorage');
