import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseWorkflow } from '../ci/ci-workflow';

const ci = parseWorkflow(readFileSync(`${process.cwd()}/.github/workflows/ci.yml`, 'utf8'));

describe('parseWorkflow on the real ci.yml', () => {
  it('reads jobs, needs, matrix projects, job outputs and step ids', () => {
    expect(Object.keys(ci.jobs)).toContain('e2e-functional');
    expect(ci.jobs['e2e-functional']?.needs).toEqual(['build', 'detect-changes']);
    expect(ci.jobs['e2e-functional']?.matrixProjects).toContain('webkit-mobile-components');
    expect(ci.jobs['detect-changes']?.outputs.app).toContain('steps.check.outputs.app');
    expect(ci.jobs.test?.steps.some((s) => s.id === 'lockfile-diff')).toBe(true);
  });

  it('orders jobs so every job follows the jobs it needs', () => {
    const position = new Map(ci.order.map((id, index) => [id, index]));
    for (const id of ci.order) {
      for (const need of ci.jobs[id]?.needs ?? []) {
        expect(position.get(need), `${id} needs ${need}`).toBeLessThan(position.get(id) ?? -1);
      }
    }
  });

  it('refuses a matrix axis it does not understand', () => {
    const text = 'jobs:\n  a:\n    strategy:\n      matrix:\n        os: [x]\n    steps: []\n';
    expect(() => parseWorkflow(text)).toThrow(/matrix/i);
  });
});

describe('parseWorkflow keys', () => {
  const job = (body: string) => `jobs:\n  a:\n    runs-on: x\n${body}`;

  it('reads workflow env, workflow defaults, job defaults and the step shell fields', () => {
    const parsed = parseWorkflow(
      [
        'env:',
        '  TOP: one',
        'defaults:',
        '  run:',
        '    shell: bash',
        '    working-directory: app',
        'jobs:',
        '  a:',
        '    runs-on: x',
        '    defaults:',
        '      run:',
        '        working-directory: sub',
        '    steps:',
        '      - run: echo hi',
        '        shell: sh',
        '        working-directory: nested',
        '        continue-on-error: true',
      ].join('\n'),
    );
    expect(parsed.env).toEqual({ TOP: 'one' });
    expect(parsed.defaults).toEqual({ shell: 'bash', workingDirectory: 'app' });
    expect(parsed.jobs.a?.defaults).toEqual({ workingDirectory: 'sub' });
    expect(parsed.jobs.a?.steps[0]).toMatchObject({
      shell: 'sh',
      workingDirectory: 'nested',
      continueOnError: true,
    });
  });

  it('refuses a job key it does not execute, so a new construct fails the drift guard', () => {
    expect(() => parseWorkflow(job('    container: node:22\n    steps: []\n'))).toThrow(
      /container/,
    );
    expect(() => parseWorkflow(job('    services:\n      db: {}\n    steps: []\n'))).toThrow(
      /services/,
    );
  });

  it('refuses a step key it does not execute', () => {
    expect(() => parseWorkflow(job('    steps:\n      - run: x\n        bogus: 1\n'))).toThrow(
      /bogus/,
    );
  });

  it('refuses a workflow key and a defaults key it does not execute', () => {
    expect(() => parseWorkflow('on: push\nenvironment: x\njobs: {}\n')).toThrow(/environment/);
    expect(() => parseWorkflow('defaults:\n  other: 1\njobs: {}\n')).toThrow(/defaults/);
  });

  it('refuses a continue-on-error that is an expression', () => {
    const expression = ['${{', 'a', '}}'].join(' ');
    expect(() =>
      parseWorkflow(job(`    steps:\n      - run: x\n        continue-on-error: ${expression}\n`)),
    ).toThrow(/continue-on-error/);
  });
});
