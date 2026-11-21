export type Listener<T> = (value: T) => void;

export type Listeners<T> = {
  subscribe: (listener: Listener<T>) => () => void;
  notify: (value: T) => void;
  size: () => number;
};

export function createListeners<T = void>(): Listeners<T> {
  const set = new Set<Listener<T>>();
  return {
    subscribe: (listener) => {
      set.add(listener);
      return () => {
        set.delete(listener);
      };
    },
    notify: (value: T) => {
      for (const listener of set) listener(value);
    },
    size: () => set.size,
  };
}
