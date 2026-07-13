#!/usr/bin/env node

export const EXPECTED_RULES = ['github-pat'];
export const LEAKY_FIXTURE = 'leaky.ts';
export const CLEAN_FIXTURE = 'clean.ts';

const NO_LEAKS = 0;
const LEAKS_FOUND = 1;

export function interpretGitleaksRun(res) {
  if (res.error || res.status === null) {
    return {
      ok: false,
      reason: `gitleaks did not run (${res.error?.message ?? 'killed by a signal'}). A scanner that never ran reports zero leaks, which is indistinguishable from a clean tree.`,
    };
  }
  if (res.status !== NO_LEAKS && res.status !== LEAKS_FOUND) {
    return {
      ok: false,
      reason: `gitleaks exited ${res.status}, which is neither ${NO_LEAKS} (no leaks) nor ${LEAKS_FOUND} (leaks found): ${String(res.stderr).trim()}`,
    };
  }
  if (res.status === NO_LEAKS) {
    return {
      ok: false,
      reason: `gitleaks ran and found NOTHING in a fixture that plants a real ${EXPECTED_RULES.join(', ')} secret. The scanner is not firing, so a green secret-scan on the real tree would mean nothing.`,
    };
  }
  return { ok: true };
}

// The step-2 probe below proves the config still catches a github-pat. It CANNOT prove the
// config is otherwise intact: `disabledRules`, a stopword, or a `paths` entry scoped to a real
// repo path all leave the probe green while gutting the scanner, so they are checked as shape
// below. One vector is caught by NEITHER mechanism and this gate does not claim to hold it: a
// `regexes` allowlist scoped to a credential class the probe never tests (e.g. an AWS-key pattern)
// is a permitted shape AND invisible to a github-pat-only probe. Closing it means widening the
// probe to a second class -- tracked separately; see DECISIONS.md 2026-07-13.
//
// The shape is validated as an allow-schema over the PARSED TOML (not a denylist over the raw
// text, which TOML's equivalent spellings defeat); see DECISIONS.md 2026-07-13.
const ALLOWED_TOP_LEVEL = new Set(['title', 'extend', 'allowlists', 'allowlist']);
const ALLOWED_EXTEND = new Set(['useDefault']);
// Each permitted allowlist key with its required value type. Validating the VALUE, not just the key
// name, stops a dangerous key hiding nested under an allowed one (e.g. `condition = { paths }`) and
// removes any reliance on gitleaks erroring on a type it did not expect. condition/matchCondition
// only combine regexes with paths, and paths is rejected, so they cannot neuter anything.
const ALLOWLIST_KEY_TYPES = {
  description: (value) => typeof value === 'string',
  regexes: (value) => Array.isArray(value) && value.every((entry) => typeof entry === 'string'),
  condition: (value) => typeof value === 'string',
  matchCondition: (value) => typeof value === 'string',
};
const ALLOWED_ALLOWLIST = new Set(Object.keys(ALLOWLIST_KEY_TYPES));

const isPlainObject = (value) =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const firstUnknownKey = (obj, allowed) => Object.keys(obj).find((key) => !allowed.has(key));

