import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { chainLeaves } from '../ci/ci-full-stages';
import {
  DEFAULT_CONCURRENCY,
  exitCodeFor,
  parseVerifyArgs,
  renderReport,
  runSteps,
  type StepOutcome,
  VERIFY_STEPS,
  type VerifyStep,
  verifyLeaves,
} from '../ci/verify';

const pkg = JSON.parse(readFileSync(join(process.cwd(), 'package.json'), 'utf8')) as {
  scripts: Record<string, string>;
};

const PRIOR_CHAIN: readonly string[] = [
  'pnpm check',
  'pnpm typecheck',
  'pnpm validate-content',
  'pnpm check:client-naming',
  'pnpm check:shell-dom-writes',
  'pnpm check:css-ownership',
  'pnpm check:dep-pinning',
  'pnpm check:dependency-vetting',
  'pnpm check:harness-size',
  'pnpm check:component-docs',
  'pnpm check:section-order',
  'pnpm check:doc-drift',
  'pnpm check:no-dashes',
  'pnpm check:detect-changes-paths',
  'pnpm check:test-integrity',
  'pnpm lint:contrast',
  'pnpm lint:css-tokens',
  'pnpm test:coverage',
];
const ADDED_SINCE: readonly string[] = ['pnpm check:decisions-index'];
const TICK_MS = 5;

const step = (id: string, needs: readonly string[] = []): VerifyStep => ({
  id,
  command: `pnpm ${id}`,
  needs,
});

const pause = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

describe('the verify step list', () => {
  it('runs the same gates as the chain it replaced, plus the DECISIONS index gate', () => {
    expect([...verifyLeaves()].sort()).toEqual([...PRIOR_CHAIN, ...ADDED_SINCE].sort());
  });

  it('places the DECISIONS index gate right after the doc drift gate', () => {
    const leaves = verifyLeaves();
    expect(leaves.indexOf('pnpm check:decisions-index')).toBe(
      leaves.indexOf('pnpm check:doc-drift') + 1,
    );
  });

  it('names every gate once and points each at an existing package script', () => {
    const leaves = verifyLeaves();
    expect(new Set(leaves).size).toBe(leaves.length);
    for (const leaf of leaves) {
      expect(
        pkg.scripts[leaf.replace(/^pnpm /, '')],
        `${leaf} is not a package script`,
      ).toBeDefined();
    }
  });

  it('only waits on steps that exist and that come earlier in the list', () => {
    const seen = new Set<string>();
    for (const entry of VERIFY_STEPS) {
      for (const need of entry.needs) {
        expect(seen.has(need), `${entry.id} waits on ${need}`).toBe(true);
      }
      seen.add(entry.id);
    }
  });

  it('is what package.json verify runs, and ci:local stays an alias of verify', () => {
    expect(pkg.scripts.verify).toBe('tsx scripts/ci/verify.ts');
    expect(pkg.scripts['ci:local']).toBe('pnpm verify');
  });

  it('is what the chain readers see behind ci:local, so the parity tests read this list', () => {
    expect(chainLeaves(pkg.scripts, 'ci:local')).toEqual(verifyLeaves());
  });

  it('keeps the doctor script', () => {
    expect(pkg.scripts.doctor).toBe('tsx scripts/ci/doctor.ts');
  });
});

