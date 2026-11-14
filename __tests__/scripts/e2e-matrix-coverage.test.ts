import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import config from '../../playwright.config';
import { parseWorkflow } from '../../scripts/lib/ci-workflow';

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
