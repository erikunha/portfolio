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
  mayNameTheComment,
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

  it.each([
    ['bare key', 'paths'],
    ['quoted key', '"paths"'],
  ])('rejects a %s `paths` inside an allowlist -- the parse normalizes the spelling, the key is rejected', (_label, key) => {
    expect(
      shape(
        `title = "x"\n[extend]\nuseDefault = true\n[[allowlists]]\ndescription = "y"\n${key} = ['''.*''']\n`,
      ).ok,
      'A quoted key parses to the same object key as the bare key, so both are an unrecognized allowlist key and rejected. `paths` exempts the file from EVERY rule; a path-scoped entry evades the probe, so the shape check is what catches it. (The old fixtures put `useDefault` at top level, so they short-circuited on an unknown-top-level-key rejection and never reached this branch.)',
    ).toBe(false);
  });

  it('rejects a dotted-key `allowlist.paths` (parses to the single [allowlist] table spelling)', () => {
    expect(
      shape(`title = "x"\n[extend]\nuseDefault = true\nallowlist.paths = ['''.*''']\n`).ok,
      'A dotted key builds a single [allowlist] table carrying a `paths` key; the parse sees it exactly as [allowlist]\\npaths=, so the allow-schema rejects it. gitleaks honors this spelling to exempt a file from every rule.',
    ).toBe(false);
  });

  it.each([
    [
      'under [extend]',
      'title = "x"\n[extend]\nuseDefault = true\ndisabledRules = ["anthropic-api-key"]\n',
    ],
    ['at top level', 'disabledRules = ["anthropic-api-key"]\n[extend]\nuseDefault = true\n'],
    [
      'dotted extend.disabledRules',
      'extend.useDefault = true\nextend.disabledRules = ["anthropic-api-key"]\n',
    ],
  ])('rejects disabledRules %s, which the probe cannot see', (_label, config) => {
    expect(
      shape(config).ok,
      'The probe only proves ONE rule still fires. Disabling every OTHER class leaves the probe green while the scanner is dead for the credentials this repo actually holds. disabledRules is not permitted under [extend] or at top level, so every spelling that parses to it is rejected.',
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

describe('assertConfigShape via TOML parse (residual neutering the regex denylist missed — #25)', () => {
  const shape = (config: string) => assertConfigShape(config, NO_IGNORE_FILE, NO_ALLOW_COMMENTS);
  const BASE = 'title = "x"\n[extend]\nuseDefault = true\n';

  it('rejects a `stopwords` allowlist, which drops any finding whose context contains the word', () => {
    expect(
      shape(`${BASE}[[allowlists]]\ndescription = "y"\nstopwords = ["AKIA"]\n`).ok,
      'A stopword silently drops every finding whose surrounding line contains it, neutering a whole credential class (here, AWS keys). The github-pat probe never exercises that class, so nothing else notices. Only an allow-schema that rejects every unknown allowlist key catches it — the regex denylist has no pattern for `stopwords`.',
    ).toBe(false);
  });

  it('rejects a `commits` allowlist, which exempts specific commit SHAs from every rule', () => {
    expect(
      shape(
        `${BASE}[[allowlists]]\ndescription = "y"\ncommits = ["deadbeefdeadbeefdeadbeefdeadbeefdeadbeef"]\n`,
      ).ok,
      'A commits allowlist exempts named commits from detection entirely — a real secret introduced in that commit is invisible forever. The probe scans a freshly-assembled token, never a historical commit, so it cannot see this.',
    ).toBe(false);
  });

  it('rejects a `regexTarget` allowlist, which widens what the allowlist regex matches against', () => {
    expect(
      shape(`${BASE}[[allowlists]]\ndescription = "y"\nregexes = ['''x''']\nregexTarget = "line"\n`)
        .ok,
      'regexTarget switches matching from the secret value to the whole line or match, turning a narrow `regexes` entry into a broad line-level exemption. It is not a key the denylist ever checked.',
    ).toBe(false);
  });

  it('rejects a top-level [[rules]] block, which can add or reshape a rule', () => {
    expect(
      shape(`${BASE}[[rules]]\nid = "x"\nregex = '''x'''\n`).ok,
      'A [[rules]] block lets the config define custom rules alongside the defaults; a permissive custom rule or a shadowed default weakens detection. The regex denylist never checked for it; the allow-schema rejects any top-level key that is not title/extend/allowlists.',
    ).toBe(false);
  });

  it('rejects [extend].path, which layers in an external config that can disable rules', () => {
    expect(
      shape('title = "x"\n[extend]\nuseDefault = true\npath = "other.toml"\n').ok,
      'extend.path pulls in another config whose disabledRules/allowlists this file never shows — the disabling lives in a file this gate does not read. Only `useDefault` is a permitted extend key.',
    ).toBe(false);
  });

  it('rejects [extend].url, the remote variant of extend.path', () => {
    expect(
      shape('title = "x"\n[extend]\nuseDefault = true\nurl = "https://example.com/c.toml"\n').ok,
    ).toBe(false);
  });

  it('rejects an unknown top-level key — fail-closed on anything outside the schema', () => {
    expect(
      shape(`${BASE}future_neuter = true\n`).ok,
      'This is the whole point of an allow-schema over a denylist: a neutering key nobody has thought of yet is rejected by default because it is not on the allow-list, instead of slipping through until someone writes a pattern for it.',
    ).toBe(false);
  });

  it('rejects an unknown key inside an allowlist — fail-closed at the allowlist level too', () => {
    expect(
      shape(`${BASE}[[allowlists]]\ndescription = "y"\nregexes = ['''x''']\nfuture_neuter = true\n`)
        .ok,
    ).toBe(false);
  });

  it('rejects a malformed TOML config rather than passing it as well-shaped', () => {
    expect(
      shape('this is [ not valid = toml').ok,
      'The regex denylist silently passed unparseable config: none of its patterns matched, so it returned ok:true. A parse fails closed — an unreadable config is not a well-shaped one.',
    ).toBe(false);
  });

  it('accepts a legitimate `condition` key on an allowlist (does not false-fail a valid config)', () => {
    expect(
      shape(`${BASE}[[allowlists]]\ndescription = "y"\nregexes = ['''x''']\ncondition = "OR"\n`).ok,
      'condition/matchCondition only govern how regexes and paths combine; with paths independently rejected they cannot neuter anything, so the schema permits them rather than rejecting an otherwise-valid config.',
    ).toBe(true);
  });

  it('accepts a legitimate `matchCondition` key (the other permitted combinator, must not false-fail)', () => {
    expect(
      shape(
        `${BASE}[[allowlists]]\ndescription = "y"\nregexes = ['''x''']\nmatchCondition = "AND"\n`,
      ).ok,
      'matchCondition is in the allow-set alongside condition; without a positive test a future tightening that dropped it would silently start false-failing valid configs.',
    ).toBe(true);
  });

  it('rejects a single-table [allowlists] hiding a paths key -- the confirmed fail-open bypass', () => {
    expect(
      shape(`${BASE}[allowlists]\npaths = ['''.*sanitize.*''']\n`).ok,
      'CONFIRMED against gitleaks 8.30: [allowlists] written as a single table (plural name, object value) is HONORED -- its paths suppressed a real ghp_ token (0 findings, exit 0). The parse gives `allowlists` a non-array value; coercing that to "no allowlists" (Array.isArray ? x : []) skipped the paths key entirely, re-opening the exact laundering class this gate exists to close. The gate must fail closed on a non-array allowlists.',
    ).toBe(false);
  });

  it('rejects a top-level `allowlists` that is an array of non-tables', () => {
    expect(shape('title = "x"\nallowlists = ["x"]\n[extend]\nuseDefault = true\n').ok).toBe(false);
  });

  it('rejects a scalar top-level `allowlist` value (Object.keys(5) is [], which would fail open)', () => {
    expect(shape('allowlist = 5\n[extend]\nuseDefault = true\n').ok).toBe(false);
  });

  it('rejects a dangerous key nested under an allowed one (condition = { paths })', () => {
    expect(
      shape(`${BASE}[[allowlists]]\ndescription = "y"\ncondition = { paths = ['''.*'''] }\n`).ok,
      'A keys-only check sees only `condition` (allowed) and passes. Validating the VALUE type (condition must be a string) rejects a table smuggled under an allowed key, rather than leaning on gitleaks erroring on the type mismatch.',
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

describe('mayNameTheComment (only the machinery may spell the banned phrase, exactly)', () => {
  it.each([
    'scripts/check-gitleaks-fixture.mjs',
    'scripts/gitleaks-staged.mjs',
  ])('%s is allowed to name the phrase', (file) => {
    expect(mayNameTheComment(file)).toBe(true);
  });

  it.each([
    'scripts/gitleaks-staged.mjs.bak',
    'scripts/gitleaks-staged.mjs~',
    'scripts/check-gitleaks-fixture.mjs.orig',
    'lib/somewhere.ts',
  ])('%s is NOT allowed -- a prefix must not re-exempt a suffixed or unrelated file', (file) => {
    expect(
      mayNameTheComment(file),
      `The source files are matched EXACTLY. A startsWith prefix would let a committed backup (.bak/.orig/~) carry the ${SUPPRESSION_COMMENT} suppression comment past this gate -- the same "a prefix exempts more than intended" bypass this PR closed for .gitleaks.toml.`,
    ).toBe(false);
  });
});
