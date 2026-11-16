import { describe, expect, it } from 'vitest';
import {
  EVAL_PUBLISH_ENV,
  EVAL_PUBLISH_VALUE,
  publishPreflightError,
} from '@/lib/eval/publish-gate';

const PUBLISHING = { [EVAL_PUBLISH_ENV]: EVAL_PUBLISH_VALUE };
const CLEAN_URL = 'https://redis-host.upstash.io';
const TOKEN = 'tok-secret-value';

describe('the preflight checks the pair the Redis client would pick', () => {
  it('rejects a padded UPSTASH pair even when the KV pair is clean', () => {
    const message = publishPreflightError(PUBLISHING, {
      UPSTASH_REDIS_REST_URL: ` ${CLEAN_URL}`,
      UPSTASH_REDIS_REST_TOKEN: TOKEN,
      KV_REST_API_URL: CLEAN_URL,
      KV_REST_API_TOKEN: TOKEN,
    });
    expect(message).toContain('UPSTASH_REDIS_REST_URL');
    expect(message).toContain('surrounding whitespace');
    expect(message).not.toContain('redis-host');
  });

  it('accepts a clean UPSTASH pair next to a malformed KV pair', () => {
    expect(
      publishPreflightError(PUBLISHING, {
        UPSTASH_REDIS_REST_URL: CLEAN_URL,
        UPSTASH_REDIS_REST_TOKEN: TOKEN,
        KV_REST_API_URL: 'no-scheme-host',
        KV_REST_API_TOKEN: TOKEN,
      }),
    ).toBeNull();
  });

  it('validates the URL the client resolves when the pairs are mixed', () => {
    const message = publishPreflightError(PUBLISHING, {
      UPSTASH_REDIS_REST_URL: CLEAN_URL,
      KV_REST_API_URL: 'no-scheme-host',
      KV_REST_API_TOKEN: TOKEN,
    });
    expect(message).toBeNull();
  });
});

describe('the preflight rejects a token with surrounding whitespace', () => {
  it.each([
    ['a trailing newline', `${TOKEN}\n`],
    ['a leading space', ` ${TOKEN}`],
  ])('refuses %s by variable and secret name, never by value', (_label, token) => {
    const message = publishPreflightError(PUBLISHING, {
      UPSTASH_REDIS_REST_URL: CLEAN_URL,
      UPSTASH_REDIS_REST_TOKEN: token,
    });
    expect(message).toContain('UPSTASH_REDIS_REST_TOKEN');
    expect(message).toContain('EVAL_PUBLISH_REDIS_REST_TOKEN');
    expect(message).toContain('surrounding whitespace');
    expect(message).not.toContain(TOKEN);
  });
});
