import { describe, expect, it } from 'vitest';
import config from '../playwright.config';

const VISUAL_SPEC_PATH = '/repo/tests/visual/visual.spec.ts';
const CI_VISUAL_PROJECTS = ['chromium', 'chromium-mobile'];
const WEBKIT_PROJECTS = ['webkit-desktop', 'webkit-mobile'];

function runsVisualSpec(name: string): boolean {
  const project = config.projects?.find((candidate) => candidate.name === name);
  if (!project) throw new Error(`project ${name} missing from playwright.config.ts`);
  if (project.testMatch === undefined) return true;
  const matchers = Array.isArray(project.testMatch) ? project.testMatch : [project.testMatch];
  return matchers.some((matcher) => matcher instanceof RegExp && matcher.test(VISUAL_SPEC_PATH));
}

describe('visual regression project set', () => {
  it.each(CI_VISUAL_PROJECTS)('%s runs the visual spec that CI compares', (name) => {
    expect(runsVisualSpec(name), `${name} must run tests/visual/visual.spec.ts`).toBe(true);
  });

  it.each(WEBKIT_PROJECTS)(
    '%s does not run the visual spec, because no CI job compares webkit pixels',
    (name) => {
      expect(
        runsVisualSpec(name),
        `${name} would need a darwin-only baseline that no CI job checks and that drifts silently`,
      ).toBe(false);
    },
  );
});
