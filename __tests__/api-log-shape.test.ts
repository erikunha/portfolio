// __tests__/api-log-shape.test.ts
// Source-grep test: verifies the /api/log endpoint shape + rate-limit
// reuse + KV key pattern per spec docs/superpowers/specs/
// 2026-05-18-production-observability-design.md §7a.
//
// Task 4 (Phase 3a) populates the endpoint block.
// Task 5 (Phase 3b) appends the client-bridge block.

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const LOG_ROUTE = readFileSync(path.resolve(__dirname, '../app/api/log/route.ts'), 'utf-8');
const RATE_LIMIT = readFileSync(path.resolve(__dirname, '../lib/rate-limit.ts'), 'utf-8');

describe('/api/log endpoint (Phase 3a)', () => {
  it('exports a POST handler with NextRequest typing', () => {
    expect(LOG_ROUTE).toMatch(/export\s+async\s+function\s+POST\s*\(/);
    expect(LOG_ROUTE).toMatch(/NextRequest/);
  });

  it('marks the route as dynamic', () => {
    expect(LOG_ROUTE).toMatch(/export\s+const\s+dynamic\s*=\s*['"]force-dynamic['"]/);
  });

  it('validates the request shape with zod', () => {
    expect(LOG_ROUTE).toMatch(/from\s*['"]zod['"]/);
    expect(LOG_ROUTE).toMatch(/z\.object\(/);
  });

  it('does NOT store ipHash in err:* records (personal-data-free design)', () => {
    // err:* records intentionally omit ipHash so they contain no personal data
    // and fall outside the /api/log/forget erasure scope. The IP is used only
    // for rate-limiting and discarded. See DECISIONS.md 2026-05-19.
    // Check code lines only (not comments) by filtering out comment lines.
    const codeLines = LOG_ROUTE.split('\n')
      .filter((l) => !l.trimStart().startsWith('//'))
      .join('\n');
    expect(codeLines).not.toMatch(/\bipHash\b/);
    expect(codeLines).not.toMatch(/\bhashIp\b/);
  });

  it('lib/ip-hash.ts uses SHA-256 + DEPLOY_SALT (centralised; previously inline in each route)', () => {
    const IP_HASH = readFileSync(path.resolve(__dirname, '../lib/ip-hash.ts'), 'utf-8');
    expect(IP_HASH).toMatch(/SHA-256/);
    expect(IP_HASH).toMatch(/DEPLOY_SALT/);
    expect(IP_HASH).toMatch(/^import 'server-only'/m);
  });

  it('writes to Upstash KV with err: prefix and 30-day TTL', () => {
    expect(LOG_ROUTE).toMatch(/['"`]err:/);
    expect(LOG_ROUTE).toMatch(/2[_]?592[_]?000/);
  });

  it('uses the new getErrorLogLimit() rate-limit factory', () => {
    expect(LOG_ROUTE).toMatch(/getErrorLogLimit\(\)/);
  });

  it('lib/rate-limit.ts exports getErrorLogLimit factory with 10/min limit', () => {
    expect(RATE_LIMIT).toMatch(/export\s+function\s+getErrorLogLimit\b/);
    expect(RATE_LIMIT).toMatch(/slidingWindow\(\s*10\s*,\s*['"]1\s*m['"]/);
  });

  it('returns 204 on success, 400 on validation fail, 503 on KV unreachable', () => {
    expect(LOG_ROUTE).toMatch(/status:\s*204/);
    expect(LOG_ROUTE).toMatch(/status:\s*400/);
    expect(LOG_ROUTE).toMatch(/status:\s*503/);
  });

  it('skips KV persistence for [smoke]-prefixed messages (smoke-test sentinel)', () => {
    // SMOKE_PREFIX guard prevents CI smoke runs from polluting prod KV.
    expect(LOG_ROUTE).toMatch(/SMOKE_PREFIX/);
    expect(LOG_ROUTE).toMatch(/startsWith\(SMOKE_PREFIX\)/);
  });
});

describe('client error bridge (Phase 3b)', () => {
  const BRIDGE = readFileSync(path.resolve(__dirname, '../lib/error-bridge.client.ts'), 'utf-8');
  const ERROR_BOUNDARY = readFileSync(
    path.resolve(__dirname, '../components/ErrorBoundary.client.tsx'),
    'utf-8',
  );
  const APP_SHELL = readFileSync(
    path.resolve(__dirname, '../components/AppShell.client.tsx'),
    'utf-8',
  );

  it('lib/error-bridge.ts declares use client', () => {
    expect(BRIDGE).toMatch(/^['"]use client['"]/m);
  });

  it('registers both window.onerror and unhandledrejection listeners', () => {
    expect(BRIDGE).toMatch(/window\.addEventListener\(\s*['"]error['"]/);
    expect(BRIDGE).toMatch(/window\.addEventListener\(\s*['"]unhandledrejection['"]/);
  });

  it('dedupes via a 100ms tail window keyed on message + stack', () => {
    expect(BRIDGE).toMatch(/100/);
    expect(BRIDGE).toMatch(/\b(Map|Set|Record)\b/);
  });

  it('dedup Map is capped at MAX_DEDUP_SIZE to prevent unbounded growth', () => {
    // MAX_DEDUP_SIZE guards against pathological growth when each error message
    // contains a unique ID or timestamp (tight loops faster than 100ms window).
    expect(BRIDGE).toMatch(/MAX_DEDUP_SIZE/);
    expect(BRIDGE).toMatch(/export\s+const\s+MAX_DEDUP_SIZE\s*=\s*\d+/);
  });

  it('POSTs structured payload to /api/log', () => {
    expect(BRIDGE).toMatch(/fetch\(\s*['"]\/api\/log['"]/);
    expect(BRIDGE).toMatch(/method:\s*['"]POST['"]/);
  });

  it('AppShell.client.tsx imports lib/error-bridge.client once as a side-effect', () => {
    // Bare side-effect import: `import '@/lib/error-bridge.client';` (or relative variant).
    // PR 6b of audit roadmap renamed lib/error-bridge.ts to
    // lib/error-bridge.client.ts to comply with Standard 2 naming gate.
    expect(APP_SHELL).toMatch(
      /import\s+['"](@\/lib\/error-bridge\.client|\.\.\/lib\/error-bridge\.client)['"]/,
    );
  });

  it('ErrorBoundary.client.tsx componentDidCatch POSTs to /api/log', () => {
    expect(ERROR_BOUNDARY).toMatch(/console\.error/);
    expect(ERROR_BOUNDARY).toMatch(/fetch\(\s*['"]\/api\/log['"]/);
    expect(ERROR_BOUNDARY).toMatch(/method:\s*['"]POST['"]/);
  });
});
