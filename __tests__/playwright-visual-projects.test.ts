import { describe, expect, it } from 'vitest';
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

function runsSpec(name: string, specPath: string): boolean {
  const project = config.projects?.find((candidate) => candidate.name === name);
  if (!project) throw new Error(`project ${name} missing from playwright.config.ts`);
  if (project.testMatch === undefined) return true;
  const matchers = Array.isArray(project.testMatch) ? project.testMatch : [project.testMatch];
  return matchers.some((matcher) => matcher instanceof RegExp && matcher.test(specPath));
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