export function assertConfigShape(config, hasIgnoreFile, allowComments) {
  let parsed;
  try {
    parsed = parseToml(config);
  } catch (error) {
    const detail = error instanceof TomlError ? error.message : String(error);
    return {
      ok: false,
      reason: `the gitleaks config is not parseable TOML (${detail}). An unreadable config is not a well-shaped one, so this fails closed -- unlike the text-regex check it replaced, which matched none of its patterns on garbage and reported it as clean.`,
    };
  }

  const unknownTop = firstUnknownKey(parsed, ALLOWED_TOP_LEVEL);
  if (unknownTop !== undefined) {
    return {
      ok: false,
      reason: `the gitleaks config has an unrecognized top-level key \`${unknownTop}\`. Only ${[...ALLOWED_TOP_LEVEL].join(', ')} are permitted. A [[rules]] block, a top-level disabledRules list, or any future neutering key lands here and is rejected by default -- that is the allow-schema catching what a denylist could not.`,
    };
  }

  const extend = parsed.extend;
  if (extend === undefined || extend.useDefault !== true) {
    return {
      ok: false,
      reason:
        'the gitleaks config does not set `[extend] useDefault = true`. Without the default ruleset there is almost nothing left to detect, and the probe below would still pass on whatever remains.',
    };
  }
  const unknownExtend = firstUnknownKey(extend, ALLOWED_EXTEND);
  if (unknownExtend !== undefined) {
    return {
      ok: false,
      reason: `[extend] has an unrecognized key \`${unknownExtend}\`. Only \`useDefault\` is permitted: \`path\`/\`url\` layer in an external config whose disabling this gate never reads, and \`disabledRules\` silently drops rule classes the probe cannot see.`,
    };
  }

  // [allowlist] (a single table) and [[allowlists]] (an array of tables) are both valid gitleaks.
  // Fail CLOSED on any other shape: a present-but-non-array `allowlists` is the [allowlists]
  // single-table spelling, which gitleaks HONORS (measured on 8.30, its paths suppressed a real
  // secret) -- coercing it to "no allowlists" would skip validating a paths/stopwords key inside it.
  if (parsed.allowlists !== undefined && !Array.isArray(parsed.allowlists)) {
    return {
      ok: false,
      reason:
        '`allowlists` is present but not an array of tables. gitleaks honors a single [allowlists] table, so skipping it would leave a paths/stopwords key inside it unvalidated -- fail closed. Use [[allowlists]].',
    };
  }
  if (parsed.allowlist !== undefined && !isPlainObject(parsed.allowlist)) {
    return { ok: false, reason: '`allowlist` is present but is not a single [allowlist] table.' };
  }
  const allowlists = [
    ...(parsed.allowlists ?? []),
    ...(parsed.allowlist !== undefined ? [parsed.allowlist] : []),
  ];
  for (const entry of allowlists) {
    if (!isPlainObject(entry)) {
      return { ok: false, reason: 'a gitleaks allowlist entry is not a table.' };
    }
    const unknownAllow = firstUnknownKey(entry, ALLOWED_ALLOWLIST);
    if (unknownAllow !== undefined) {
      return {
        ok: false,
        reason: `a gitleaks allowlist uses \`${unknownAllow}\`, which is not one of ${[...ALLOWED_ALLOWLIST].join(', ')}. The dangerous allowlist keys all land here: \`paths\` exempts a file from EVERY rule (a permanent secret-laundering path), \`stopwords\` drops findings by surrounding text, \`commits\` exempts commit SHAs, \`regexTarget\` widens what the regex matches. Allowlist the VALUE with \`regexes\` instead.`,
      };
    }
    for (const [key, value] of Object.entries(entry)) {
      if (!ALLOWLIST_KEY_TYPES[key](value)) {
        return {
          ok: false,
          reason: `the gitleaks allowlist key \`${key}\` has the wrong value type. Value types are validated so a dangerous key cannot hide nested under an allowed one (e.g. \`condition = { paths }\`).`,
        };
      }
    }
  }

  if (hasIgnoreFile) {
    return {
      ok: false,
      reason:
        'a .gitleaksignore file exists. gitleaks silently skips every fingerprint listed there, and nothing else in this gate would notice. Fix the finding or allowlist the value in .gitleaks.toml, where the reason is reviewable.',
    };
  }
  if (allowComments.length > 0) {
    return {
      ok: false,
      reason: `"gitleaks:allow" appears in ${allowComments.join(', ')}. That comment makes gitleaks skip the line, with no record of why and nothing gating it. It is the cheapest way to make this whole gate lie. Allowlist the value in .gitleaks.toml instead.`,
    };
  }
  return { ok: true };
}

