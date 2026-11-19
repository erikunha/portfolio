type Spy = (...args: unknown[]) => unknown;

interface CounterSpies {
  incr: Spy;
  expire: Spy;
  exec: Spy;
}

interface LogRedisSpies {
  set: Spy;
  counter?: CounterSpies;
  multi?: Spy;
}

const INDEX_WRITE_RESULT = 1;

export function logRedis({ set, counter, multi }: LogRedisSpies) {
  return {
    set,
    multi: () => {
      multi?.();
      let stored: Promise<unknown> | undefined;
      const tx = {
        set: (...args: unknown[]) => {
          if (!stored) stored = Promise.resolve(set(...args));
          return tx;
        },
        sadd: () => tx,
        incr: (...args: unknown[]) => {
          counter?.incr(...args);
          return tx;
        },
        expire: (...args: unknown[]) => {
          if (!stored) counter?.expire(...args);
          return tx;
        },
        exec: async () => {
          if (stored)
            return [await stored, INDEX_WRITE_RESULT, INDEX_WRITE_RESULT, INDEX_WRITE_RESULT];
          return (await counter?.exec()) ?? [];
        },
      };
      return tx;
    },
  };
}
