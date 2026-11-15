import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { parse as parseToml, TomlError } from 'smol-toml';
import { isMain } from '../lib/is-main.ts';

export const EXPECTED_RULES: string[] = ['github-pat'];
export const LEAKY_FIXTURE = 'leaky.ts';
export const CLEAN_FIXTURE = 'clean.ts';

const NO_LEAKS = 0;
const LEAKS_FOUND = 1;
const EXIT_FAILURE = 1;
const GREP_MATCHED = 0;
const GREP_NO_MATCH = 1;
const LINE_BREAK = '\n';
const PATH_SEPARATOR = '/';
const TAG = '[check-gitleaks-fixture]';

export interface Verdict {
  ok: boolean;
  reason?: string;
}

export interface GitleaksRun {
  error?: Error | undefined;
  status: number | null;
  stderr?: string | Buffer | null | undefined;
}

export interface GitleaksFinding {
  File?: string;
  RuleID?: string;
}

export function interpretGitleaksRun(res: GitleaksRun): Verdict {
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

const ALLOWED_TOP_LEVEL = new Set(['title', 'extend', 'allowlists', 'allowlist']);
const ALLOWED_EXTEND = new Set(['useDefault']);
const ALLOWLIST_KEY_TYPES: Record<string, (value: unknown) => boolean> = {
  description: (value) => typeof value === 'string',
  regexes: (value) => Array.isArray(value) && value.every((entry) => typeof entry === 'string'),
  condition: (value) => typeof value === 'string',
  matchCondition: (value) => typeof value === 'string',
};
const ALLOWED_ALLOWLIST = new Set(Object.keys(ALLOWLIST_KEY_TYPES));

type PlainObject = Record<string, unknown>;

const isPlainObject = (value: unknown): value is PlainObject =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const firstUnknownKey = (obj: PlainObject, allowed: Set<string>): string | undefined =>
  Object.keys(obj).find((key) => !allowed.has(key));

export function assertConfigShape(
  config: string,
  hasIgnoreFile: boolean,
  allowComments: string[],
): Verdict {
  let parsed: PlainObject;
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
  if (!isPlainObject(extend) || extend.useDefault !== true) {
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
  const allowlists: unknown[] = [
    ...((parsed.allowlists as unknown[] | undefined) ?? []),
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
      if (!ALLOWLIST_KEY_TYPES[key]?.(value)) {
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

export function assertExpectedFindings(findings: GitleaksFinding[]): Verdict {
  const byFile = new Map<string, string[]>();
  for (const finding of findings) {
    const base = String(finding.File ?? '')
      .split(PATH_SEPARATOR)
      .pop() as string;
    const rules = byFile.get(base) ?? [];
    rules.push(String(finding.RuleID ?? ''));
    byFile.set(base, rules);
  }

  const leakyRules = byFile.get(LEAKY_FIXTURE) ?? [];
  for (const rule of EXPECTED_RULES) {
    if (!leakyRules.includes(rule)) {
      return {
        ok: false,
        reason: `${LEAKY_FIXTURE} did not trigger the expected rule "${rule}" (found: ${leakyRules.join(', ') || 'none'}). Either the rule was removed from the config, or the planted secret no longer matches it, in both cases the real scan is no longer proven to detect this class.`,
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

const FIXTURE_DIR = 'tests/fixtures/gitleaks';
const REPO_CONFIG = '.gitleaks.toml';
const REPORT_FILE = 'gitleaks-fixture.json';
const PROBE_FILE = 'config-probe.ts';
const GITLEAKS_BIN = process.env.GITLEAKS_BIN ?? 'gitleaks';
const GITLEAKS_IGNORE = '.gitleaksignore';
const ALLOW_COMMENT = 'gitleaks:allow';

const PROBE_TOKEN = ['ghp', 'Pr0beNotAllowlisted0123456789abcdefg'].join('_');

function scannerEnv(): NodeJS.ProcessEnv {
  const env = { ...process.env };
  delete env.GITLEAKS_CONFIG;
  return env;
}

function scan(dir: string, report: string, configPath: string | undefined) {
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

const MAY_NAME_THE_COMMENT_FILES = [
  'scripts/gates/check-gitleaks-fixture.ts',
  'scripts/gates/gitleaks-staged.ts',
];

export function mayNameTheComment(file: string): boolean {
  return MAY_NAME_THE_COMMENT_FILES.includes(file);
}

function trackedFilesContaining(needle: string): string[] {
  const listed = spawnSync('git', ['grep', '-l', '--fixed-strings', needle, '--', '.'], {
    encoding: 'utf8',
  });
  if (listed.status !== GREP_MATCHED && listed.status !== GREP_NO_MATCH) {
    throw new Error(
      `git grep could not scan the tree for suppression comments (exit ${listed.status}): ${String(listed.stderr ?? listed.error?.message).trim()}. Empty output from a FAILED grep looks exactly like a clean tree, so this refuses rather than reporting one.`,
    );
  }
  return String(listed.stdout ?? '')
    .split(LINE_BREAK)
    .filter((file) => file !== '')
    .filter((file) => !mayNameTheComment(file));
}

function fail(message: string): never {
  console.error(`${TAG} ${message}`);
  process.exit(EXIT_FAILURE);
}

function readFindings(report: string): GitleaksFinding[] {
  return JSON.parse(readFileSync(report, 'utf8')) as GitleaksFinding[];
}

function main(): void {
  const shape = assertConfigShape(
    readFileSync(REPO_CONFIG, 'utf8'),
    existsSync(GITLEAKS_IGNORE),
    trackedFilesContaining(ALLOW_COMMENT),
  );
  if (!shape.ok) {
    console.error(`${TAG} ${shape.reason}`);
    process.exitCode = EXIT_FAILURE;
    return;
  }

  const tmp = mkdtempSync(join(tmpdir(), 'gitleaks-fixture-'));
  try {
    cpSync(join(FIXTURE_DIR, LEAKY_FIXTURE), join(tmp, LEAKY_FIXTURE));
    cpSync(join(FIXTURE_DIR, CLEAN_FIXTURE), join(tmp, CLEAN_FIXTURE));

    const defaultReport = join(tmp, REPORT_FILE);
    const defaultRun = scan(tmp, defaultReport, undefined);
    const ran = interpretGitleaksRun(defaultRun);
    if (!ran.ok) fail(String(ran.reason));
    const verdict = assertExpectedFindings(readFindings(defaultReport));
    if (!verdict.ok) fail(String(verdict.reason));

    const probeDir = mkdtempSync(join(tmpdir(), 'gitleaks-config-probe-'));
    try {
      writeFileSync(join(probeDir, PROBE_FILE), `export const t = '${PROBE_TOKEN}';\n`);
      const probeReport = join(probeDir, REPORT_FILE);
      const probeRun = scan(probeDir, probeReport, resolve(REPO_CONFIG));
      const probeRan = interpretGitleaksRun(probeRun);
      const neutered = `The repo config no longer detects a secret it is supposed to detect. An allowlist widened past the token it was written for, a "paths" entry (which exempts a file from EVERY rule), or an over-broad regex, disables the scanner for the REAL scan while the default-rules check above keeps passing. That is a green gate over no scanning at all.`;

      if (!probeRan.ok) fail(`under ${REPO_CONFIG}: ${probeRan.reason}\n\n${neutered}`);
      if (!existsSync(probeReport)) {
        fail(`gitleaks reported leaks under ${REPO_CONFIG} but wrote no report to ${probeReport}.`);
      }
      const probeRules = readFindings(probeReport).map((finding) => String(finding.RuleID));
      for (const rule of EXPECTED_RULES) {
        if (!probeRules.includes(rule)) {
          fail(
            `under ${REPO_CONFIG}, a non-allowlisted secret did NOT trigger "${rule}" (found: ${probeRules.join(', ') || 'none'}).\n\n${neutered}`,
          );
        }
      }
    } finally {
      rmSync(probeDir, { recursive: true, force: true });
    }

    console.log(
      `${TAG} PASS: gitleaks fires on ${LEAKY_FIXTURE} (${EXPECTED_RULES.join(', ')}), stays silent on ${CLEAN_FIXTURE}, and ${REPO_CONFIG} still catches a secret it does not allowlist.`,
    );
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

if (isMain(import.meta.url)) main();
