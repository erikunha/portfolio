// __tests__/log-structured.test.ts
// Source-grep test: verifies lib/log.ts foundation + 11-site console.*
// migration per spec docs/superpowers/specs/2026-05-18-production-
// observability-design.md §6.
//
// Task 2 (foundation) populates the first describe block.
// Task 3 (migration) populates the second describe block.

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const LOG_SOURCE = readFileSync(path.resolve(__dirname, '../lib/log.ts'), 'utf-8');
const PACKAGE_JSON = JSON.parse(
  readFileSync(path.resolve(__dirname, '../package.json'), 'utf-8'),
) as { dependencies?: Record<string, string>; devDependencies?: Record<string, string> };

describe('lib/log.ts foundation', () => {
  it('declares pino as a runtime dep and pino-pretty as a dev dep', () => {
    expect(PACKAGE_JSON.dependencies?.pino).toBeDefined();
    expect(PACKAGE_JSON.devDependencies?.['pino-pretty']).toBeDefined();
  });

  it('imports pino', () => {
    expect(LOG_SOURCE).toMatch(/from\s*['"]pino['"]/);
  });

  it('exports a log object with info, warn, error methods', () => {
    expect(LOG_SOURCE).toMatch(/export\s+const\s+log\b/);
    expect(LOG_SOURCE).toMatch(/\binfo\b/);
    expect(LOG_SOURCE).toMatch(/\bwarn\b/);
    expect(LOG_SOURCE).toMatch(/\berror\b/);
  });

  it('does NOT export withRequestContext or currentRequestId (explicit-param strategy)', () => {
    expect(LOG_SOURCE).not.toMatch(/export\s+function\s+withRequestContext/);
    expect(LOG_SOURCE).not.toMatch(/export\s+function\s+currentRequestId/);
  });

  it('uses pino-pretty in development and JSON in production', () => {
    expect(LOG_SOURCE).toMatch(/pino-pretty/);
    expect(LOG_SOURCE).toMatch(/NODE_ENV/);
  });
});

describe('console.* migration sites (Task 3 — placeholder)', () => {
  it.skip('see Task 3 for migration assertions', () => {
    // Task 3 will populate this block with console.* migration assertions.
  });
});
