import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
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
        TSX_TSCONFIG_PATH: 'scripts/tsconfig.eval.json',
      };
      delete env.AI_GATEWAY_API_KEY;
      delete env.VERCEL_OIDC_TOKEN;
      const run = spawnSync(`${process.cwd()}/node_modules/.bin/tsx`, ['scripts/ask-eval.ts'], {
        env,
        encoding: 'utf8',
        timeout: SCRIPT_TIMEOUT_MS,
      });
      expect(run.status).toBe(FAILURE_EXIT_CODE);
      expect(run.stderr).toContain('EVAL_PUBLISH_REDIS_REST_URL');
      expect(run.stderr).not.toContain('Invalid environment configuration');
      expect(run.stderr).not.toContain(MALFORMED_URLS['a host with no scheme']);
    },
    SCRIPT_TIMEOUT_MS + 5_000,
  );
});
