export type NavigationSnapshot = {
  currentId: string;
  drawerOpen: boolean;
  motionOn: boolean;
};

export type NavigationStore = {
  initial: NavigationSnapshot;
  get: () => NavigationSnapshot;
  set: (patch: Partial<NavigationSnapshot>) => void;
  subscribe: (listener: () => void) => () => void;
};

export function createNavigationStore(initial: NavigationSnapshot): NavigationStore {
  let state = initial;
  const listeners = new Set<() => void>();
  return {
    initial,
    get: () => state,
    set: (patch) => {
      const changed = (Object.keys(patch) as (keyof NavigationSnapshot)[]).some(
        (key) => patch[key] !== state[key],
      );
      if (!changed) return;
      state = { ...state, ...patch };
      for (const listener of listeners) listener();
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
