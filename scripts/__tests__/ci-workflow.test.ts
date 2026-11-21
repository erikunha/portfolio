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
    expect(() => parseWorkflow(job('    services:\n      db: {}\n    steps: []\n'))).toThrow(
      /services/,
    );
  });

  it('reads a job container as the image and options it runs in, from either form', () => {
    const object = parseWorkflow(
      job('    container:\n      image: node:22\n      options: --init\n    steps: []\n'),
    );
    const string = parseWorkflow(job('    container: node:22\n    steps: []\n'));
    const none = parseWorkflow(job('    steps: []\n'));
    expect(object.jobs.a?.container).toEqual({ image: 'node:22', options: '--init' });
    expect(string.jobs.a?.container).toEqual({ image: 'node:22' });
    expect(none.jobs.a?.container).toBeUndefined();
  });

  it('refuses a container key it does not execute and a container with no image', () => {
    expect(() =>
      parseWorkflow(
        job('    container:\n      image: node:22\n      credentials: {}\n    steps: []\n'),
      ),
    ).toThrow(/credentials/);
    expect(() =>
      parseWorkflow(job('    container:\n      options: --init\n    steps: []\n')),
    ).toThrow(/image/);
  });

  it('reads the real ci.yml container jobs with the image the Linux stages use', () => {
    expect(ci.jobs['e2e-functional']?.container?.image).toMatch(
      /^mcr\.microsoft\.com\/playwright:v\d+\.\d+\.\d+-noble$/,
    );
    expect(ci.jobs.performance?.container).toBeUndefined();
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

describe('parseWorkflow local composite actions', () => {
  const ACTION = [
    'inputs:',
    '  install:',
    '    default: "true"',
    'runs:',
    '  using: composite',
    '  steps:',
    '    - uses: pnpm/action-setup@abc',
    '    - name: Install',
    "      if: inputs.install == 'true'",
    '      shell: bash',
    '      run: pnpm install --frozen-lockfile',
  ].join('\n');
  const loadAction = (path: string) => {
    if (path !== '.github/actions/setup') throw new Error(`unexpected action path ${path}`);
    return ACTION;
  };
  const caller = (withBlock = '') =>
    `jobs:\n  a:\n    runs-on: x\n    steps:\n      - uses: ./.github/actions/setup\n${withBlock}      - run: pnpm test\n`;
  const labels = (steps: { uses?: string; run?: string }[]) =>
    steps.map((step) => step.uses ?? step.run);

  it('reads the real ci.yml install as the steps of the shared setup action', () => {
    const steps = ci.jobs.test?.steps ?? [];
    const install = steps.filter((step) => step.run === 'pnpm install --frozen-lockfile');
    expect(install).toHaveLength(1);
    expect(install[0]?.name).toBe('Install');
    expect(install[0]?.if).toBeUndefined();
    expect(steps.some((step) => step.uses === './.github/actions/setup')).toBe(false);
  });

  it('replaces the call with the action steps, in order, before the steps that follow', () => {
    const steps = parseWorkflow(caller(), loadAction).jobs.a?.steps ?? [];
    expect(labels(steps)).toEqual([
      'pnpm/action-setup@abc',
      'pnpm install --frozen-lockfile',
      'pnpm test',
    ]);
    expect(steps[1]?.shell).toBe('bash');
  });

  it('drops a step whose input condition is false for the call', () => {
    const text = caller('        with:\n          install: "false"\n');
    const steps = parseWorkflow(text, loadAction).jobs.a?.steps ?? [];
    expect(labels(steps)).toEqual(['pnpm/action-setup@abc', 'pnpm test']);
  });

  it('refuses a condition it cannot evaluate', () => {
    const unevaluable = ACTION.replace("inputs.install == 'true'", 'always()');
    expect(() => parseWorkflow(caller(), () => unevaluable)).toThrow(/condition/);
  });

  it('refuses a call that carries a key it would drop, and an action that is not composite', () => {
    const withIf =
      'jobs:\n  a:\n    steps:\n      - uses: ./.github/actions/setup\n        if: always()\n';
    expect(() => parseWorkflow(withIf, loadAction)).toThrow(/"if"/);
    expect(() => parseWorkflow(caller(), () => 'runs:\n  using: node24\n')).toThrow(/composite/);
  });
});
