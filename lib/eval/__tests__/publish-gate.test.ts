import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  EVAL_PUBLISH_ENV,
  EVAL_PUBLISH_VALUE,
  isolateFromRedis,
  isPublishEnabled,
} from '@/lib/eval/publish-gate';
import { REDIS_ENV_PAIRS } from '@/lib/rate-limit';

const workflow = (name: string) =>
  readFileSync(`${process.cwd()}/.github/workflows/${name}`, 'utf8');
const FLAG_LINE = new RegExp(`${EVAL_PUBLISH_ENV}:\\s*['"]?${EVAL_PUBLISH_VALUE}['"]?`);

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

  it('leaves Redis credentials untouched when publishing is on', () => {
    const env: Record<string, string | undefined> = {
      [EVAL_PUBLISH_ENV]: EVAL_PUBLISH_VALUE,
      KV_REST_API_URL: 'https://redis.example',
      KV_REST_API_TOKEN: 'tok',
    };
    isolateFromRedis(env);
    expect(env.KV_REST_API_URL).toBe('https://redis.example');
    expect(env.KV_REST_API_TOKEN).toBe('tok');
  });

  it('is set in the two scheduled workflows and nowhere else', () => {
    expect(workflow('ask-eval.yml')).toMatch(FLAG_LINE);
    expect(workflow('agent-eval.yml')).toMatch(FLAG_LINE);
    expect(workflow('ci.yml')).not.toContain(EVAL_PUBLISH_ENV);
  });
});