describe('runSteps', () => {
  it('runs independent steps at the same time, up to the concurrency cap', async () => {
    let active = 0;
    let peak = 0;
    const outcomes = await runSteps([step('a'), step('b'), step('c'), step('d')], {
      concurrency: 2,
      execute: async () => {
        active += 1;
        peak = Math.max(peak, active);
        await pause(TICK_MS);
        active -= 1;
        return { code: 0, output: '' };
      },
    });
    expect(peak).toBe(2);
    expect(outcomes.map((o) => o.verdict)).toEqual(['passed', 'passed', 'passed', 'passed']);
  });

  it('does not start a dependent step before the step it waits on has finished', async () => {
    const log: string[] = [];
    await runSteps([step('first'), step('second', ['first']), step('free')], {
      concurrency: 3,
      execute: async (entry) => {
        log.push(`start ${entry.id}`);
        await pause(entry.id === 'first' ? TICK_MS * 3 : 0);
        log.push(`end ${entry.id}`);
        return { code: 0, output: '' };
      },
    });
    expect(log.indexOf('start second')).toBeGreaterThan(log.indexOf('end first'));
    expect(log.indexOf('start free')).toBeLessThan(log.indexOf('end first'));
  });

  it('skips the steps that wait on a failed step and still runs the independent ones', async () => {
    const ran: string[] = [];
    const outcomes = await runSteps([step('bad'), step('after', ['bad']), step('free')], {
      concurrency: 3,
      execute: async (entry) => {
        ran.push(entry.id);
        return { code: entry.id === 'bad' ? 1 : 0, output: `${entry.id} output` };
      },
    });
    expect(ran).toEqual(['bad', 'free']);
    expect(outcomes.map((o) => [o.id, o.verdict])).toEqual([
      ['bad', 'failed'],
      ['after', 'skipped'],
      ['free', 'passed'],
    ]);
  });

  it('returns the outcomes in list order whatever order they finished in', async () => {
    const outcomes = await runSteps([step('slow'), step('fast')], {
      concurrency: 2,
      execute: async (entry) => {
        await pause(entry.id === 'slow' ? TICK_MS * 3 : 0);
        return { code: 0, output: '' };
      },
    });
    expect(outcomes.map((o) => o.id)).toEqual(['slow', 'fast']);
  });

  it('treats a step that throws as failed', async () => {
    const outcomes = await runSteps([step('boom')], {
      concurrency: 1,
      execute: async () => {
        throw new Error('spawn failed');
      },
    });
    expect(outcomes[0]?.verdict).toBe('failed');
    expect(outcomes[0]?.output).toContain('spawn failed');
  });

  it('refuses a step that waits on an unknown step', async () => {
    await expect(
      runSteps([step('a', ['ghost'])], {
        concurrency: 1,
        execute: async () => ({ code: 0, output: '' }),
      }),
    ).rejects.toThrow(/ghost/);
  });
});

describe('exit code and report', () => {
  const outcome = (id: string, verdict: StepOutcome['verdict'], output = ''): StepOutcome => ({
    id,
    command: `pnpm ${id}`,
    verdict,
    seconds: 1.5,
    output,
  });

  it('exits 0 only when every step passed', () => {
    expect(exitCodeFor([outcome('a', 'passed'), outcome('b', 'passed')])).toBe(0);
  });

  it('exits non-zero when one step failed', () => {
    expect(exitCodeFor([outcome('a', 'passed'), outcome('b', 'failed')])).not.toBe(0);
  });

  it('exits non-zero when a step was skipped', () => {
    expect(exitCodeFor([outcome('a', 'skipped')])).not.toBe(0);
  });

  it('prints the output of a failed step under its own heading and the table last', () => {
    const report = renderReport([
      outcome('check', 'passed', 'quiet pass'),
      outcome('typecheck', 'failed', 'error TS2322'),
    ]);
    expect(report).toContain('error TS2322');
    expect(report).not.toContain('quiet pass');
    expect(report.indexOf('error TS2322')).toBeLessThan(report.lastIndexOf('pnpm check'));
    expect(report).toMatch(/1 passed, 1 failed, 0 skipped/);
  });

  it('prints the output of passing steps when verbose', () => {
    expect(renderReport([outcome('check', 'passed', 'quiet pass')], { verbose: true })).toContain(
      'quiet pass',
    );
  });
});

describe('parseVerifyArgs', () => {
  it('defaults to the named concurrency', () => {
    expect(parseVerifyArgs([], {})).toEqual({ concurrency: DEFAULT_CONCURRENCY, verbose: false });
  });

  it('reads --concurrency, --verbose and the environment', () => {
    expect(parseVerifyArgs(['--concurrency', '2', '--verbose'], {})).toEqual({
      concurrency: 2,
      verbose: true,
    });
    expect(parseVerifyArgs([], { VERIFY_CONCURRENCY: '3' }).concurrency).toBe(3);
  });

  it.each([['--concurrency', '0'], ['--concurrency', 'x'], ['--unknown']])(
    'rejects %j',
    (...argv) => {
      expect(() => parseVerifyArgs(argv, {})).toThrow();
    },
  );
});
