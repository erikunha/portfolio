// __tests__/ask-model-drift.test.ts
// Model-drift assertion for the /api/ask feature.
//
// lib/ask/model.ts exports a SINGLE source of truth for the feature model
// string (ASK_MODEL). Both the live route (app/api/ask/route.ts) and the eval
// harness (scripts/ask-eval.ts) MUST consume that const, so the eval gate can
// never grade a different model than the one that ships to production.
//
// This is one of the explicitly permitted source-reads: it asserts a
// CONFIGURATION invariant (the shared const is actually wired into both
// files), not a behavioral property. A future edit that hardcodes a new model
// string directly in either file — instead of bumping the shared const — would
// silently diverge the eval target from production; this test catches it. The
// readFileSync lines carry the behavioral-test-allow tag the meta source-grep
// guard (__tests__/meta/no-source-grep.test.ts) requires.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ASK_MODEL } from '@/lib/ask/model';

const ROOT = process.cwd();

describe('ask model drift', () => {
  it('ASK_MODEL is a non-empty provider/model string', () => {
    expect(typeof ASK_MODEL).toBe('string');
    expect(ASK_MODEL.length).toBeGreaterThan(0);
    expect(ASK_MODEL).toContain('/');
  });

  it('the live route references the shared ASK_MODEL const, not a hardcoded model string', () => {
    // behavioral-test-allow: configuration-invariant — the eval target must equal the production model
    const route = readFileSync(join(ROOT, 'app/api/ask/route.ts'), 'utf8');
    expect(route).toContain('ASK_MODEL');
    expect(route).toContain("from '@/lib/ask/model'");
  });

  it('the eval harness references the shared ASK_MODEL const, not a hardcoded model string', () => {
    // behavioral-test-allow: configuration-invariant — the eval target must equal the production model
    const harness = readFileSync(join(ROOT, 'scripts/ask-eval.ts'), 'utf8');
    expect(harness).toContain('ASK_MODEL');
    expect(harness).toContain("from '@/lib/ask/model'");
  });
});
