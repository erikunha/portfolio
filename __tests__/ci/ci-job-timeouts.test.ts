import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';

type Job = { 'timeout-minutes'?: unknown };

// behavioral-test-allow: the artifact under test IS ci.yml; a job timeout has no runtime surface in this repository.
const jobs = (
  parse(readFileSync(join(process.cwd(), '.github', 'workflows', 'ci.yml'), 'utf8')) as {
    jobs: Record<string, Job>;
  }
).jobs;

describe('ci.yml job timeouts', () => {
  it.each(Object.entries(jobs))('%s declares a positive timeout-minutes', (_name, job) => {
    const minutes = job['timeout-minutes'];
    expect(typeof minutes === 'number' && minutes > 0).toBe(true);
  });
});
