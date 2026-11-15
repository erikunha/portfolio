import { execFileSync } from 'node:child_process';
import { beforeAll, describe, expect, it } from 'vitest';
import config from '../playwright.config';

const VISUAL_SPEC_PATH = 'visual/visual.spec.ts';
const DESIGN_SYSTEM_COMPONENTS_SPEC_PATH = 'e2e/design-system-components.spec.ts';
const CI_VISUAL_PROJECTS = ['chromium', 'chromium-mobile'];
const WEBKIT_PROJECTS = ['webkit-desktop', 'webkit-mobile'];
const DESIGN_SYSTEM_COMPONENTS_PROJECTS = ['chromium'];
const PROJECTS_WITHOUT_DESIGN_SYSTEM_COMPONENTS = [
  'chromium-mobile',
  'webkit-desktop',
  'webkit-mobile',
  'chromium-components',
  'chromium-mobile-components',
  'webkit-desktop-components',
  'webkit-mobile-components',
];
const ALL_PROJECTS = new Set([
  ...CI_VISUAL_PROJECTS,
  ...WEBKIT_PROJECTS,
  ...DESIGN_SYSTEM_COMPONENTS_PROJECTS,
  ...PROJECTS_WITHOUT_DESIGN_SYSTEM_COMPONENTS,
]);
const CI_ENV_VALUE = '1';

const LIST_TIMEOUT_MS = 120_000;
const LIST_BUFFER_BYTES = 256 * 1024 * 1024;

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

const selectionByMode = new Map<boolean, Map<string, Set<string>>>();

function selectedSpecsPerProject(ciMode: boolean): Map<string, Set<string>> {
  const cached = selectionByMode.get(ciMode);
  if (cached) return cached;
  const output = execFileSync('pnpm', ['exec', 'playwright', 'test', '--list', '--reporter=json'], {
    cwd: process.cwd(),
    encoding: 'utf8',
    env: { ...process.env, CI: ciMode ? CI_ENV_VALUE : '' },
    maxBuffer: LIST_BUFFER_BYTES,
    stdio: ['ignore', 'pipe', 'ignore'],
    timeout: LIST_TIMEOUT_MS,
  });
  const report = JSON.parse(output) as { suites: ListedSuite[] };
  const perProject = new Map<string, Set<string>>();
  for (const suite of report.suites) {
    for (const spec of collectSpecs(suite, [])) {
      for (const test of spec.tests) {
        const files = perProject.get(test.projectName) ?? new Set<string>();
        files.add(spec.file);
        perProject.set(test.projectName, files);
      }
    }
  }
  selectionByMode.set(ciMode, perProject);
  return perProject;
}

function projectRunsSpec(name: string, specFile: string, ciMode: boolean): boolean {
  if (!config.projects?.some((candidate) => candidate.name === name)) {
    throw new Error(`project ${name} missing from playwright.config.ts`);
  }
  return selectedSpecsPerProject(ciMode).get(name)?.has(specFile) ?? false;
}

beforeAll(() => {
  selectedSpecsPerProject(false);
  selectedSpecsPerProject(true);
}, LIST_TIMEOUT_MS * 2);

function runsSpec(name: string, specFile: string): boolean {
  return projectRunsSpec(name, specFile, false);
}

describe('visual regression project set', () => {
  it.each(CI_VISUAL_PROJECTS)('%s runs the visual spec that CI compares', (name) => {
    expect(runsSpec(name, VISUAL_SPEC_PATH), `${name} must run tests/visual/visual.spec.ts`).toBe(
      true,
    );
  });

  it.each(WEBKIT_PROJECTS)(
    '%s does not run the visual spec, because no CI job compares webkit pixels',
    (name) => {
      expect(
        runsSpec(name, VISUAL_SPEC_PATH),
        `${name} would need a darwin-only baseline that no CI job checks and that drifts silently`,
      ).toBe(false);
    },
  );
});

describe('design-system component baseline project set', () => {
  it.each(DESIGN_SYSTEM_COMPONENTS_PROJECTS)(
    '%s runs the design-system component spec, so its baseline is regenerated where it is read',
    (name) => {
      expect(
        runsSpec(name, DESIGN_SYSTEM_COMPONENTS_SPEC_PATH),
        `${name} must run tests/e2e/design-system-components.spec.ts`,
      ).toBe(true);
    },
  );

  it.each(PROJECTS_WITHOUT_DESIGN_SYSTEM_COMPONENTS)(
    '%s does not run the design-system component spec, because no CI job compares its pixels',
    (name) => {
      expect(
        runsSpec(name, DESIGN_SYSTEM_COMPONENTS_SPEC_PATH),
        `${name} would need a darwin-only baseline that no CI job regenerates or compares, so it drifts silently and misleads the next reader`,
      ).toBe(false);
    },
  );

  it('covers every project in playwright.config.ts', () => {
    const configured = (config.projects ?? []).map((project) => project.name).sort();
    expect(
      configured,
      'every project must be classified above: an unclassified project would run a spec nobody asserts, so the project set claimed in the skill would rot unnoticed',
    ).toEqual([...ALL_PROJECTS].sort());
  });
});

describe('design-system component spec CI exclusion', () => {
  it.each(DESIGN_SYSTEM_COMPONENTS_PROJECTS)(
    '%s ignores the design-system component spec in CI mode, because its baseline is darwin-only',
    (name) => {
      expect(
        projectRunsSpec(name, DESIGN_SYSTEM_COMPONENTS_SPEC_PATH, true),
        `${name} would run tests/e2e/design-system-components.spec.ts in CI, whose baseline exists only on darwin, so every CI run would fail on a baseline no CI job can regenerate`,
      ).toBe(false);
    },
  );

  it('no project runs the design-system component spec in CI mode', () => {
    const runningInCi = (config.projects ?? [])
      .map((project) => project.name)
      .filter((name): name is string => name !== undefined)
      .filter((name) => projectRunsSpec(name, DESIGN_SYSTEM_COMPONENTS_SPEC_PATH, true));
    expect(
      runningInCi,
      'a project running tests/e2e/design-system-components.spec.ts in CI would compare a darwin-only baseline that no CI job regenerates, so every CI run would fail on a baseline no CI job can regenerate',
    ).toEqual([]);
  });

  it.each(DESIGN_SYSTEM_COMPONENTS_PROJECTS)(
    '%s runs the design-system component spec outside CI mode, so the darwin baseline can be regenerated',
    (name) => {
      expect(
        projectRunsSpec(name, DESIGN_SYSTEM_COMPONENTS_SPEC_PATH, false),
        `${name} must run tests/e2e/design-system-components.spec.ts on darwin, otherwise the darwin-only baseline could never be regenerated and would rot against the component it covers`,
      ).toBe(true);
    },
  );
});
