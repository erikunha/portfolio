// scripts/__tests__/check-semgrep-fixture.test.ts
// Unit tests for the Semgrep fixture self-test. The pure cores are tested
// against canned payloads (no Semgrep invocation here); the real scan runs in
// CI. Covers: assertExpectedFindings (both rules fire / single-rule break /
// clean over-match), interpretSemgrepRun (run-failure, unparseable, semgrep
// errors[] -> infra, healthy), decideExit (infra/regression/ok exit mapping),
// and run() always removing its temp dir (process.exit must not skip cleanup).
import { readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { describe, expect, it } from 'vitest';
import {
  assertExpectedFindings,
  decideExit,
  EXPECTED_RULES,
  interpretSemgrepRun,
  run,
} from '../check-semgrep-fixture.mjs';

const f = (path: string, check_id: string) => ({ path, check_id });
const CMD = '.semgrep.owasp-top-ten.child-process-shell-injection';
const SECRET = '.semgrep.secrets.hardcoded-stripe-secret-key';
// A healthy scan: both vendored rules fire on vulnerable.ts, clean.ts quiet.
const BOTH = [f('/t/vulnerable.ts', CMD), f('/t/vulnerable.ts', SECRET)];
const noop = () => undefined;

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
    expect(assertExpectedFindings(BOTH)).toEqual({ ok: true });
  });

  it('fails naming the missing rule when the secret rule did not fire', () => {
    const v = assertExpectedFindings([f('/t/vulnerable.ts', CMD)]);
    expect(v.ok).toBe(false);
    expect(v.ok === false && v.reason).toContain('hardcoded-stripe-secret-key');
  });

  it('fails naming clean.ts when a rule over-matches the clean fixture', () => {
    const v = assertExpectedFindings([...BOTH, f('/t/clean.ts', CMD)]);
    expect(v.ok).toBe(false);
    expect(v.ok === false && v.reason).toContain('clean.ts');
  });
});

describe('interpretSemgrepRun', () => {
  it('reports infra when the process failed to spawn', () => {
    const v = interpretSemgrepRun({ error: { message: 'ENOENT' }, status: null, stdout: '' });
    expect(v.ok).toBe(false);
    expect(v.ok === false && v.reason).toContain('failed to run');
  });

  it('reports infra when stdout is not valid JSON', () => {
    const v = interpretSemgrepRun({ status: 1, stdout: 'not json', stderr: 'boom' });
    expect(v.ok).toBe(false);
    expect(v.ok === false && v.reason).toContain('unparseable');
  });

  it('reports infra (not a rule regression) when semgrep emits scan errors', () => {
    // Semgrep can exit non-zero yet write valid JSON with a populated errors[]
    // on a runtime failure. That must surface as INFRA, not RULE REGRESSION.
    const stdout = JSON.stringify({ results: [], errors: [{ message: 'parse failure' }] });
    const v = interpretSemgrepRun({ status: 2, stdout });
    expect(v.ok).toBe(false);
    expect(v.ok === false && v.reason).toContain('scan error');
    expect(v.ok === false && v.reason).toContain('parse failure');
  });

  it('passes through the parsed json on a healthy run (findings present, exit 1, no errors)', () => {
    const json = { results: BOTH, errors: [] };
    const v = interpretSemgrepRun({ status: 1, stdout: JSON.stringify(json) });
    expect(v.ok).toBe(true);
    expect(v.ok === true && v.json.results).toHaveLength(2);
  });
});

describe('decideExit', () => {
  it('maps an infra scan to exit code 2', () => {
    const d = decideExit({ ok: false, reason: 'semgrep failed to run: ENOENT' });
    expect(d).toMatchObject({ code: 2, level: 'INFRA' });
    expect(d.message).toContain('ENOENT');
  });

  it('maps a rule regression to exit code 1', () => {
    const d = decideExit({ ok: true, json: { results: [f('/t/vulnerable.ts', CMD)] } });
    expect(d).toMatchObject({ code: 1, level: 'RULE REGRESSION' });
    expect(d.message).toContain('hardcoded-stripe-secret-key');
  });

  it('maps a healthy scan to exit code 0', () => {
    const d = decideExit({ ok: true, json: { results: BOTH } });
    expect(d).toMatchObject({ code: 0, level: 'OK' });
  });
});

describe('run', () => {
  const existing = () =>
    new Set(readdirSync(tmpdir()).filter((d) => d.startsWith('semgrep-selftest-')));

  it('removes its temp dir and propagates the exit code on a healthy run', () => {
    const before = existing();
    let exited: number | undefined;
    run({
      runner: () => ({ ok: true, json: { results: BOTH } }),
      exit: (c: number) => {
        exited = c;
      },
      log: noop,
      err: noop,
    });
    const leaked = [...existing()].filter((d) => !before.has(d));
    expect(leaked).toEqual([]);
    expect(exited).toBe(0);
  });

  it('still removes its temp dir when the scan fails (process.exit must not skip cleanup)', () => {
    const before = existing();
    let exited: number | undefined;
    run({
      runner: () => ({ ok: false, reason: 'semgrep failed to run: ENOENT' }),
      exit: (c: number) => {
        exited = c;
      },
      log: noop,
      err: noop,
    });
    const leaked = [...existing()].filter((d) => !before.has(d));
    expect(leaked).toEqual([]);
    expect(exited).toBe(2);
  });
});
