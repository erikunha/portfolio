import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { conditionHolds, evaluate, interpolate, parseWorkflow } from '../lib/ci-workflow';

const ci = parseWorkflow(readFileSync(`${process.cwd()}/.github/workflows/ci.yml`, 'utf8'));

const pr = {
  github: {
    event_name: 'pull_request',
    repository: 'o/r',
    event: { pull_request: { head: { repo: { full_name: 'o/r' } } } },
  },
  needs: {
    'detect-changes': { result: 'success', outputs: { ai: 'true', app: 'false', ui: 'false' } },
    test: { result: 'success', outputs: {} },
  },
};

describe('evaluate', () => {
  it('resolves the matrix ternary the install step uses', () => {
    const expr = "contains(matrix.project, 'webkit') && 'webkit' || 'chromium'";
    expect(evaluate(expr, { matrix: { project: 'webkit-mobile' } })).toBe('webkit');
    expect(evaluate(expr, { matrix: { project: 'chromium-mobile' } })).toBe('chromium');
  });

  it('negates endsWith and compares hyphenated needs keys', () => {
    expect(
      evaluate("!endsWith(matrix.project, '-components')", { matrix: { project: 'chromium' } }),
    ).toBe(true);
    expect(evaluate("needs.detect-changes.outputs.ai == 'true'", pr)).toBe(true);
    expect(evaluate("needs.detect-changes.outputs.app == 'true'", pr)).toBe(false);
  });

  it('evaluates the ai-eval gate with the wildcard needs result filter', () => {
    const expr =
      "always() && (github.event_name != 'pull_request' || github.event.pull_request.head.repo.full_name == github.repository) && needs.detect-changes.outputs.ai == 'true' && !contains(needs.*.result, 'failure') && !contains(needs.*.result, 'cancelled')";
    expect(evaluate(expr, pr)).toBe(true);
    const failed = { ...pr, needs: { ...pr.needs, test: { result: 'failure', outputs: {} } } };
    expect(evaluate(expr, failed)).toBe(false);
  });

  it('treats a missing step output and any secret as an empty string', () => {
    expect(evaluate('steps.nope.outputs.value', { steps: {} })).toBeUndefined();
    expect(evaluate('secrets.ANY_KEY', {})).toBe('');
  });

  it('reports each secret it read as empty, in expressions, interpolation and conditions', () => {
    const seen: string[] = [];
    const onSecret = (name: string) => seen.push(name);
    evaluate('secrets.FIRST', {}, {}, onSecret);
    interpolate(['$', '{{ secrets.SECOND }}'].join(''), {}, onSecret);
    conditionHolds("secrets.THIRD != ''", {}, {}, onSecret);
    expect(seen).toEqual(['FIRST', 'SECOND', 'THIRD']);
  });

  it('refuses a context root the caller did not populate instead of reading it as empty', () => {
    expect(() => evaluate('runner.os', {})).toThrow(/runner/);
    expect(() => evaluate("vars.FLAG == 'x'", { github: {} })).toThrow(/vars/);
    expect(() => interpolate(['$', '{{ strategy.job-total }}'].join(''), {})).toThrow(/strategy/);
  });

  it('reads a populated root whose key is missing as empty', () => {
    expect(evaluate('env.MISSING', { env: {} })).toBeUndefined();
    expect(evaluate("env.MISSING == ''", { env: {} })).toBe(true);
  });

  it('evaluates a function the caller supplies, such as a file existence check', () => {
    const present = { hashFiles: () => 'abc' };
    expect(evaluate("hashFiles('x') != ''", {}, present)).toBe(true);
    expect(evaluate("hashFiles('x') != ''", {}, { hashFiles: () => '' })).toBe(false);
  });

  it('refuses a function it cannot evaluate rather than guessing', () => {
    expect(() => evaluate("hashFiles('pnpm-lock.yaml')", {})).toThrow(/unsupported/i);
  });
});

describe('interpolate', () => {
  it('replaces workflow expressions and leaves shell parameter expansion alone', () => {
    // biome-ignore lint/suspicious/noTemplateCurlyInString: the shell parameter expansion is the input under test
    const text = 'v=${ImageVersion:-unknown} p=${{ matrix.project }} s=${{ secrets.X }}';
    expect(interpolate(text, { matrix: { project: 'chromium' } })).toBe(
      // biome-ignore lint/suspicious/noTemplateCurlyInString: the shell parameter expansion is the expected output
      'v=${ImageVersion:-unknown} p=chromium s=',
    );
  });
});

describe('conditionHolds', () => {
  it('accepts a bare expression and a wrapped one, and treats no condition as true', () => {
    expect(conditionHolds(undefined, {})).toBe(true);
    expect(conditionHolds("github.event_name == 'pull_request'", pr)).toBe(true);
    // biome-ignore lint/suspicious/noTemplateCurlyInString: a wrapped workflow condition is the input under test
    expect(conditionHolds("${{ github.event_name == 'push' }}", pr)).toBe(false);
  });
});

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
