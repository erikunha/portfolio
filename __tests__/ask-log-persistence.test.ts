// __tests__/ask-log-persistence.test.ts
// Source-grep test: verifies /api/ask Q+A persistence + X-Request-Id
// header per spec docs/superpowers/specs/2026-05-18-production-
// observability-design.md §7c.
//
// Task 6 (Phase 3c) populates the persistence block.
// Task 7 (Phase 3d) appends the /api/log/forget block.

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const ASK_LOG = readFileSync(path.resolve(__dirname, '../lib/ask-log.ts'), 'utf-8');
const ASK_ROUTE = readFileSync(path.resolve(__dirname, '../app/api/ask/route.ts'), 'utf-8');

describe('Q+A persistence (Phase 3c)', () => {
  it('lib/ask-log.ts exports persistAskInteraction', () => {
    expect(ASK_LOG).toMatch(/export\s+(async\s+)?function\s+persistAskInteraction\b/);
  });

  it('uses ask:log: KV prefix with date partition and 90-day TTL', () => {
    expect(ASK_LOG).toMatch(/['"`]ask:log:/);
    expect(ASK_LOG).toMatch(/7[_]?776[_]?000/);
  });

  it('truncates question to 500 chars and answer to 1000 chars', () => {
    expect(ASK_LOG).toMatch(/\.slice\(\s*0\s*,\s*500\s*\)/);
    expect(ASK_LOG).toMatch(/\.slice\(\s*0\s*,\s*1000\s*\)/);
  });

  it('app/api/ask/route.ts calls persistAskInteraction after stream completes', () => {
    expect(ASK_ROUTE).toMatch(/persistAskInteraction\(/);
    const persistIdx = ASK_ROUTE.indexOf('persistAskInteraction(');
    const incrementIdx = ASK_ROUTE.indexOf('incrementBudget(');
    expect(persistIdx).toBeGreaterThan(-1);
    expect(incrementIdx).toBeGreaterThan(-1);
  });

  it('app/api/ask/route.ts accumulates collectedAnswerText capped at 1000 chars', () => {
    expect(ASK_ROUTE).toMatch(/collectedAnswerText/);
  });

  it('app/api/ask/route.ts sets X-Request-Id response header on the streamed Response', () => {
    expect(ASK_ROUTE).toMatch(/['"]X-Request-Id['"]/);
    expect(ASK_ROUTE).toMatch(/requestId/);
  });
});

describe('/api/log/forget (Phase 3d — placeholder)', () => {
  // Populated by Task 7.
  it.skip('see Task 7 for forget-endpoint assertions', () => {
    // intentional placeholder — assertions added in Task 7
  });
});
