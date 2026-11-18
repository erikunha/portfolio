import { spawnSync } from 'node:child_process';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  EVAL_PUBLISH_ENV,
  EVAL_PUBLISH_VALUE,
  publishPreflightError,
} from '@/lib/eval/publish-gate';

const SCRIPT_TIMEOUT_MS = 90_000;
const FAILURE_EXIT_CODE = 1;
const PUBLISHING = { [EVAL_PUBLISH_ENV]: EVAL_PUBLISH_VALUE };
const TOKEN = 'tok-secret-value';
const MALFORMED_URLS = {
  'a host with no scheme': 'redis-host.upstash.io',
  'a value wrapped in quotes': '"https://redis-host.upstash.io"',
  'a non-http scheme': 'rediss://default:pw@redis-host.upstash.io:6379',
} as const;

const SURROUNDED_URLS = {
  'a trailing newline': 'https://redis-host.upstash.io\n',
  'a trailing space': 'https://redis-host.upstash.io ',
  'a leading space': ' https://redis-host.upstash.io',
} as const;

const pair = (url: string) => ({ UPSTASH_REDIS_REST_URL: url, UPSTASH_REDIS_REST_TOKEN: TOKEN });

describe('a publishing run rejects a Redis URL that cannot be reached, before any model call', () => {
  it.each(Object.entries(MALFORMED_URLS))(
    'refuses %s and never echoes the value',
    (_label, url) => {
      const message = publishPreflightError(PUBLISHING, pair(url));
      expect(message).toContain('UPSTASH_REDIS_REST_URL');
      expect(message).toContain('EVAL_PUBLISH_REDIS_REST_URL');
      expect(message).not.toContain(url);
      expect(message).not.toContain(TOKEN);
    },
  );

  it.each(Object.entries(SURROUNDED_URLS))(
    'refuses %s as surrounding whitespace and never echoes the value',
    (_label, url) => {
      const message = publishPreflightError(PUBLISHING, pair(url));
      expect(message).toContain('UPSTASH_REDIS_REST_URL');
      expect(message).toContain('EVAL_PUBLISH_REDIS_REST_URL');
      expect(message).toContain('surrounding whitespace');
      expect(message).not.toContain('redis-host.upstash.io');
      expect(message).not.toContain(TOKEN);
    },
  );

  it('accepts an https URL', () => {
    expect(publishPreflightError(PUBLISHING, pair('https://redis-host.upstash.io'))).toBeNull();
  });

  it('ignores the URL when nothing is being published', () => {
    expect(publishPreflightError({}, pair('redis-host.upstash.io'))).toBeNull();
  });

  it(
    'pnpm ask:eval reports the malformed secret itself, not a stack trace from the env module',
    () => {
      const env: NodeJS.ProcessEnv = {
        ...process.env,
        ...PUBLISHING,
        CI: 'true',
        ...pair(MALFORMED_URLS['a host with no scheme']),
        TSX_TSCONFIG_PATH: 'scripts/eval/tsconfig.eval.json',
      };
      delete env.AI_GATEWAY_API_KEY;
      delete env.VERCEL_OIDC_TOKEN;
      const run = spawnSync(
        `${process.cwd()}/node_modules/.bin/tsx`,
        ['scripts/eval/ask-eval.ts'],
        {
          env,
          encoding: 'utf8',
          timeout: SCRIPT_TIMEOUT_MS,
        },
      );
      expect(run.status).toBe(FAILURE_EXIT_CODE);
      expect(run.stderr).toContain('EVAL_PUBLISH_REDIS_REST_URL');
      expect(run.stderr).not.toContain('Invalid environment configuration');
      expect(run.stderr).not.toContain(MALFORMED_URLS['a host with no scheme']);
    },
    SCRIPT_TIMEOUT_MS + 5_000,
  );
});

describe('a failed publish never reports the Redis URL or token', () => {
  const SECRET_URL = 'https://redis-host.upstash.io';
  const SECRET_TOKEN = 'tok-leaky-value';

  afterEach(() => {
    vi.resetModules();
    vi.doUnmock('@/lib/redis');
  });

  it('returns a message free of both values when the client throws one that contains them', async () => {
    vi.doMock('@/lib/redis', () => ({
      hasRedisCredentials: () => true,
      getRedis: () => ({
        set: async () => {
          throw new Error(`bad ${SECRET_TOKEN} and ${SECRET_URL}`);
        },
      }),
    }));
    const { publishAggregate } = await import('@/lib/eval/redis-publish');
    const previous = process.env[EVAL_PUBLISH_ENV];
    process.env[EVAL_PUBLISH_ENV] = EVAL_PUBLISH_VALUE;
    process.env.UPSTASH_REDIS_REST_URL = SECRET_URL;
    process.env.UPSTASH_REDIS_REST_TOKEN = SECRET_TOKEN;
    try {
      const result = await publishAggregate('key', { ok: true });
      expect(result.published).toBe(false);
      expect(result.error).toBeTruthy();
      expect(result.error).not.toContain(SECRET_URL);
      expect(result.error).not.toContain(SECRET_TOKEN);
      expect(result.error).not.toContain('redis-host');
    } finally {
      delete process.env.UPSTASH_REDIS_REST_URL;
      delete process.env.UPSTASH_REDIS_REST_TOKEN;
      if (previous === undefined) delete process.env[EVAL_PUBLISH_ENV];
      else process.env[EVAL_PUBLISH_ENV] = previous;
    }
  });
});
