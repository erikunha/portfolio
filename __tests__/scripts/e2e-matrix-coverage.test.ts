import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import config from '../../playwright.config';

const ci = readFileSync(`${process.cwd()}/.github/workflows/ci.yml`, 'utf8');
const job = ci.slice(ci.indexOf('\n  e2e-functional:'));
const matrix = (job.match(/project:\s*\[([^\]]*)\]/)?.[1] ?? '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

const UNGATED_PROJECTS = ['webkit-desktop-components', 'webkit-mobile-components'];

describe('ci.yml e2e-functional matrix', () => {
  it('runs every Playwright project except the declared ungated ones', () => {
    const projects = (config.projects ?? []).map((p) => p.name ?? '');
    const expected = projects.filter((name) => !UNGATED_PROJECTS.includes(name));
    expect(
      [...matrix].sort(),
      'a project missing from the matrix is never run in CI, so its failures stay invisible until someone runs it by hand',
    ).toEqual([...expected].sort());
  });
});
