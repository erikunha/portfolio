import { it as vitestIt } from 'vitest';

const runningTestBodies = new Set<Promise<unknown>>();

export function trackTestBody<Args extends unknown[]>(body: (...args: Args) => unknown) {
  return (...args: Args): Promise<unknown> => {
    const running = Promise.resolve(body(...args));
    runningTestBodies.add(running);
    const release = () => runningTestBodies.delete(running);
    running.then(release, release);
    return running;
  };
}

export async function settleTestBodies(): Promise<void> {
  await Promise.allSettled([...runningTestBodies]);
}

type Callable = (...args: never[]) => unknown;

function trackEachBodies<Each extends Callable>(each: Each): Each {
  return new Proxy(each, {
    apply(target, thisArg, [name, body, ...rest]) {
      return Reflect.apply(target, thisArg, [name, trackTestBody(body), ...rest]);
    },
  });
}

export const it = new Proxy(vitestIt, {
  apply(target, thisArg, [name, body, ...rest]) {
    return Reflect.apply(target, thisArg, [name, trackTestBody(body), ...rest]);
  },
  get(target, property) {
    const value = Reflect.get(target, property, target);
    if (property !== 'each') return value;
    return (...table: unknown[]) =>
      trackEachBodies(Reflect.apply(value, target, table) as Callable);
  },
});
