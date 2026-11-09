import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const A = '11111111-1111-4111-8111-111111111111';
const B = '22222222-2222-4222-8222-222222222222';
const STORAGE_KEY = 'request-refs';

async function freshStore() {
  vi.resetModules();
  return import('./request-refs.client');
}

describe('request ref session store', () => {
  beforeEach(() => {
    window.sessionStorage.clear();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('adds refs in order, lists them, and returns the last one', async () => {
    const store = await freshStore();
    expect(store.listRefs()).toEqual([]);
    expect(store.lastRef()).toBeNull();
    store.addRef(A);
    store.addRef(B);
    expect(store.listRefs()).toEqual([A, B]);
    expect(store.lastRef()).toBe(B);
  });

  it('keeps a ref once and moves a re-added ref to the end', async () => {
    const store = await freshStore();
    store.addRef(A);
    store.addRef(B);
    store.addRef(A);
    expect(store.listRefs()).toEqual([B, A]);
  });

  it('caps the list and drops the oldest ref first', async () => {
    const store = await freshStore();
    const total = store.REQUEST_REF_LIMITS.maxRefs + 3;
    for (let i = 0; i < total; i++) store.addRef(`ref-${i}`);
    const refs = store.listRefs();
    expect(refs).toHaveLength(store.REQUEST_REF_LIMITS.maxRefs);
    expect(refs.at(-1)).toBe(`ref-${total - 1}`);
    expect(refs).not.toContain('ref-0');
  });

  it('removes one ref and clears all', async () => {
    const store = await freshStore();
    store.addRef(A);
    store.addRef(B);
    store.removeRef(A);
    expect(store.listRefs()).toEqual([B]);
    store.clearRefs();
    expect(store.listRefs()).toEqual([]);
  });

  it('survives a reload of the module within the same tab through sessionStorage only', async () => {
    const first = await freshStore();
    first.addRef(A);
    expect(window.sessionStorage.getItem(STORAGE_KEY)).toContain(A);
    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull();
    const second = await freshStore();
    expect(second.listRefs()).toEqual([A]);
  });

  it('ignores corrupt stored data instead of throwing', async () => {
    window.sessionStorage.setItem(STORAGE_KEY, '{not json');
    const store = await freshStore();
    expect(store.listRefs()).toEqual([]);
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify([A, 42, '', { a: 1 }]));
    const typed = await freshStore();
    expect(typed.listRefs()).toEqual([A]);
  });

  it('degrades to an in-memory list when sessionStorage throws on every access', async () => {
    vi.spyOn(window, 'sessionStorage', 'get').mockImplementation(() => {
      throw new DOMException('blocked', 'SecurityError');
    });
    const store = await freshStore();
    expect(() => store.addRef(A)).not.toThrow();
    expect(store.listRefs()).toEqual([A]);
    expect(store.lastRef()).toBe(A);
    store.removeRef(A);
    expect(store.listRefs()).toEqual([]);
  });

  it('degrades to memory when setItem throws (quota)', async () => {
    const store = await freshStore();
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('full', 'QuotaExceededError');
    });
    expect(() => store.addRef(A)).not.toThrow();
    expect(store.listRefs()).toEqual([A]);
  });

  it('notifies subscribers on every change and stops after unsubscribe', async () => {
    const store = await freshStore();
    const listener = vi.fn();
    const unsubscribe = store.subscribeRefs(listener);
    store.addRef(A);
    store.removeRef(A);
    expect(listener).toHaveBeenCalledTimes(2);
    unsubscribe();
    store.addRef(B);
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it('returns a stable snapshot until a write, so useSyncExternalStore does not loop', async () => {
    const store = await freshStore();
    store.addRef(A);
    expect(store.listRefs()).toBe(store.listRefs());
    const before = store.listRefs();
    store.addRef(B);
    expect(store.listRefs()).not.toBe(before);
  });
});
