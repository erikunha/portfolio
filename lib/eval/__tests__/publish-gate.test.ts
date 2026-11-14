import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  dropRedisCredentials,
  EVAL_PUBLISH_ENV,
  EVAL_PUBLISH_VALUE,
  isolateFromRedis,
  isPublishEnabled,
  restoreRedisCredentials,
} from '@/lib/eval/publish-gate';
import { REDIS_ENV_PAIRS } from '@/lib/rate-limit';

const workflow = (name: string) =>
  readFileSync(`${process.cwd()}/.github/workflows/${name}`, 'utf8');
const FLAG_LINE = new RegExp(`${EVAL_PUBLISH_ENV}:.*['"]${EVAL_PUBLISH_VALUE}['"]`);

describe('lib/eval/publish-gate', () => {
  it('is disabled unless the flag equals the opt-in value', () => {
    expect(isPublishEnabled({})).toBe(false);
    expect(isPublishEnabled({ [EVAL_PUBLISH_ENV]: '' })).toBe(false);
    expect(isPublishEnabled({ [EVAL_PUBLISH_ENV]: '0' })).toBe(false);
    expect(isPublishEnabled({ [EVAL_PUBLISH_ENV]: EVAL_PUBLISH_VALUE })).toBe(true);
  });

  it('removes every Redis credential pair (Upstash and Vercel KV) when publishing is off', () => {
    const env: Record<string, string | undefined> = { OTHER: 'keep' };
    for (const { url, token } of REDIS_ENV_PAIRS) {
      env[url] = 'https://redis.example';
      env[token] = 'tok';
    }
    isolateFromRedis(env);
    for (const { url, token } of REDIS_ENV_PAIRS) {
      expect(env[url]).toBeUndefined();
      expect(env[token]).toBeUndefined();
    }
    expect(env.OTHER).toBe('keep');
  });

  it('removes the credentials when publishing is on too and hands them back for the publish step', () => {
    const env: Record<string, string | undefined> = {
      [EVAL_PUBLISH_ENV]: EVAL_PUBLISH_VALUE,
      KV_REST_API_URL: 'https://redis.example',
      KV_REST_API_TOKEN: 'tok',
    };
    const withheld = isolateFromRedis(env);
    expect(env.KV_REST_API_URL).toBeUndefined();
    expect(env.KV_REST_API_TOKEN).toBeUndefined();
    expect(withheld).toEqual({
      KV_REST_API_URL: 'https://redis.example',
      KV_REST_API_TOKEN: 'tok',
    });
  });

  it('hands nothing back when publishing is off, so no credential can return', () => {
    const env: Record<string, string | undefined> = {
      KV_REST_API_URL: 'https://redis.example',
      KV_REST_API_TOKEN: 'tok',
    };
    expect(isolateFromRedis(env)).toEqual({});
    restoreRedisCredentials(env, {});
    expect(env.KV_REST_API_URL).toBeUndefined();
  });

  it('restores withheld credentials and drops them again', () => {
    const env: Record<string, string | undefined> = {};
    const withheld = {
      UPSTASH_REDIS_REST_URL: 'https://redis.example',
      UPSTASH_REDIS_REST_TOKEN: 'tok',
    };
    restoreRedisCredentials(env, withheld);
    expect(env.UPSTASH_REDIS_REST_URL).toBe('https://redis.example');
    dropRedisCredentials(env, withheld);
    expect(env.UPSTASH_REDIS_REST_URL).toBeUndefined();
    expect(env.UPSTASH_REDIS_REST_TOKEN).toBeUndefined();
  });

  it('is set in the two scheduled workflows and nowhere else', () => {
    expect(workflow('ask-eval.yml')).toMatch(FLAG_LINE);
    expect(workflow('agent-eval.yml')).toMatch(FLAG_LINE);
    expect(workflow('ci.yml')).not.toContain(EVAL_PUBLISH_ENV);
  });
});
