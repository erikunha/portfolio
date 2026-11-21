import { readFileSync } from 'node:fs';
import { isMain } from '../lib/is-main.ts';
import { buildHeaders as buildClientHeaders, createGithubClient } from '../metrics/github.ts';

const SEMVER = /^v?(\d+)\.(\d+)\.(\d+)/;
const USER_AGENT = 'erikunha-portfolio-pin-check';
const ACCEPT_JSON = 'application/json';
const CI_YAML = '.github/workflows/ci.yml';
const LINE_BREAKS = /[\r\n]+/g;

export type Version = [number, number, number];

export interface Pin {
  name: string;
  file: string;
  pattern: RegExp;
  latest: () => Promise<string>;
  bumpHint: string;
}

export interface PinStatus {
  name: string;
  current: string;
  latest: string;
  behind: boolean;
}

export function parseVersion(raw: unknown): Version {
  const match = SEMVER.exec(String(raw).trim());
  if (match === null) {
    throw new Error(
      `"${raw}" is not a semver. Refusing to compare it: a garbled upstream response must not be read as "up to date", which would let a stale pin sit unnoticed.`,
    );
  }
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

export function isBehind(current: string, latest: string): boolean {
  const c = parseVersion(current);
  const l = parseVersion(latest);
  const firstDifference = c.map((part, i) => (l[i] ?? part) - part).find((delta) => delta !== 0);
  return firstDifference !== undefined && firstDifference > 0;
}

export function readPin(fileText: string, pattern: RegExp, name: string): string {
  const match = pattern.exec(fileText);
  if (match === null || match[1] === undefined) {
    throw new Error(
      `could not find the ${name} version pin (pattern ${pattern}). The pin is the single source of truth; if this check cannot read it, it must fail rather than silently report the pin as current.`,
    );
  }
  return match[1];
}

export function buildHeaders(url: string, token: string | undefined): Record<string, string> {
  return buildClientHeaders({ url, token, accept: ACCEPT_JSON, userAgent: USER_AGENT });
}

function fetchJson(url: string): Promise<unknown> {
  const client = createGithubClient({ token: process.env.GITHUB_TOKEN, userAgent: USER_AGENT });
  return client.json(url, { accept: ACCEPT_JSON });
}

const latestGitleaks = async (): Promise<string> => {
  const release = (await fetchJson(
    'https://api.github.com/repos/gitleaks/gitleaks/releases/latest',
  )) as { tag_name: unknown };
  return String(release.tag_name);
};

const latestSemgrep = async (): Promise<string> => {
  const meta = (await fetchJson('https://pypi.org/pypi/semgrep/json')) as {
    info: { version: unknown };
  };
  return String(meta.info.version);
};

export const PINS: Pin[] = [
  {
    name: 'gitleaks',
    file: CI_YAML,
    pattern: /GITLEAKS_VERSION:\s*(\d+\.\d+\.\d+)/,
    latest: latestGitleaks,
    bumpHint: `bump GITLEAKS_VERSION in ${CI_YAML} and GITLEAKS_SHA256 with it (the sha256 of gitleaks_<version>_linux_x64.tar.gz in the release's checksums.txt; a mismatch fails the install step)`,
  },
  {
    name: 'semgrep',
    file: CI_YAML,
    pattern: /semgrep==(\d+\.\d+\.\d+)/,
    latest: latestSemgrep,
    bumpHint: `bump the \`semgrep==\` pin in ${CI_YAML}`,
  },
];

async function statusOf(pin: Pin): Promise<PinStatus> {
  const current = readPin(readFileSync(pin.file, 'utf8'), pin.pattern, pin.name);
  const latest = parseVersion(await pin.latest()).join('.');
  return { name: pin.name, current, latest, behind: isBehind(current, latest) };
}

async function main(): Promise<void> {
  const statuses = await Promise.all(PINS.map(statusOf));
  const behind = statuses.filter((s) => s.behind);

  for (const s of statuses) {
    console.log(
      `${s.name}: pinned ${s.current}, latest ${s.latest}${s.behind ? '  <- BEHIND' : ''}`,
    );
  }

  if (behind.length === 0) {
    console.log('[check-tool-pins] all scanner pins are current.');
    return;
  }

  for (const s of behind) {
    const hint = PINS.find((p) => p.name === s.name)?.bumpHint ?? '';
    console.error(`::error::${s.name} pin ${s.current} is behind latest ${s.latest}. ${hint}.`);
  }
  process.exitCode = 1;
}

const oneLine = (text: unknown): string => String(text).replace(LINE_BREAKS, ' ');

if (isMain(import.meta.url)) {
  main().catch((error: unknown) => {
    console.error(`::error::${oneLine(error instanceof Error ? error.message : error)}`);
    process.exitCode = 1;
  });
}
