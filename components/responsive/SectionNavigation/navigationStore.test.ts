import { describe, expect, it, vi } from 'vitest';
import { createNavigationStore } from './navigationStore';

const INITIAL = { currentId: 'bio', drawerOpen: false, motionOn: true };

describe('createNavigationStore', () => {
  it('keeps the same snapshot object when a patch changes nothing and does not notify', () => {
    const store = createNavigationStore(INITIAL);
    const listener = vi.fn();
    store.subscribe(listener);
    const before = store.get();
    store.set({ currentId: 'bio', drawerOpen: false });
    expect(store.get(), 'a no-op patch must not produce a new snapshot').toBe(before);
    expect(listener).not.toHaveBeenCalled();
  });

  it('replaces the snapshot and notifies once per change, leaving the initial one intact', () => {
    const store = createNavigationStore(INITIAL);
    const listener = vi.fn();
    store.subscribe(listener);
    store.set({ currentId: 'sec-contact', drawerOpen: true });
    expect(store.get()).toEqual({ ...INITIAL, currentId: 'sec-contact', drawerOpen: true });
    expect(listener).toHaveBeenCalledTimes(1);
    expect(store.initial, 'the server snapshot must never move').toBe(INITIAL);
  });

  it('stops notifying a listener after it unsubscribes', () => {
    const store = createNavigationStore(INITIAL);
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);
    unsubscribe();
    store.set({ motionOn: false });
    expect(listener).not.toHaveBeenCalled();
  });
});
