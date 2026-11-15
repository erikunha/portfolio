import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import config from '../../playwright.config';
import { parseWorkflow } from '../../scripts/ci/ci-workflow';

const ci = readFileSync(`${process.cwd()}/.github/workflows/ci.yml`, 'utf8');
const job = ci.slice(ci.indexOf('\n  e2e-functional:'));
const e2e = parseWorkflow(ci).jobs['e2e-functional'];
const matrix = e2e?.matrixProjects ?? [];

const SHARDED_PROJECTS: Record<string, string[]> = {
  'webkit-desktop': ['1/2', '2/2'],
  'webkit-mobile': ['1/2', '2/2'],
};

const UNGATED_PROJECTS: readonly string[] = [];

describe('ci.yml e2e-functional matrix', () => {
  it('runs every Playwright project except the declared ungated ones', () => {
    const projects = (config.projects ?? []).map((p) => p.name ?? '');
    const expected = projects.filter((name) => !UNGATED_PROJECTS.includes(name));
    expect(
      [...matrix].sort(),
      'a project missing from the matrix is never run in CI, so its failures stay invisible until someone runs it by hand',
    ).toEqual([...expected].sort());
  });

  it('runs every shard of each sharded project', () => {
    expect(
      e2e?.matrixShards,
      'a dropped shard leaves part of that project unrun in CI, and the run stays green',
    ).toEqual(SHARDED_PROJECTS);
  });

  it('passes the shard to the page-project step and nowhere else', () => {
    // biome-ignore lint/suspicious/noTemplateCurlyInString: the workflow expression is the literal text under test
    expect(job).toContain("--shard=${{ matrix.shard || '1/1' }} tests/e2e/");
    expect(job.match(/--shard=/g)?.length).toBe(1);
  });

  it('names each failure artifact by the matrix job index, unique per shard', () => {
    expect(job).toContain(
      // biome-ignore lint/suspicious/noTemplateCurlyInString: the workflow expression is the literal text under test
      'name: playwright-report-${{ matrix.project }}-${{ strategy.job-index }}',
    );
  });

  it('gates exactly one test step per matrix project', () => {
    expect(job.length, 'e2e-functional job missing from ci.yml').toBeGreaterThan(0);
    const nonComponents =
      job.match(/if: \$\{\{ !endsWith\(matrix\.project, '-components'\) \}\}/g)?.length ?? 0;
    const components = job.split("if: endsWith(matrix.project, '-components')").length - 1;
    expect(
      { nonComponents, components },
      'a dropped or inverted step condition runs a matrix project tests twice or never',
    ).toEqual({ nonComponents: 1, components: 1 });
  });
});

const CROSS_BROWSER_TAG = '@cross-browser';
const E2E_DIRECTORY = `${process.cwd()}/tests/e2e`;
const LIST_TIMEOUT_MS = 120_000;
const LIST_BUFFER_BYTES = 256 * 1024 * 1024;
const WEBKIT_PROJECTS = ['webkit-desktop', 'webkit-mobile'];
const PAGE_PROJECTS = ['chromium', 'chromium-mobile', ...WEBKIT_PROJECTS];

interface ListedSpec {
  file: string;
  tests: Array<{ projectName: string }>;
}

interface ListedSuite {
  specs?: ListedSpec[];
  suites?: ListedSuite[];
}

function collectSpecs(suite: ListedSuite, into: ListedSpec[]): ListedSpec[] {
  into.push(...(suite.specs ?? []));
  for (const child of suite.suites ?? []) collectSpecs(child, into);
  return into;
}

function listTestsPerFile(): Map<string, Map<string, number>> {
  const output = execFileSync('pnpm', ['exec', 'playwright', 'test', '--list', '--reporter=json'], {
    cwd: process.cwd(),
    encoding: 'utf8',
    maxBuffer: LIST_BUFFER_BYTES,
    stdio: ['ignore', 'pipe', 'ignore'],
    timeout: LIST_TIMEOUT_MS,
  });
  const report = JSON.parse(output) as { suites: ListedSuite[] };
  const perFile = new Map<string, Map<string, number>>();
  for (const suite of report.suites) {
    for (const spec of collectSpecs(suite, [])) {
      const perProject = perFile.get(spec.file) ?? new Map<string, number>();
      for (const test of spec.tests) {
        perProject.set(test.projectName, (perProject.get(test.projectName) ?? 0) + 1);
      }
      perFile.set(spec.file, perProject);
    }
  }
  return perFile;
}

function greps(projectName: string): RegExp[] {
  const grep = config.projects?.find((project) => project.name === projectName)?.grep;
  if (grep === undefined) return [];
  return Array.isArray(grep) ? grep : [grep];
}

describe('cross-browser spec selection', () => {
  it('selects the webkit and mobile projects by tag, never by spec file name', () => {
    for (const name of PAGE_PROJECTS.filter((project) => project !== 'chromium')) {
      const project = config.projects?.find((candidate) => candidate.name === name);
      expect(
        project?.testMatch,
        `${name} lists spec files by name; tag the spec ${CROSS_BROWSER_TAG} instead`,
      ).toBeUndefined();
      const titleOfUntaggedSpec = `[${name}] › e2e/links.spec.ts:1:1 › links renders`;
      const titleOfTaggedSpec = `${titleOfUntaggedSpec} ${CROSS_BROWSER_TAG}`;
      const patterns = greps(name);
      expect(
        patterns.some((pattern) => pattern.test(titleOfTaggedSpec)),
        `${name} must select a test tagged ${CROSS_BROWSER_TAG}`,
      ).toBe(true);
      expect(
        patterns.some((pattern) => pattern.test(titleOfUntaggedSpec)),
        `${name} selects by something other than the tag, such as a spec file name`,
      ).toBe(false);
    }
  });

  it(
    'runs every test of a spec that carries the tag on every webkit project, and nothing else',
    () => {
      const perFile = listTestsPerFile();
      const tagged = new Set(
        readdirSync(E2E_DIRECTORY)
          .filter((entry) => entry.endsWith('.spec.ts'))
          .filter((entry) =>
            readFileSync(`${E2E_DIRECTORY}/${entry}`, 'utf8').includes(CROSS_BROWSER_TAG),
          )
          .map((entry) => `e2e/${entry}`),
      );
      const offenders: string[] = [];
      for (const [file, perProject] of perFile) {
        if (!file.startsWith('e2e/')) continue;
        const total = perProject.get('chromium') ?? 0;
        for (const project of WEBKIT_PROJECTS) {
          const selected = perProject.get(project) ?? 0;
          const expected = tagged.has(file) ? total : 0;
          if (selected !== expected) {
            offenders.push(
              `${file} on ${project}: ${selected} of ${total} tests, expected ${expected}`,
            );
          }
        }
      }
      expect(
        offenders,
        `a cross-browser spec has a test without the ${CROSS_BROWSER_TAG} tag, so that test silently skips webkit`,
      ).toEqual([]);
      expect(tagged.size, 'no spec carries the tag, so webkit runs nothing').toBeGreaterThan(0);
    },
    LIST_TIMEOUT_MS,
  );
});
