import { describe, expect, it } from 'vitest';
import {
  assertExpectedFindings,
  CLEAN_FIXTURE,
  EXPECTED_RULES,
  interpretGitleaksRun,
  LEAKY_FIXTURE,
} from '../check-gitleaks-fixture.mjs';

const NO_LEAKS = 0;
const LEAKS_FOUND = 1;
const FATAL = 2;

const run = (over: Partial<Parameters<typeof interpretGitleaksRun>[0]>) =>
  interpretGitleaksRun({ status: LEAKS_FOUND, stderr: '', ...over });

const FAIL_CLOSED =
  'This is the whole fail-closed defence of the secret gate. If any of these branches returns ok:true, CI reports "no secrets" for a scan that never happened, or never fired — which reads identically to a clean tree and is the one failure this job exists to make impossible.';

describe('interpretGitleaksRun (the gate cannot read clean unless gitleaks really scanned)', () => {
  it('a scanner that found the planted secret is the only accepted outcome', () => {
    expect(run({ status: LEAKS_FOUND }).ok).toBe(true);
  });

  it('gitleaks finding NOTHING in the bait fixture is a FAILURE, not a pass', () => {
    const verdict = run({ status: NO_LEAKS });
    expect(
      verdict.ok,
      `${FAIL_CLOSED}\n\nExit ${NO_LEAKS} here means gitleaks ran and saw nothing in a file that plants a real ${EXPECTED_RULES.join(', ')} token. The scanner is not firing, so a green scan of the real tree proves nothing.`,
    ).toBe(false);
  });

  it('gitleaks failing to spawn is a FAILURE', () => {
    expect(
      run({ error: new Error('spawnSync gitleaks ENOENT'), status: null }).ok,
      FAIL_CLOSED,
    ).toBe(false);
  });

  it('gitleaks killed by a signal is a FAILURE', () => {
    expect(run({ status: null }).ok, FAIL_CLOSED).toBe(false);
  });

  it('an unknown exit code is a FAILURE, never silently treated as clean', () => {
    expect(
      run({ status: FATAL, stderr: 'fatal: config is invalid' }).ok,
      `${FAIL_CLOSED}\n\nExit ${FATAL} is neither ${NO_LEAKS} (clean) nor ${LEAKS_FOUND} (leaks found). A malformed .gitleaks.toml exits non-zero, and mapping that onto "clean" is exactly how a broken gate goes green.`,
    ).toBe(false);
  });
});

describe('assertExpectedFindings (the bait must fire, the clean fixture must not)', () => {
  const leaky = EXPECTED_RULES.map((RuleID) => ({ File: `/tmp/x/${LEAKY_FIXTURE}`, RuleID }));
  const ANY_EXPECTED_RULE = EXPECTED_RULES[0] ?? '';

  it('accepts the expected rule firing on the leaky fixture and nothing on the clean one', () => {
    expect(assertExpectedFindings(leaky).ok).toBe(true);
  });

  it('rejects an empty finding set', () => {
    expect(assertExpectedFindings([]).ok).toBe(false);
  });

  it('rejects the expected rule not firing on the leaky fixture', () => {
    expect(
      assertExpectedFindings([{ File: `/tmp/x/${LEAKY_FIXTURE}`, RuleID: 'some-other-rule' }]).ok,
      'If the rule named in EXPECTED_RULES stops firing -- renamed upstream, dropped from the default set, or the planted token no longer matches it -- the real scan silently stops covering that class of secret. This is what notices.',
    ).toBe(false);
  });

  it('rejects any finding on the clean fixture', () => {
    expect(
      assertExpectedFindings([
        ...leaky,
        { File: `/tmp/x/${CLEAN_FIXTURE}`, RuleID: ANY_EXPECTED_RULE },
      ]).ok,
      'A scanner that fires on code with no secret in it trains people to ignore it, and an ignored gate is a disabled gate.',
    ).toBe(false);
  });
});
