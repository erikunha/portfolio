import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  assertConfigShape,
  assertExpectedFindings,
  CLEAN_FIXTURE,
  EXPECTED_RULES,
  interpretGitleaksRun,
  LEAKY_FIXTURE,
} from '../check-gitleaks-fixture.mjs';

const REAL_CONFIG = readFileSync(path.resolve(__dirname, '..', '..', '.gitleaks.toml'), 'utf-8');
const NO_IGNORE_FILE = false;
const NO_ALLOW_COMMENTS: string[] = [];

// Assembled, never spelled out: the gate greps the tree for this literal, so a test file that
// names it reds the gate on itself. That is not hypothetical -- it happened, and CI caught it
// before these unit tests did, because they call assertConfigShape with synthetic arguments and
// never exercise the real tree scan.
const SUPPRESSION_COMMENT = ['gitleaks', 'allow'].join(':');

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

  it('gitleaks failing to spawn is a FAILURE, and the reason names the cause', () => {
    const verdict = run({ error: new Error('spawnSync gitleaks ENOENT'), status: null });
    expect(verdict.ok, FAIL_CLOSED).toBe(false);
    expect(
      verdict.reason,
      'The reason is the only thing anyone reads when this reds in CI. Asserting only `ok` lets the did-not-run branch be deleted silently: the result then falls through to the unknown-exit-code branch, which is also ok:false, so no test notices — while the message degrades to "exited null", which names nothing.',
    ).toContain('ENOENT');
  });

  it('gitleaks killed by a signal is a FAILURE, and the reason does not just say null', () => {
    const verdict = run({ status: null });
    expect(verdict.ok, FAIL_CLOSED).toBe(false);
    expect(
      verdict.reason,
      'spawnSync reports status=null for BOTH a missing binary and a signal-killed child. A reason that renders "null" has told the reader nothing about which one happened.',
    ).not.toContain('null');
  });

  it('an unknown exit code is a FAILURE, never silently treated as clean', () => {
    expect(
      run({ status: FATAL, stderr: 'fatal: config is invalid' }).ok,
      `${FAIL_CLOSED}\n\nExit ${FATAL} is neither ${NO_LEAKS} (clean) nor ${LEAKS_FOUND} (leaks found). A malformed .gitleaks.toml exits non-zero, and mapping that onto "clean" is exactly how a broken gate goes green.`,
    ).toBe(false);
  });
});

describe('assertConfigShape (the config cannot be quietly gutted)', () => {
  const shape = (config: string, ignoreFile = NO_IGNORE_FILE, comments = NO_ALLOW_COMMENTS) =>
    assertConfigShape(config, ignoreFile, comments);

  it('the repo config as committed is accepted', () => {
    expect(
      shape(REAL_CONFIG).ok,
      '.gitleaks.toml itself violates the shape this gate requires.',
    ).toBe(true);
  });

  it('rejects a `paths` allowlist, because it exempts the file from EVERY rule', () => {
    expect(
      shape(`${REAL_CONFIG}\n[[allowlists]]\npaths = ['''.*''']\n`).ok,
      `Measured on gitleaks 8.30: a "paths" entry exempts that file from every rule, making it a permanent secret-laundering path. Three files in this repo were exempt from everything — including a test suite full of real-shaped tokens — and the probe could not see it, because the probe scans a token in a temp dir that no repo path regex matches. This is the assertion that catches it.`,
    ).toBe(false);
  });

  it('rejects an INLINE-TABLE `paths` allowlist, which is valid TOML and a working bypass', () => {
    const inlineTable = `title = "x"\nallowlists = [\n  { description = "y", paths = ['''.*sanitize-secrets.*'''] },\n]\n[extend]\nuseDefault = true\n`;
    expect(
      shape(inlineTable).ok,
      `A line-anchored check only sees the block form. gitleaks 8.30 honours the inline-table form too, and it was a WORKING exploit: config accepted, probe green, and a real ghp_ token in the named file suppressed entirely -- 0 findings, exit 0, "clean". The probe cannot catch it either, because the probe writes its token to a temp dir that no repo-path regex matches. Both defences missed.`,
    ).toBe(false);
  });

  it('rejects disabled rules, which the probe cannot see', () => {
    expect(
      shape(`${REAL_CONFIG}\ndisabledRules = ["anthropic-api-key"]\n`).ok,
      'The probe only proves ONE rule still fires. Disabling every OTHER class leaves the probe green while the scanner is dead for the credentials this repo actually holds.',
    ).toBe(false);
  });

  it('rejects a config that drops the default ruleset', () => {
    expect(shape(REAL_CONFIG.replace('useDefault = true', 'useDefault = false')).ok).toBe(false);
  });

  it('rejects a .gitleaksignore file', () => {
    expect(
      shape(REAL_CONFIG, true).ok,
      'gitleaks silently skips every fingerprint listed in .gitleaksignore, and nothing else in this gate would notice.',
    ).toBe(false);
  });

  it('rejects a suppression comment in the tree', () => {
    expect(
      shape(REAL_CONFIG, NO_IGNORE_FILE, ['lib/somewhere.ts']).ok,
      `The ${SUPPRESSION_COMMENT} comment makes gitleaks skip the line, with no record of why. It is the cheapest way to make this whole gate lie, and it is the first thing a blocked developer reaches for.\n\nNote this test does not spell that comment out literally: the gate greps the tree for it, and a test file naming it would red the gate on itself — which is exactly what happened, and what the CI job caught before the unit tests did.`,
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
