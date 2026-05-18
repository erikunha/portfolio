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

describe('console.* migration sites', () => {
  const RATE_LIMIT = readFileSync(path.resolve(__dirname, '../lib/rate-limit.ts'), 'utf-8');
  const LH_SCORES = readFileSync(path.resolve(__dirname, '../lib/lighthouse-scores.ts'), 'utf-8');
  const ASK_ROUTE = readFileSync(path.resolve(__dirname, '../app/api/ask/route.ts'), 'utf-8');
  const CONTACT_ROUTE = readFileSync(
    path.resolve(__dirname, '../app/api/contact/route.ts'),
    'utf-8',
  );

  it('lib/rate-limit.ts imports log and uses no console.*', () => {
    expect(RATE_LIMIT).toMatch(/import\s*\{[^}]*\blog\b[^}]*\}\s*from\s*['"]@\/lib\/log['"]/);
    expect(RATE_LIMIT).not.toMatch(/console\.(info|warn|error)\b/);
  });

  it('lib/lighthouse-scores.ts imports log and uses no console.*', () => {
    expect(LH_SCORES).toMatch(/import\s*\{[^}]*\blog\b[^}]*\}\s*from\s*['"]@\/lib\/log['"]/);
    expect(LH_SCORES).not.toMatch(/console\.(info|warn|error)\b/);
  });

  it('app/api/ask/route.ts imports log, uses no console.*, threads requestId', () => {
    expect(ASK_ROUTE).toMatch(/import\s*\{[^}]*\blog\b[^}]*\}\s*from\s*['"]@\/lib\/log['"]/);
    expect(ASK_ROUTE).not.toMatch(/console\.(info|warn|error)\b/);
    expect(ASK_ROUTE).toMatch(/const\s+requestId\s*=\s*crypto\.randomUUID\(\)/);
  });

  it('app/api/contact/route.ts imports log, uses no console.*, threads requestId', () => {
    expect(CONTACT_ROUTE).toMatch(/import\s*\{[^}]*\blog\b[^}]*\}\s*from\s*['"]@\/lib\/log['"]/);
    expect(CONTACT_ROUTE).not.toMatch(/console\.(info|warn|error)\b/);
    expect(CONTACT_ROUTE).toMatch(/const\s+requestId\s*=\s*crypto\.randomUUID\(\)/);
  });

  it('all migrated log calls include ctx (the second arg)', () => {
    const allMigratedSources = [RATE_LIMIT, LH_SCORES, ASK_ROUTE, CONTACT_ROUTE].join('\n');
    const logCalls = allMigratedSources.matchAll(/\blog\.(info|warn|error)\(([^)]+)\)/g);
    for (const match of logCalls) {
      const args = match[2] ?? '';
      expect(args).toMatch(/,/);
    }
  });
});
