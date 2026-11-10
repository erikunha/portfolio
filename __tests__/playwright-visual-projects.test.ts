import { afterEach, describe, expect, it, vi } from 'vitest';
import config from '../playwright.config';

const VISUAL_SPEC_PATH = '/repo/tests/visual/visual.spec.ts';
const DESIGN_SYSTEM_COMPONENTS_SPEC_PATH = '/repo/tests/e2e/design-system-components.spec.ts';
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

type ConfigProject = NonNullable<typeof config.projects>[number];

function runsSpec(name: string, specPath: string): boolean {
  const project = config.projects?.find((candidate) => candidate.name === name);
  if (!project) throw new Error(`project ${name} missing from playwright.config.ts`);
  if (project.testMatch === undefined) return true;
  const matchers = Array.isArray(project.testMatch) ? project.testMatch : [project.testMatch];
  return matchers.some((matcher) => matcher instanceof RegExp && matcher.test(specPath));
}

function findProject(projects: ConfigProject[], name: string): ConfigProject {
  const project = projects.find((candidate) => candidate.name === name);
  if (!project) throw new Error(`project ${name} missing from playwright.config.ts`);
  return project;
}

function projectIgnoresSpec(project: ConfigProject, specPath: string): boolean {
  if (project.testIgnore === undefined) return false;
  const matchers = Array.isArray(project.testIgnore) ? project.testIgnore : [project.testIgnore];
  return matchers.some((matcher) => matcher instanceof RegExp && matcher.test(specPath));
}

function projectRunsSpec(project: ConfigProject, specPath: string): boolean {
  if (projectIgnoresSpec(project, specPath)) return false;
  if (project.testMatch === undefined) return true;
  const matchers = Array.isArray(project.testMatch) ? project.testMatch : [project.testMatch];
  return matchers.some((matcher) => matcher instanceof RegExp && matcher.test(specPath));
}

async function loadConfigWithCiEnv(ciMode: boolean): Promise<typeof config> {
  vi.resetModules();
  vi.stubEnv('CI', ciMode ? CI_ENV_VALUE : undefined);
  const reloaded = await import('../playwright.config');
  return reloaded.default;
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
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it.each(DESIGN_SYSTEM_COMPONENTS_PROJECTS)(
    '%s ignores the design-system component spec in CI mode, because its baseline is darwin-only',
    async (name) => {
      const ciConfig = await loadConfigWithCiEnv(true);
      const project = findProject(ciConfig.projects ?? [], name);
      expect(
        projectIgnoresSpec(project, DESIGN_SYSTEM_COMPONENTS_SPEC_PATH),
        `${name} would run tests/e2e/design-system-components.spec.ts in CI, whose baseline exists only on darwin, so every CI run would fail on a baseline no CI job can regenerate`,
      ).toBe(true);
    },
  );

  it('no project runs the design-system component spec in CI mode', async () => {
    const ciConfig = await loadConfigWithCiEnv(true);
    const runningInCi = (ciConfig.projects ?? [])
      .filter((project) => projectRunsSpec(project, DESIGN_SYSTEM_COMPONENTS_SPEC_PATH))
      .map((project) => project.name);
    expect(
      runningInCi,
      'a project running tests/e2e/design-system-components.spec.ts in CI would compare a darwin-only baseline that no CI job regenerates, so every CI run would fail on a baseline no CI job can regenerate',
    ).toEqual([]);
  });

  it.each(DESIGN_SYSTEM_COMPONENTS_PROJECTS)(
    '%s runs the design-system component spec outside CI mode, so the darwin baseline can be regenerated',
    async (name) => {
      const localConfig = await loadConfigWithCiEnv(false);
      const project = findProject(localConfig.projects ?? [], name);
      expect(
        projectRunsSpec(project, DESIGN_SYSTEM_COMPONENTS_SPEC_PATH),
        `${name} must run tests/e2e/design-system-components.spec.ts on darwin, otherwise the darwin-only baseline could never be regenerated and would rot against the component it covers`,
      ).toBe(true);
    },
  );
});