export function assertExpectedFindings(findings) {
  const byFile = new Map();
  for (const finding of findings) {
    const base = String(finding.File ?? '')
      .split('/')
      .pop();
    if (!byFile.has(base)) byFile.set(base, []);
    byFile.get(base).push(String(finding.RuleID ?? ''));
  }

  const leakyRules = byFile.get(LEAKY_FIXTURE) ?? [];
  for (const rule of EXPECTED_RULES) {
    if (!leakyRules.includes(rule)) {
      return {
        ok: false,
        reason: `${LEAKY_FIXTURE} did not trigger the expected rule "${rule}" (found: ${leakyRules.join(', ') || 'none'}). Either the rule was removed from the config, or the planted secret no longer matches it — in both cases the real scan is no longer proven to detect this class.`,
      };
    }
  }

  const cleanRules = byFile.get(CLEAN_FIXTURE) ?? [];
  if (cleanRules.length > 0) {
    return {
      ok: false,
      reason: `${CLEAN_FIXTURE} produced ${cleanRules.length} finding(s), expected 0: ${cleanRules.join(', ')}. A scanner that fires on clean code trains people to ignore it.`,
    };
  }

  return { ok: true };
}

import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parse as parseToml, TomlError } from 'smol-toml';

const FIXTURE_DIR = 'tests/fixtures/gitleaks';
const REPO_CONFIG = '.gitleaks.toml';
const REPORT_FILE = 'gitleaks-fixture.json';
const PROBE_FILE = 'config-probe.ts';
const GITLEAKS_BIN = process.env.GITLEAKS_BIN ?? 'gitleaks';

// Assembled at runtime so the literal never appears in this file — otherwise the repo scan
// would flag this script. It is NOT the token .gitleaks.toml allowlists: the whole point of
// the probe below is to scan a secret the repo config does not exempt.
const PROBE_TOKEN = ['ghp', 'Pr0beNotAllowlisted0123456789abcdefg'].join('_');

// GITLEAKS_CONFIG is honoured even with no --config flag, so the default-rules pass below
// would silently become "whatever that env var points at". Strip it rather than assume.
function scannerEnv() {
  const env = { ...process.env };
  delete env.GITLEAKS_CONFIG;
  return env;
}

function scan(dir, report, configPath) {
  const args = [
    'dir',
    dir,
    '--no-banner',
    '--redact',
    '--report-format',
    'json',
    '--report-path',
    report,
  ];
  if (configPath !== undefined) args.push('--config', configPath);
  return spawnSync(GITLEAKS_BIN, args, { encoding: 'utf8', env: scannerEnv() });
}

const GITLEAKS_IGNORE = '.gitleaksignore';
const ALLOW_COMMENT = 'gitleaks:allow';

// These files NAME the suppression comment in order to ban it or explain the ban. They do not
// use it. Everything else that contains the string is suppressing a gitleaks finding, which is
// what this refuses.
//
// The two source files are matched EXACTLY, not by prefix. A prefix would re-exempt any file
// whose name merely starts with one of them -- e.g. a committed `scripts/gitleaks-staged.mjs.bak`
// or `.orig` -- letting it carry `gitleaks:allow` unnoticed. That is the same "a prefix exempts
// more than intended" bypass this PR closed for .gitleaks.toml's allowlists; it must not come
// back through this list. Only the docs directory is a genuine prefix.
const MAY_NAME_THE_COMMENT_FILES = [
  'scripts/check-gitleaks-fixture.mjs',
  'scripts/gitleaks-staged.mjs',
];
const MAY_NAME_THE_COMMENT_DIRS = ['docs/superpowers/plans/'];

export function mayNameTheComment(file) {
  return (
    MAY_NAME_THE_COMMENT_FILES.includes(file) ||
    MAY_NAME_THE_COMMENT_DIRS.some((dir) => file.startsWith(dir))
  );
}

const GREP_MATCHED = 0;
const GREP_NO_MATCH = 1;

function trackedFilesContaining(needle) {
  const listed = spawnSync('git', ['grep', '-l', '--fixed-strings', needle, '--', '.'], {
    encoding: 'utf8',
  });
  // git grep exits 1 for "no match" and >=2 for an error, and BOTH produce empty stdout. Reading
  // stdout alone makes a broken git indistinguishable from a clean tree -- the same fail-open
  // this file exists to forbid, in the function that enforces the ban.
  if (listed.status !== GREP_MATCHED && listed.status !== GREP_NO_MATCH) {
    throw new Error(
      `git grep could not scan the tree for suppression comments (exit ${listed.status}): ${String(listed.stderr ?? listed.error?.message).trim()}. Empty output from a FAILED grep looks exactly like a clean tree, so this refuses rather than reporting one.`,
    );
  }
  return String(listed.stdout ?? '')
    .split('\n')
    .filter((file) => file !== '')
    .filter((file) => !mayNameTheComment(file));
}

