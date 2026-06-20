// scripts/__tests__/check-semgrep-fixture.test.ts
// Unit test for the Semgrep fixture self-test assertion core. The pure
// assertExpectedFindings() is tested against canned Semgrep `results` payloads
// (no Semgrep invocation here); the real scan runs in CI. Covers: both rules
// fire (pass), a single-rule break (fail), and clean.ts over-match (fail).
import { describe, expect, it } from 'vitest';
import { assertExpectedFindings, EXPECTED_RULES } from '../check-semgrep-fixture.mjs';

const f = (path: string, check_id: string) => ({ path, check_id });
const CMD = '.semgrep.owasp-top-ten.child-process-shell-injection';
const SECRET = '.semgrep.secrets.hardcoded-stripe-secret-key';

describe('EXPECTED_RULES', () => {
  it('names both vendored rule ids', () => {
    expect(EXPECTED_RULES).toEqual([
      'child-process-shell-injection',
      'hardcoded-stripe-secret-key',
    ]);
  });
});

describe('assertExpectedFindings', () => {
  it('passes when both rules fire on vulnerable.ts and clean.ts is quiet', () => {
    const results = [f('/tmp/x/vulnerable.ts', CMD), f('/tmp/x/vulnerable.ts', SECRET)];
    expect(assertExpectedFindings(results)).toEqual({ ok: true });
  });

  it('fails naming the missing rule when the secret rule did not fire', () => {
    const results = [f('/tmp/x/vulnerable.ts', CMD)];
    const v = assertExpectedFindings(results);
    expect(v.ok).toBe(false);
    expect(v.ok === false && v.reason).toContain('hardcoded-stripe-secret-key');
  });

  it('fails naming clean.ts when a rule over-matches the clean fixture', () => {
    const results = [
      f('/tmp/x/vulnerable.ts', CMD),
      f('/tmp/x/vulnerable.ts', SECRET),
      f('/tmp/x/clean.ts', CMD),
    ];
    const v = assertExpectedFindings(results);
    expect(v.ok).toBe(false);
    expect(v.ok === false && v.reason).toContain('clean.ts');
  });
});
