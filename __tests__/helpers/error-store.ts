type Operation = () => unknown;
type SetOptions = { ex?: number; nx?: boolean };
type SscanPage = () => [string, string[]];

const DONE_CURSOR = '0';

export function createErrorStore() {
  const values = new Map<string, unknown>();
  const members = new Map<string, Set<string>>();
  const ttls = new Map<string, number>();
  const pages: { sscan: SscanPage | undefined } = { sscan: undefined };

  const apply = (key: string, expireSeconds: number | undefined) => {
    if (expireSeconds !== undefined) ttls.set(key, expireSeconds);
  };

  const redis = () => ({
    sscan: async (key: string) => {
      if (pages.sscan) return pages.sscan();
      return [DONE_CURSOR, [...(members.get(key) ?? [])]] as [string, string[]];
    },
    mget: async (...keys: string[]) => keys.map((key) => values.get(key) ?? null),
    pipeline: () => ({ set: () => ({}), exec: async () => [] }),
    multi: () => {
      const operations: Operation[] = [];
      const tx = {
        set: (key: string, value: unknown, options?: SetOptions) => {
          operations.push(() => {
            if (options?.nx && values.has(key)) return null;
            values.set(key, value);
            apply(key, options?.ex);
            return 'OK';
          });
          return tx;
        },
        sadd: (key: string, member: string) => {
          operations.push(() => {
            const set = members.get(key) ?? new Set<string>();
            set.add(member);
            members.set(key, set);
            return 1;
          });
          return tx;
        },
        incr: (key: string) => {
          operations.push(() => {
            const next = Number(values.get(key) ?? 0) + 1;
            values.set(key, next);
            return next;
          });
          return tx;
        },
        expire: (key: string, seconds: number) => {
          operations.push(() => {
            apply(key, seconds);
            return 1;
          });
          return tx;
        },
        exec: async () => operations.map((operation) => operation()),
      };
      return tx;
    },
  });

  const reset = () => {
    values.clear();
    members.clear();
    ttls.clear();
    pages.sscan = undefined;
  };

  return { values, members, ttls, pages, redis, reset };
}
