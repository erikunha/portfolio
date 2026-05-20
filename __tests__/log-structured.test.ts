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

  it('app/api/ask/route.ts imports log, uses no console.* for business logging, threads requestId', () => {
    expect(ASK_ROUTE).toMatch(/import\s*\{[^}]*\blog\b[^}]*\}\s*from\s*['"]@\/lib\/log['"]/);
    // Allow console.error in the cold-start logger-init catch block (Finding 6 defence-in-depth).
    // Exclude catch block lines from the no-console assertion.
    const nonCatchLines = ASK_ROUTE.split('\n')
      .filter((l) => !l.includes('// Logger init failed') && !l.includes("console.error('[ask]"))
      .join('\n');
    expect(nonCatchLines).not.toMatch(/console\.(info|warn|error)\b/);
    expect(ASK_ROUTE).toMatch(/const\s+requestId\s*=\s*crypto\.randomUUID\(\)/);
  });

  it('app/api/contact/route.ts imports log, uses no console.*, threads requestId via defineHandler', () => {
    // PR 5c of audit roadmap migrated /api/contact to defineHandler from
    // lib/server/route.ts. The route no longer mints `requestId` directly
    // — it's threaded through the handler context via `defineHandler({
    // handler({ requestId }) { ... }})`. The log calls that consume it
    // (`{ requestId, msgId, ... }`) are the regression catcher.
    expect(CONTACT_ROUTE).toMatch(/import\s*\{[^}]*\blog\b[^}]*\}\s*from\s*['"]@\/lib\/log['"]/);
    expect(CONTACT_ROUTE).not.toMatch(/console\.(info|warn|error)\b/);
    expect(CONTACT_ROUTE).toMatch(/from\s*['"]@\/lib\/server\/route['"]/);
    expect(CONTACT_ROUTE).toMatch(/\bhandler\(\s*\{[^}]*\brequestId\b[^}]*\}\s*\)/);
    expect(CONTACT_ROUTE).toMatch(/log\.\w+\(\s*['"][^'"]+['"]\s*,\s*\{[^}]*\brequestId\b/);
  });

  it('all migrated log call sites have at least two arguments (msg + ctx)', () => {
    // Count opening-token occurrences: `log.<level>(`. This avoids the
    // [^)]+ shape which breaks on any log call whose args contain a closing
    // paren (e.g. log.error('msg', { err: JSON.stringify(x) })). We do not
    // try to parse argument lists -- just assert every call site has a comma
    // by checking the source around each opening token.
    const allMigratedSources = [RATE_LIMIT, LH_SCORES, ASK_ROUTE, CONTACT_ROUTE].join('\n');
    // Match from `log.<level>(` to the next newline; the comma must appear
    // before that newline for single-line calls (which all migrated calls are).
    for (const match of allMigratedSources.matchAll(/\blog\.(?:info|warn|error)\(([^\n]*)/g)) {
      const argsStart = match[1] ?? '';
      // Skip the cold-start try/catch fallback line which uses console.error.
      if (argsStart.startsWith('//')) continue;
      expect(argsStart, `log call args missing ctx: log.?(${argsStart})`).toMatch(/,/);
    }
  });
});
