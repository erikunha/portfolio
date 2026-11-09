import { vi } from 'vitest';

type Resolve = (query: string) => boolean;
type Initial = boolean | Record<string, boolean> | Resolve;

type ChangeListener = (event: MediaQueryListEvent) => void;

export type MatchMediaStub = {
  emit: (query: string, matches: boolean) => void;
  listenerCount: (query: string) => number;
  queries: () => string[];
  matchMedia: ReturnType<typeof vi.fn>;
};

function resolver(initial: Initial): Resolve {
  if (typeof initial === 'function') return initial;
  if (typeof initial === 'boolean') return () => initial;
  return (query) => initial[query] ?? false;
}

export function installMatchMedia(initial: Initial = false): MatchMediaStub {
  const resolve = resolver(initial);
  const state = new Map<string, boolean>();
  const listeners = new Map<string, Set<ChangeListener>>();
  const asked: string[] = [];

  const current = (query: string) => state.get(query) ?? resolve(query);
  const setFor = (query: string) => {
    let set = listeners.get(query);
    if (!set) {
      set = new Set();
      listeners.set(query, set);
    }
    return set;
  };

  const matchMedia = vi.fn((query: string) => {
    asked.push(query);
    const list = {
      media: query,
      onchange: null,
      get matches() {
        return current(query);
      },
      addEventListener: (type: string, cb: ChangeListener) => {
        if (type === 'change') setFor(query).add(cb);
      },
      removeEventListener: (type: string, cb: ChangeListener) => {
        if (type === 'change') setFor(query).delete(cb);
      },
      addListener: (cb: ChangeListener) => setFor(query).add(cb),
      removeListener: (cb: ChangeListener) => setFor(query).delete(cb),
      dispatchEvent: () => false,
    };
    return list as unknown as MediaQueryList;
  });

  vi.stubGlobal('matchMedia', matchMedia);

  return {
    matchMedia,
    queries: () => [...asked],
    listenerCount: (query) => listeners.get(query)?.size ?? 0,
    emit: (query, matches) => {
      state.set(query, matches);
      const event = { matches, media: query } as MediaQueryListEvent;
      for (const cb of [...setFor(query)]) cb(event);
    },
  };
}
