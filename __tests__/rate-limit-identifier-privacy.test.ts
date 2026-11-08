// @vitest-environment node

import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const ADMITTING_PREFIXES = vi.hoisted(() => ({ 'rl:errlog': true, 'rl:errlog:ipday': true }));
const SHARED_DAILY_PREFIX = 'rl:errlog:day';
const SHARED_DAILY_KEY = 'global';

const recorded = vi.hoisted(() => ({
  limiterCalls: [] as { prefix: string; identifier: string }[],
  redisArgs: [] as unknown[],
}));

vi.mock('@upstash/ratelimit', () => {
  class Ratelimit {
    static slidingWindow = () => ({});
    static fixedWindow = () => ({});
    readonly prefix: string;
    constructor(opts: { prefix: string }) {
      this.prefix = opts.prefix;
    }
    async limit(identifier: string) {
      recorded.limiterCalls.push({ prefix: this.prefix, identifier });
      return { success: this.prefix in ADMITTING_PREFIXES, reset: Date.now() + 60_000 };
    }
  }
  return { Ratelimit };
});

vi.mock('@upstash/redis', () => {
  const command =
    () =>
    async (...args: unknown[]) => {
      recorded.redisArgs.push(...args);
      return null;
    };
  const client: unknown = new Proxy(
    {},
    {
      get: (_target, name) => {
        if (name === 'then') return undefined;
        if (name === 'pipeline' || name === 'multi') return () => pipeline;
        return command();
      },
    },
  );
  const pipeline: unknown = new Proxy(
    {},
    {
      get: (_target, name) =>
        name === 'exec'
          ? async () => []
          : (...args: unknown[]) => {
              recorded.redisArgs.push(...args);
              return pipeline;
            },
    },
  );
  return { Redis: { fromEnv: () => client } };
});

vi.mock('next/server', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next/server')>()),
  connection: vi.fn(async () => undefined),
}));
vi.mock('ai', () => ({ streamText: vi.fn() }));
vi.mock('@/lib/log', () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

const RAW_IPV4 = '203.0.113.7';
const OTHER_IPV4 = '198.51.100.24';
const RAW_IPV6 = '2001:db8:abcd:12:aaaa:bbbb:cccc:dddd';
const SAME_SLASH64_IPV6 = '2001:db8:abcd:12:1111:2222:3333:4444';
const OTHER_SLASH64_IPV6 = '2001:db8:abcd:13:aaaa:bbbb:cccc:dddd';
const IPV6_SLASH64_TEXT = ['2001:db8:abcd:12', '2001:0db8', '2001:db8'];
const HASHED_IDENTIFIER = /^[0-9a-f]{16}$/;

type RouteCall = (ip: string) => Promise<Response>;

function jsonPost(url: string, ip: string, body: unknown): NextRequest {
  return new NextRequest(url, {
    method: 'POST',
    body: JSON.stringify(body),
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream',
      'x-forwarded-for': ip,
    },
  });
}

function get(url: string, ip: string): NextRequest {
  return new NextRequest(url, { headers: { 'x-forwarded-for': ip } });
}

const ROUTES: Record<string, { prefixes: string[]; call: RouteCall }> = {
  contact: {
    prefixes: ['rl:contact'],
    call: async (ip) => {
      const { POST } = await import('@/app/api/contact/route');
      return POST(
        jsonPost('http://localhost/api/contact', ip, {
          name: 'Ada',
          email: 'ada@example.com',
          message: 'hello there, a message long enough',
        }),
      );
    },
  },
  log: {
    prefixes: ['rl:errlog', 'rl:errlog:ipday', SHARED_DAILY_PREFIX],
    call: async (ip) => {
      const { POST } = await import('@/app/api/log/route');
      return POST(jsonPost('http://localhost/api/log', ip, { level: 'error', message: 'boom' }));
    },
  },
  forget: {
    prefixes: ['rl:forget'],
    call: async (ip) => {
      const { POST } = await import('@/app/api/log/forget/route');
      return POST(
        jsonPost('http://localhost/api/log/forget', ip, {
          requestId: '11111111-1111-4111-8111-111111111111',
        }),
      );
    },
  },
  ask: {
    prefixes: ['rl:ask'],
    call: async (ip) => {
      const { POST } = await import('@/app/api/ask/route');
      return POST(jsonPost('http://localhost/api/ask', ip, { question: 'hi' }));
    },
  },
  mcp: {
    prefixes: ['rl:mcp'],
    call: async (ip) => {
      const { POST } = await import('@/app/api/mcp/route');
      return POST(
        jsonPost('http://localhost/api/mcp', ip, {
          jsonrpc: '2.0',
          id: 1,
          method: 'tools/list',
        }),
      );
    },
  },
  healthz: {
    prefixes: ['rl:healthz'],
    call: async (ip) => {
      const { GET } = await import('@/app/api/healthz/route');
      return GET(get('http://localhost/api/healthz', ip));
    },
  },
  lighthouse: {
    prefixes: ['rl:lighthouse'],
    call: async (ip) => {
      const { GET } = await import('@/app/api/lighthouse/route');
      return GET(get('http://localhost/api/lighthouse', ip));
    },
  },
};

