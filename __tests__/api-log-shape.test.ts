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

  it('hashes the IP via the centralised hashIp helper', () => {
    expect(LOG_ROUTE).toMatch(/import\s*\{[^}]*\bhashIp\b[^}]*\}\s*from\s*['"]@\/lib\/ip-hash['"]/);
    expect(LOG_ROUTE).toMatch(/hashIp\(\s*ip\s*\)/);
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
});

describe('client error bridge (Phase 3b — placeholder)', () => {
  // Populated by Task 5.
  it.skip('see Task 5 for client-bridge assertions', () => {});
});
