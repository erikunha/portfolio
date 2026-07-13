#!/usr/bin/env node

const SEMVER = /^v?(\d+)\.(\d+)\.(\d+)/;

export function parseVersion(raw) {
  const match = SEMVER.exec(String(raw).trim());
  if (match === null) {
    throw new Error(
      `"${raw}" is not a semver. Refusing to compare it: a garbled upstream response must not be read as "up to date", which would let a stale pin sit unnoticed.`,
    );
  }
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

export function isBehind(current, latest) {
  const c = parseVersion(current);
  const l = parseVersion(latest);
  for (let i = 0; i < 3; i++) {
    if (l[i] > c[i]) return true;
    if (l[i] < c[i]) return false;
  }
  return false;
}

export function readPin(fileText, pattern, name) {
  const match = pattern.exec(fileText);
  if (match === null || match[1] === undefined) {
    throw new Error(
      `could not find the ${name} version pin (pattern ${pattern}). The pin is the single source of truth; if this check cannot read it, it must fail rather than silently report the pin as current.`,
    );
  }
  return match[1];
}

const GITHUB_HOST = 'api.github.com';

// Authenticate the GitHub call when a token is available: the anonymous limit is 60 req/hr per IP,
// and Actions runners share outbound IPs, so an unauthenticated call can 403 on a busy week and
// red this job when nothing is actually behind -- a false positive that trains people to ignore
// it. The token is scoped to the GitHub host ONLY; PyPI (and anything else) never receives it.
export function buildHeaders(url, token) {
  const headers = { 'User-Agent': 'erikunha-portfolio-pin-check', Accept: 'application/json' };
  if (token !== undefined && token !== '' && new URL(url).host === GITHUB_HOST) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}

async function fetchJson(url) {
  const res = await fetch(url, { headers: buildHeaders(url, process.env.GITHUB_TOKEN) });
  if (!res.ok) {
    throw new Error(`${url} returned HTTP ${res.status}`);
  }
  return res.json();
}

const latestGitleaks = async () => {
  const release = await fetchJson('https://api.github.com/repos/gitleaks/gitleaks/releases/latest');
  return String(release.tag_name);
};

const latestSemgrep = async () => {
  const meta = await fetchJson('https://pypi.org/pypi/semgrep/json');
  return String(meta.info.version);
};

const CI_YAML = '.github/workflows/ci.yml';

export const PINS = [
  {
    name: 'gitleaks',
    file: CI_YAML,
    pattern: /GITLEAKS_VERSION:\s*(\d+\.\d+\.\d+)/,
    latest: latestGitleaks,
    bumpHint: `bump GITLEAKS_VERSION in ${CI_YAML}, then re-derive the sha256 in the checksum step`,
  },
  {
    name: 'semgrep',
    file: CI_YAML,
    pattern: /semgrep==(\d+\.\d+\.\d+)/,
    latest: latestSemgrep,
    bumpHint: `bump the \`semgrep==\` pin in ${CI_YAML}`,
  },
];

import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

async function statusOf(pin) {
  const current = readPin(readFileSync(pin.file, 'utf8'), pin.pattern, pin.name);
  const latest = parseVersion(await pin.latest()).join('.');
  return { name: pin.name, current, latest, behind: isBehind(current, latest) };
}

async function main() {
  // Fail CLOSED: if any pin cannot be read or any upstream cannot be reached, throw. This job is
  // scheduled and non-blocking, so a red run is a visible, re-runnable nudge -- never a silent
  // "everything is current" that lets a security scanner rot unpatched.
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

// A GitHub Actions ::error:: annotation is line-delimited: a newline in the message would be
// parsed as the start of a fresh workflow command. error.message can carry a raw upstream value
// (parseVersion embeds the string it rejected), so collapse any CR/LF before emitting. Blast
// radius is near-zero here (read-only token, no secrets, ref/version formats forbid newlines),
// but the annotation should carry only what this script put there.
const oneLine = (text) => String(text).replace(/[\r\n]+/g, ' ');

if (
  typeof process.argv[1] === 'string' &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  main().catch((error) => {
    console.error(`::error::${oneLine(error.message)}`);
    process.exitCode = 1;
  });
}
