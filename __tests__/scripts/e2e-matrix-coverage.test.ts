import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import config from '../../playwright.config';

const ci = readFileSync(`${process.cwd()}/.github/workflows/ci.yml`, 'utf8');
const job = ci.slice(ci.indexOf('\n  e2e-functional:'));
const matrix = (job.match(/project:\s*\[([^\]]*)\]/)?.[1] ?? '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

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
