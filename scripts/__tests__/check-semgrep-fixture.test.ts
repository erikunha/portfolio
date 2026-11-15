import { readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { describe, expect, it } from 'vitest';
import {
  assertExpectedFindings,
  decideExit,
  EXPECTED_RULES,
  run,
} from '../gates/check-semgrep-fixture.ts';

const f = (path: string, check_id: string) => ({ path, check_id });
const CMD = '.semgrep.owasp-top-ten.child-process-shell-injection';
const SECRET = '.semgrep.secrets.hardcoded-anthropic-api-key';
const BOTH = [f('/t/vulnerable.ts', CMD), f('/t/vulnerable.ts', SECRET)];
const noop = () => undefined;

describe('EXPECTED_RULES', () => {
  it('names both vendored rule ids', () => {
    expect(EXPECTED_RULES).toEqual([
      'child-process-shell-injection',
      'hardcoded-anthropic-api-key',
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
    expect(v.ok === false && v.reason).toContain('hardcoded-anthropic-api-key');
  });

  it('fails naming clean.ts when a rule over-matches the clean fixture', () => {
    const v = assertExpectedFindings([...BOTH, f('/t/clean.ts', CMD)]);
    expect(v.ok).toBe(false);
    expect(v.ok === false && v.reason).toContain('clean.ts');
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
    expect(d.message).toContain('hardcoded-anthropic-api-key');
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

  it('classifies a thrown exception as INFRA (exit 2) and still removes its temp dir', () => {
    const before = existing();
    let exited: number | undefined;
    let logged = '';
    run({
      runner: () => {
        throw new Error('fixture missing');
      },
      exit: (c: number) => {
        exited = c;
      },
      log: noop,
      err: (m: string) => {
        logged = m;
      },
    });
    const leaked = [...existing()].filter((d) => !before.has(d));
    expect(leaked).toEqual([]);
    expect(exited).toBe(2);
    expect(logged).toContain('INFRA');
    expect(logged).toContain('fixture missing');
  });
});
