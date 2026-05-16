// __tests__/redis-singleton.test.ts

import { readFileSync } from 'fs';
import { describe, expect, it } from 'vitest';

describe('Redis singleton', () => {
  it('lighthouse-scores does not instantiate its own Redis client', () => {
    const src = readFileSync('lib/lighthouse-scores.ts', 'utf8');
    expect(src).not.toContain('Redis.fromEnv()');
    expect(src).not.toContain("from '@upstash/redis'");
  });
});
