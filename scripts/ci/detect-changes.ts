import { appendFileSync } from 'node:fs';
import { gitText, showAtRef } from '../lib/git.ts';
import { isMain } from '../lib/is-main.ts';
import { AI_PATHS, APP_PATHS, UI_PATHS } from './detect-changes-paths.ts';

const PULL_REQUEST_EVENT = 'pull_request';
const AI_DEPENDENCY_NAME = /^(ai|@ai-sdk\/.+|langfuse.*|@langfuse\/.+)$/;
const LOCK_PACKAGE_KEY = /^ {2}'?((?:@[^/@\s']+\/)?[^@\s'/][^@\s']*)@([^\s'(:]+)[^']*'?:$/;
const LEADING_NON_DIGITS = /^\D+/;
const DECIMAL_RADIX = 10;
const EXIT_FAILURE = 1;
const LINE_BREAK = '\n';
const ABSENT_SLICE = 'null';
const PACKAGE_JSON = 'package.json';
const LOCKFILE = 'pnpm-lock.yaml';
const LOG_PREFIX = '[detect-changes]';

export interface ChangeSignals {
  aiChanged: boolean;
  appChanged: boolean;
  uiChanged: boolean;
  pkgRenderChanged: boolean;
  aiMajorChanged?: boolean;
  aiLockChanged?: boolean;
}

export interface Categories {
  ai: boolean;
  app: boolean;
  ui: boolean;
}

export function canonicalJSON(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJSON).join(',')}]`;
  }
  if (value !== null && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const keys = Object.keys(record).sort();
    return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalJSON(record[k])}`).join(',')}}`;
  }
  return JSON.stringify(value === undefined ? null : value);
}

export function aiDependencyVersions(lockText: string): string[] {
  const found = new Set<string>();
  for (const line of lockText.split(LINE_BREAK)) {
    const match = LOCK_PACKAGE_KEY.exec(line);
    const name = match?.[1];
    if (match && name !== undefined && AI_DEPENDENCY_NAME.test(name)) {
      found.add(`${name}@${match[2]}`);
    }
  }
  return [...found].sort();
}

export function computeCategories({
  aiChanged,
  appChanged,
  uiChanged,
  pkgRenderChanged,
  aiMajorChanged,
  aiLockChanged,
}: ChangeSignals): Categories {
  return {
    ai: aiChanged || Boolean(aiMajorChanged) || Boolean(aiLockChanged),
    app: appChanged,
    ui: uiChanged || pkgRenderChanged,
  };
}

interface PackageJsonShape {
  pnpm?: { overrides?: { ai?: unknown } };
  dependencies?: { ai?: unknown };
  devDependencies?: { ai?: unknown };
  browserslist?: unknown;
}

export function aiMajor(pkgJsonString: string): number | null {
  try {
    const pkg = JSON.parse(pkgJsonString) as PackageJsonShape | null;
    const spec = pkg?.pnpm?.overrides?.ai ?? pkg?.dependencies?.ai ?? pkg?.devDependencies?.ai;
    if (typeof spec !== 'string') return null;
    const major = Number.parseInt(spec.replace(LEADING_NON_DIGITS, ''), DECIMAL_RADIX);
    return Number.isNaN(major) ? null : major;
  } catch {
    return null;
  }
}

function diffNonEmpty(base: string, head: string, paths: readonly string[]): boolean {
  return gitText(['diff', '--name-only', `${base}...${head}`, '--', ...paths]).length > 0;
}

function renderSlice(ref: string): string {
  const text = showAtRef(ref, PACKAGE_JSON);
  if (text === null) return ABSENT_SLICE;
  try {
    const pkg = JSON.parse(text) as PackageJsonShape;
    return canonicalJSON({ browserslist: pkg.browserslist ?? null, pnpm: pkg.pnpm ?? null });
  } catch {
    return ABSENT_SLICE;
  }
}

function aiMajorAtRef(ref: string): number | null {
  const text = showAtRef(ref, PACKAGE_JSON);
  return text === null ? null : aiMajor(text);
}

function aiLockAtRef(ref: string): string {
  const text = showAtRef(ref, LOCKFILE);
  return text === null ? ABSENT_SLICE : aiDependencyVersions(text).join(LINE_BREAK);
}

function writeOutputs({ ai, app, ui }: Categories): void {
  const file = process.env.GITHUB_OUTPUT;
  if (!file) throw new Error('GITHUB_OUTPUT is not set');
  appendFileSync(file, `ai=${ai}\napp=${app}\nui=${ui}\n`);
}

function main(): void {
  if (process.env.EVENT_NAME !== PULL_REQUEST_EVENT) {
    writeOutputs({ ai: true, app: true, ui: true });
    return;
  }
  const base = process.env.BASE_SHA;
  const head = process.env.HEAD_SHA;
  if (!base || !head) throw new Error('BASE_SHA / HEAD_SHA not set');
  const aiChanged = diffNonEmpty(base, head, AI_PATHS);
  const appChanged = diffNonEmpty(base, head, APP_PATHS);
  const uiChanged = diffNonEmpty(base, head, UI_PATHS);
  const pkgRenderChanged = renderSlice(base) !== renderSlice(head);
  const aiMajorChanged = aiMajorAtRef(base) !== aiMajorAtRef(head);
  const aiLockChanged = aiLockAtRef(base) !== aiLockAtRef(head);
  writeOutputs(
    computeCategories({
      aiChanged,
      appChanged,
      uiChanged,
      pkgRenderChanged,
      aiMajorChanged,
      aiLockChanged,
    }),
  );
}

if (isMain(import.meta.url)) {
  try {
    main();
  } catch (err) {
    process.stderr.write(`${LOG_PREFIX} ${err instanceof Error ? err.message : String(err)}\n`);
    process.exit(EXIT_FAILURE);
  }
}
