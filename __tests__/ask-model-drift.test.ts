// readFileSync lines carry the behavioral-test-allow tag the meta source-grep

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
