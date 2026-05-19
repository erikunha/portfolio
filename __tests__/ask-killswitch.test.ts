// __tests__/ask-killswitch.test.ts
// Source-grep test: verifies the kill-switch shape and ordering in
// app/api/ask/route.ts. See spec docs/superpowers/specs/
// 2026-05-18-gates-and-harness-hardening-design.md §6.

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const ASK_SOURCE = readFileSync(path.resolve(__dirname, '../app/api/ask/route.ts'), 'utf-8');

describe('/api/ask kill switch', () => {
  it('declares OFF_KEYWORDS Set with the five off keywords', () => {
    expect(ASK_SOURCE).toMatch(/const OFF_KEYWORDS = new Set\(/);
    expect(ASK_SOURCE).toMatch(/'false'/);
    expect(ASK_SOURCE).toMatch(/'0'/);
    expect(ASK_SOURCE).toMatch(/'off'/);
    expect(ASK_SOURCE).toMatch(/'no'/);
    expect(ASK_SOURCE).toMatch(/'disabled'/);
  });

  it('normalizes the env var via trim + toLowerCase before matching', () => {
    expect(ASK_SOURCE).toMatch(/process\.env\.ASK_ENABLED\s*\?\?\s*''/);
    expect(ASK_SOURCE).toMatch(/\.trim\(\)/);
    expect(ASK_SOURCE).toMatch(/\.toLowerCase\(\)/);
  });

  it('returns 503 with the email-fallback message when disabled', () => {
    expect(ASK_SOURCE).toMatch(/status:\s*503/);
    expect(ASK_SOURCE).toMatch(/email erikhenriquealvescunha@gmail\.com directly/);
  });

  it('kill-switch check runs BEFORE the rate-limit call', () => {
    const killIdx = ASK_SOURCE.indexOf('OFF_KEYWORDS.has');
    const rateLimitIdx = ASK_SOURCE.indexOf('getAskLimit()');
    expect(killIdx).toBeGreaterThan(-1);
    expect(rateLimitIdx).toBeGreaterThan(-1);
    expect(killIdx).toBeLessThan(rateLimitIdx);
  });

  it('emits a cold-start log line for ASK_ENABLED at module scope', () => {
    expect(ASK_SOURCE).toMatch(/console\.info\(\s*'\[ask\] kill-switch on cold start:'/);
  });
});
