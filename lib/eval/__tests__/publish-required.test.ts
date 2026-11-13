import { spawnSync } from 'node:child_process';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { mockSet } = vi.hoisted(() => ({ mockSet: vi.fn(async () => 'OK') }));

vi.mock('@/lib/rate-limit', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/lib/rate-limit')>();
  return {
    hasRedisCredentials: original.hasRedisCredentials,
    REDIS_ENV_PAIRS: original.REDIS_ENV_PAIRS,
    getRedis: () => ({ set: mockSet }),
  };
});

import {
  EVAL_PUBLISH_ENV,
  EVAL_PUBLISH_VALUE,
  publishOutcomeError,
  publishPreflightError,
} from '@/lib/eval/publish-gate';
import { publishAggregate } from '@/lib/eval/redis-publish';

const SCRIPT_TIMEOUT_MS = 90_000;
const FAILURE_EXIT_CODE = 1;
const REDIS_ENV_NAMES = [
  'UPSTASH_REDIS_REST_URL',
  'UPSTASH_REDIS_REST_TOKEN',
  'KV_REST_API_URL',
  'KV_REST_API_TOKEN',
] as const;
const PUBLISHING = { [EVAL_PUBLISH_ENV]: EVAL_PUBLISH_VALUE };
const FULL_PAIR = {
  UPSTASH_REDIS_REST_URL: 'https://redis.example',
  UPSTASH_REDIS_REST_TOKEN: 'tok',
};

describe('publishing was requested, so a missing or failed publish must fail the run', () => {
  const saved = { ...process.env };

  beforeEach(() => {
    mockSet.mockClear();
    for (const name of REDIS_ENV_NAMES) delete process.env[name];
    delete process.env[EVAL_PUBLISH_ENV];
  });

  afterEach(() => {
    process.env = { ...saved };
  });

  it('reports no preflight error when publishing is off, whatever the credentials', () => {
    expect(publishPreflightError({}, {})).toBeNull();
  });

  it('names the flag and both secret names when publishing is on and nothing is set', () => {
    const message = publishPreflightError(PUBLISHING, {});
    expect(message).toContain(EVAL_PUBLISH_ENV);
    expect(message).toContain('UPSTASH_REDIS_REST_URL');
    expect(message).toContain('UPSTASH_REDIS_REST_TOKEN');
  });

  it('rejects a url without its token and a token without its url', () => {
    expect(
      publishPreflightError(PUBLISHING, { UPSTASH_REDIS_REST_URL: 'https://r' }),
    ).not.toBeNull();
    expect(publishPreflightError(PUBLISHING, { UPSTASH_REDIS_REST_TOKEN: 'tok' })).not.toBeNull();
  });

  it('accepts a complete Upstash pair and a complete Vercel KV pair', () => {
    expect(publishPreflightError(PUBLISHING, FULL_PAIR)).toBeNull();
    expect(
      publishPreflightError(PUBLISHING, {
        KV_REST_API_URL: 'https://redis.example',
        KV_REST_API_TOKEN: 'tok',
      }),
    ).toBeNull();
  });

  it('treats the empty strings an unset GitHub secret expands to as missing', () => {
    expect(
      publishPreflightError(PUBLISHING, {
        UPSTASH_REDIS_REST_URL: '',
        UPSTASH_REDIS_REST_TOKEN: '',
      }),
    ).not.toBeNull();
  });

  it('turns a publish without credentials into an error instead of a silent skip', async () => {
    process.env[EVAL_PUBLISH_ENV] = EVAL_PUBLISH_VALUE;
    const result = await publishAggregate('ask:eval:latest', { a: 1 });
    expect(result.published).toBe(false);
    expect(result.error).toContain('credentials');
    expect(mockSet).not.toHaveBeenCalled();
  });

  it('keeps an unrequested publish a quiet skip', async () => {
    const result = await publishAggregate('ask:eval:latest', { a: 1 });
    expect(result.error).toBeUndefined();
    expect(publishOutcomeError(result)).toBeNull();
  });

  it('reports a failed Redis write as an outcome error', async () => {
    process.env[EVAL_PUBLISH_ENV] = EVAL_PUBLISH_VALUE;
    Object.assign(process.env, FULL_PAIR);
    mockSet.mockRejectedValueOnce(new Error('redis down'));
    const result = await publishAggregate('ask:eval:latest', { a: 1 });
    expect(publishOutcomeError(result)).toContain('redis down');
  });

  it('reports nothing for a publish that landed', async () => {
    process.env[EVAL_PUBLISH_ENV] = EVAL_PUBLISH_VALUE;
    Object.assign(process.env, FULL_PAIR);
    expect(publishOutcomeError(await publishAggregate('ask:eval:latest', { a: 1 }))).toBeNull();
  });
});

describe.each(['ask-eval', 'agent-eval'])(
  '%s refuses to start a publishing run without credentials',
  (script) => {
    it(
      'exits non-zero before any model call and says which secrets are missing',
      () => {
        const env: NodeJS.ProcessEnv = { ...process.env, ...PUBLISHING, CI: 'true' };
        for (const name of REDIS_ENV_NAMES) delete env[name];
        delete env.AI_GATEWAY_API_KEY;
        delete env.VERCEL_OIDC_TOKEN;
        const run = spawnSync(`${process.cwd()}/node_modules/.bin/tsx`, [`scripts/${script}.ts`], {
          env: { ...env, TSX_TSCONFIG_PATH: 'scripts/tsconfig.eval.json' },
          encoding: 'utf8',
          timeout: SCRIPT_TIMEOUT_MS,
        });
        expect(run.status).toBe(FAILURE_EXIT_CODE);
        expect(run.stderr).toContain('UPSTASH_REDIS_REST_URL');
        expect(run.stderr).not.toContain('AI_GATEWAY_API_KEY');
      },
      SCRIPT_TIMEOUT_MS + 5_000,
    );
  },
);