function main() {
  const shape = assertConfigShape(
    readFileSync(REPO_CONFIG, 'utf8'),
    existsSync(GITLEAKS_IGNORE),
    trackedFilesContaining(ALLOW_COMMENT),
  );
  if (!shape.ok) {
    console.error(`[check-gitleaks-fixture] ${shape.reason}`);
    process.exitCode = 1;
    return;
  }

  const tmp = mkdtempSync(join(tmpdir(), 'gitleaks-fixture-'));
  try {
    cpSync(join(FIXTURE_DIR, LEAKY_FIXTURE), join(tmp, LEAKY_FIXTURE));
    cpSync(join(FIXTURE_DIR, CLEAN_FIXTURE), join(tmp, CLEAN_FIXTURE));

    // 1. The scanner fires at all. Scanned WITHOUT the repo config, so no allowlist here
    //    can hide the bait from the one check that proves gitleaks works.
    const defaultReport = join(tmp, REPORT_FILE);
    const defaultRun = scan(tmp, defaultReport, undefined);
    const ran = interpretGitleaksRun(defaultRun);
    if (!ran.ok) {
      console.error(`[check-gitleaks-fixture] ${ran.reason}`);
      process.exit(1);
    }
    const verdict = assertExpectedFindings(JSON.parse(readFileSync(defaultReport, 'utf8')));
    if (!verdict.ok) {
      console.error(`[check-gitleaks-fixture] ${verdict.reason}`);
      process.exit(1);
    }

    // 2. The REPO CONFIG still catches secrets. Step 1 cannot see this — it never loads
    //    .gitleaks.toml — so an allowlist widened to `paths = ['''.*''']` would neuter the
    //    real scan while step 1 stayed green and ci-gate went green with it. This scans a
    //    DIFFERENT, non-exempt secret under the repo config. It must still fire.
    const probeDir = mkdtempSync(join(tmpdir(), 'gitleaks-config-probe-'));
    try {
      writeFileSync(join(probeDir, PROBE_FILE), `export const t = '${PROBE_TOKEN}';\n`);
      const probeReport = join(probeDir, REPORT_FILE);
      const probeRun = scan(probeDir, probeReport, resolve(REPO_CONFIG));
      const probeRan = interpretGitleaksRun(probeRun);
      const neutered = `The repo config no longer detects a secret it is supposed to detect. An allowlist widened past the token it was written for — a "paths" entry (which exempts a file from EVERY rule), or an over-broad regex — disables the scanner for the REAL scan while the default-rules check above keeps passing. That is a green gate over no scanning at all.`;

      if (!probeRan.ok) {
        console.error(
          `[check-gitleaks-fixture] under ${REPO_CONFIG}: ${probeRan.reason}\n\n${neutered}`,
        );
        process.exit(1);
      }
      if (!existsSync(probeReport)) {
        console.error(
          `[check-gitleaks-fixture] gitleaks reported leaks under ${REPO_CONFIG} but wrote no report to ${probeReport}.`,
        );
        process.exit(1);
      }
      const probeRules = JSON.parse(readFileSync(probeReport, 'utf8')).map((f) => String(f.RuleID));
      for (const rule of EXPECTED_RULES) {
        if (!probeRules.includes(rule)) {
          console.error(
            `[check-gitleaks-fixture] under ${REPO_CONFIG}, a non-allowlisted secret did NOT trigger "${rule}" (found: ${probeRules.join(', ') || 'none'}).\n\n${neutered}`,
          );
          process.exit(1);
        }
      }
    } finally {
      rmSync(probeDir, { recursive: true, force: true });
    }

    console.log(
      `[check-gitleaks-fixture] PASS — gitleaks fires on ${LEAKY_FIXTURE} (${EXPECTED_RULES.join(', ')}), stays silent on ${CLEAN_FIXTURE}, and ${REPO_CONFIG} still catches a secret it does not allowlist.`,
    );
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

if (
  typeof process.argv[1] === 'string' &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  main();
}
