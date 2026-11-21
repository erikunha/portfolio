import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { trackedFiles } from '@/scripts/lib/git';

const ROOT = process.cwd();
const TEST_FILE = /\.test\.(ts|tsx)$/;
const RATE_LIMIT_MOCK = /vi\.mock\(\s*'@\/lib\/rate-limit'\s*,\s*([^\n]*(?:\n[^\n]*){0,2})/g;
const USES_HELPER = /rateLimitModule\(/;
const SELF = '__tests__/meta/rate-limit-mock-helper.test.ts';

function inlineRateLimitMocks(path: string, source: string): string[] {
  if (path === SELF) return [];
  const offenders: string[] = [];
  for (const match of source.matchAll(RATE_LIMIT_MOCK)) {
    if (!USES_HELPER.test(match[1] ?? '')) offenders.push(path);
  }
  return offenders;
}

describe('mocks of lib/rate-limit', () => {
  it('flags an inline factory and accepts the shared one', () => {
    const inline = "vi.mock('@/lib/rate-limit', () => ({ getAskLimit: vi.fn() }));";
    const shared =
      "vi.mock('@/lib/rate-limit', async () =>\n  (await import('@/__tests__/helpers/ask-route')).rateLimitModule(),\n);";
    expect(inlineRateLimitMocks('x.test.ts', inline)).toEqual(['x.test.ts']);
    expect(inlineRateLimitMocks('x.test.ts', shared)).toEqual([]);
  });

  it('go through rateLimitModule, so a new limiter export reaches every test once', () => {
    const offenders = trackedFiles([], { cwd: ROOT })
      .filter((path) => TEST_FILE.test(path))
      .flatMap((path) => inlineRateLimitMocks(path, readFileSync(join(ROOT, path), 'utf8')));
    expect(
      offenders,
      'an inline rate-limit mock drifts from the shared one. Use rateLimitModule from __tests__/helpers/ask-route.ts',
    ).toEqual([]);
  });
});
