import { spawnSync } from 'node:child_process';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { trackedFiles } from '../../scripts/lib/git';

const ROOT = process.cwd();
const PLAYWRIGHT_BIN = join(ROOT, 'node_modules', '.bin', 'playwright');
const SUBPROCESS_TEST_TIMEOUT_MS = 60_000;
const LIST_MAX_BUFFER_BYTES = 64 * 1024 * 1024;
const SNAPSHOT_PNG = /^(.+)-snapshots\/(.+)-([a-z]+)\.png$/;
const SNAPSHOT_DIRECTORY = '-snapshots/';
const RUNNER_ENV_BY_PLATFORM: Record<string, Record<string, string | undefined>> = {
  darwin: { CI: undefined },
  linux: { CI: '1' },
};

interface ListedTest {
  projectName: string;
}
interface ListedSuite {
  file: string;
  specs?: Array<{ tests: ListedTest[] }>;
  suites?: ListedSuite[];
}
interface ListedMatrix {
  config: { rootDir: string };
  suites: ListedSuite[];
}

type Matrix = Map<string, Set<string>>;

function collect(suite: ListedSuite, rootDir: string, into: Matrix): void {
  const spec = resolve(rootDir, suite.file);
  for (const entry of suite.specs ?? []) {
    for (const listed of entry.tests) {
      into.set(spec, (into.get(spec) ?? new Set()).add(listed.projectName));
    }
  }
  for (const child of suite.suites ?? []) collect(child, rootDir, into);
}

function readMatrix(listing: ListedMatrix): { matrix: Matrix; projects: string[] } {
  const matrix: Matrix = new Map();
  const rootDir = listing.config.rootDir;
  for (const suite of listing.suites) collect(suite, rootDir, matrix);
  const projects = [...new Set([...matrix.values()].flatMap((names) => [...names]))];
  return { matrix, projects };
}

function listMatrix(platform: string): ListedMatrix {
  const run = spawnSync(PLAYWRIGHT_BIN, ['test', '--list', '--reporter=json'], {
    cwd: ROOT,
    encoding: 'utf8',
    maxBuffer: LIST_MAX_BUFFER_BYTES,
    env: { ...process.env, ...RUNNER_ENV_BY_PLATFORM[platform] },
  });
  if (run.status !== 0) throw new Error(`playwright --list failed: ${run.stderr}`);
  return JSON.parse(run.stdout) as ListedMatrix;
}

function orphanBaselines(
  files: string[],
  matrixByPlatform: Record<string, { matrix: Matrix; projects: string[] }>,
  root: string,
): string[] {
  return files.filter((file) => {
    const match = SNAPSHOT_PNG.exec(file);
    if (!match) return false;
    const [, specPath = '', stem = '', platform = ''] = match;
    const runner = matrixByPlatform[platform];
    if (!runner) return true;
    const project = [...runner.projects]
      .sort((a, b) => b.length - a.length)
      .find((name) => stem.endsWith(`-${name}`));
    if (!project) return true;
    return !runner.matrix.get(resolve(root, specPath))?.has(project);
  });
}

describe('orphanBaselines', () => {
  const projects = ['chromium', 'chromium-mobile'];
  const matrix: Matrix = new Map([['/r/tests/a.spec.ts', new Set(['chromium'])]]);
  const runners = { darwin: { matrix, projects } };

  it('keeps a baseline whose spec runs on the project it names', () => {
    expect(
      orphanBaselines(['tests/a.spec.ts-snapshots/shot-chromium-darwin.png'], runners, '/r'),
    ).toEqual([]);
  });

  it('reads a mobile suffix as its own project, not as chromium', () => {
    const file = 'tests/a.spec.ts-snapshots/shot-chromium-mobile-darwin.png';
    expect(orphanBaselines([file], runners, '/r')).toEqual([file]);
  });

  it('flags a platform no runner uses', () => {
    const file = 'tests/a.spec.ts-snapshots/shot-chromium-linux.png';
    expect(orphanBaselines([file], runners, '/r')).toEqual([file]);
  });
});

describe('tracked screenshot baselines', { timeout: SUBPROCESS_TEST_TIMEOUT_MS }, () => {
  it('all belong to a spec, project and platform that Playwright runs', () => {
    const matrixByPlatform = Object.fromEntries(
      Object.keys(RUNNER_ENV_BY_PLATFORM).map((platform) => [
        platform,
        readMatrix(listMatrix(platform)),
      ]),
    );
    const snapshots = trackedFiles().filter((file) => file.includes(SNAPSHOT_DIRECTORY));
    expect(
      orphanBaselines(snapshots, matrixByPlatform, ROOT),
      'no Playwright project runs these baselines, so no gate reads them; git rm them or fix the project grep',
    ).toEqual([]);
  });
});