const ROUTE_NAMES = Object.keys(ROUTES);

function clientCalls(): { prefix: string; identifier: string }[] {
  return recorded.limiterCalls.filter((c) => c.prefix !== SHARED_DAILY_PREFIX);
}

function forbiddenFragments(ip: string): string[] {
  return ip.includes(':') ? [ip, ...IPV6_SLASH64_TEXT] : [ip];
}

async function identifiersFor(route: string, ip: string): Promise<string[]> {
  recorded.limiterCalls.length = 0;
  const entry = ROUTES[route];
  if (!entry) throw new Error(`unknown route ${route}`);
  await entry.call(ip);
  return clientCalls().map((c) => c.identifier);
}

describe('every client rate limiter is keyed by the salted hash, never the raw address', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv('UPSTASH_REDIS_REST_URL', 'https://fake.upstash.example');
    vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', 'fake-token');
    vi.stubEnv('DEPLOY_SALT', 'privacy-test-salt');
    recorded.limiterCalls.length = 0;
    recorded.redisArgs.length = 0;
  });

  it.each(ROUTE_NAMES.flatMap((route) => [RAW_IPV4, RAW_IPV6].map((ip) => [route, ip] as const)))(
    '%s keeps %s out of every limiter key and Redis argument',
    async (route, ip) => {
      const entry = ROUTES[route];
      await entry?.call(ip);

      expect(
        recorded.limiterCalls.map((c) => c.prefix),
        `${route} must reach its client limiters`,
      ).toEqual(expect.arrayContaining(entry?.prefixes ?? []));
      for (const shared of recorded.limiterCalls.filter((c) => c.prefix === SHARED_DAILY_PREFIX)) {
        expect(shared.identifier, 'the shared daily cap keeps one key for all clients').toBe(
          SHARED_DAILY_KEY,
        );
      }
      for (const { prefix, identifier } of clientCalls()) {
        const key = `${prefix}:${identifier}`;
        for (const fragment of forbiddenFragments(ip)) {
          expect(key, `limiter key ${key} must not contain the client address`).not.toContain(
            fragment,
          );
        }
        expect(identifier, `limiter identifier on ${prefix} must be the salted hash`).toMatch(
          HASHED_IDENTIFIER,
        );
      }
      const redisText = JSON.stringify(recorded.redisArgs);
      for (const fragment of forbiddenFragments(ip)) {
        expect(redisText, 'no Redis argument may carry the client address').not.toContain(fragment);
      }
    },
  );

  it.each(ROUTE_NAMES)('%s buckets two addresses in one IPv6 /64 together', async (route) => {
    const first = await identifiersFor(route, RAW_IPV6);
    const second = await identifiersFor(route, SAME_SLASH64_IPV6);
    expect(first.length).toBeGreaterThan(0);
    expect(second, 'one /64 must share one rate-limit bucket').toEqual(first);
  });

  it.each(ROUTE_NAMES)('%s gives distinct clients distinct buckets', async (route) => {
    const v4 = await identifiersFor(route, RAW_IPV4);
    const otherV4 = await identifiersFor(route, OTHER_IPV4);
    const v6 = await identifiersFor(route, RAW_IPV6);
    const otherV6 = await identifiersFor(route, OTHER_SLASH64_IPV6);
    expect(otherV4, 'two IPv4 clients must not share a bucket').not.toEqual(v4);
    expect(otherV6, 'two IPv6 /64 networks must not share a bucket').not.toEqual(v6);
  });

  it('derives a hashed identifier, and the limiter type refuses a raw address', async () => {
    const { getContactLimit } = await import('@/lib/rate-limit');
    const { clientRateLimitKey } = await import('@/lib/server/rate-limit-key');
    const limiter = getContactLimit();
    const refused = () =>
      // @ts-expect-error a raw client address is not a RateLimitIdentifier
      limiter.limit(RAW_IPV4);
    const identifier = await clientRateLimitKey(get('http://localhost/', RAW_IPV4));
    expect(typeof refused).toBe('function');
    expect(identifier, 'the helper must emit the salted hash').toMatch(HASHED_IDENTIFIER);
  });
});
