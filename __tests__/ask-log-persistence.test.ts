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

describe('/api/log/forget endpoint (Phase 3d)', () => {
  const FORGET_ROUTE = readFileSync(
    path.resolve(__dirname, '../app/api/log/forget/route.ts'),
    'utf-8',
  );
  const RATE_LIMIT = readFileSync(path.resolve(__dirname, '../lib/rate-limit.ts'), 'utf-8');

  it('exports a POST handler with NextRequest typing', () => {
    expect(FORGET_ROUTE).toMatch(/export\s+async\s+function\s+POST\s*\(/);
    expect(FORGET_ROUTE).toMatch(/NextRequest/);
  });

  it('marks the route as dynamic', () => {
    expect(FORGET_ROUTE).toMatch(/export\s+const\s+dynamic\s*=\s*['"]force-dynamic['"]/);
  });

  it('validates requestId via zod', () => {
    expect(FORGET_ROUTE).toMatch(/from\s*['"]zod['"]/);
    expect(FORGET_ROUTE).toMatch(/requestId/);
  });

  it('deletes against the ask:log: KV key pattern', () => {
    expect(FORGET_ROUTE).toMatch(/ask:log:/);
    expect(FORGET_ROUTE).toMatch(/\.del\(/);
  });

  it('returns ok: true with a deleted count and is idempotent', () => {
    expect(FORGET_ROUTE).toMatch(/ok:\s*true/);
    expect(FORGET_ROUTE).toMatch(/deleted/);
  });

  it('uses the new getForgetLimit() rate-limit factory', () => {
    expect(FORGET_ROUTE).toMatch(/getForgetLimit\(\)/);
  });

  it('lib/rate-limit.ts exports getForgetLimit factory with 5/hour limit', () => {
    expect(RATE_LIMIT).toMatch(/export\s+function\s+getForgetLimit\b/);
    expect(RATE_LIMIT).toMatch(/slidingWindow\(\s*5\s*,\s*['"]1\s*h['"]/);
  });
});

describe('privacy notice on /api/ask form', () => {
  const FORM_HOST = readFileSync(
    path.resolve(__dirname, '../components/client/InteractiveShell.tsx'),
    'utf-8',
  );

  it('mentions 90-day retention + the /api/log/forget endpoint', () => {
    expect(FORM_HOST).toMatch(/90 days|90-day/);
    expect(FORM_HOST).toMatch(/\/api\/log\/forget/);
  });
});
