import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { chainLeaves, coveredByCi, QUALITY_FAST_CI_ONLY_STEPS } from '../lib/ci-predict-policy';
import { parseWorkflow } from '../lib/ci-workflow';
import { prepareHooks } from '../prepare-hooks.mjs';

const ROOT = process.cwd();
const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')) as {
  scripts: Record<string, string>;
};
const ciText = readFileSync(join(ROOT, '.github/workflows/ci.yml'), 'utf8');
const workflow = parseWorkflow(ciText);
const BIOME_BIN = join(ROOT, 'node_modules/.bin/biome');
const WARN_ONLY_SOURCE = 'const value: string | undefined = undefined;\nexport const x = value!;\n';

describe('quality-fast steps are reproduced by the local verify chain', () => {
  const steps = (workflow.jobs['quality-fast']?.steps ?? []).filter(
    (s) => s.run !== undefined && s.uses === undefined,
  );

  it('finds the quality-fast steps', () => {
    expect(steps.length).toBeGreaterThan(10);
  });

  it('has every quality-fast step in verify or in the named exception list', () => {
    const leaves = chainLeaves(pkg.scripts, 'ci:local');
    const missing = steps
      .filter((s) => !QUALITY_FAST_CI_ONLY_STEPS.has(s.name ?? ''))
      .filter((s) => !leaves.some((leaf) => coveredByCi(leaf, [s.run?.trim() ?? ''], pkg.scripts)))
      .map((s) => s.name);
    expect(
      missing,
      'a CI step missing from verify passes locally and fails in CI. Add it to verify or to QUALITY_FAST_CI_ONLY_STEPS with its reason',
    ).toEqual([]);
  });

  it('keeps no exception for a step that no longer exists', () => {
    const names = new Set(steps.map((s) => s.name));
    const stale = [...QUALITY_FAST_CI_ONLY_STEPS.keys()].filter((name) => !names.has(name));
    expect(stale).toEqual([]);
  });

  it('runs the coverage threshold in verify', () => {
    expect(chainLeaves(pkg.scripts, 'ci:local')).toContain('pnpm test:coverage');
  });
});

describe('biome treats warnings as failures', () => {
  it('fails pnpm check and the CI biome step on a warn-level finding', () => {
    const dir = mkdtempSync(join(tmpdir(), 'biome-warn-'));
    try {
      const {
        vcs: _vcs,
        formatter: _formatter,
        ...rest
      } = JSON.parse(readFileSync(join(ROOT, 'biome.json'), 'utf8'));
      writeFileSync(
        join(dir, 'biome.json'),
        JSON.stringify({ ...rest, formatter: { enabled: false } }),
      );
      writeFileSync(join(dir, 'warn.ts'), WARN_ONLY_SOURCE);
      const control = spawnSync(BIOME_BIN, ['check', '.'], { cwd: dir, encoding: 'utf8' });
      expect(control.status, `the fixture must only warn\n${control.stdout}${control.stderr}`).toBe(
        0,
      );
      const ciStep = steps().find((s) => s.run?.includes('biome ci'))?.run ?? '';
      for (const script of [pkg.scripts.check ?? '', ciStep]) {
        const args = script
          .replace(/^(pnpm )?biome /, '')
          .split(' ')
          .filter(Boolean);
        const run = spawnSync(BIOME_BIN, args, { cwd: dir, encoding: 'utf8' });
        expect(run.status, `${script}\n${run.stdout}${run.stderr}`).not.toBe(0);
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  function steps() {
    return workflow.jobs['quality-fast']?.steps ?? [];
  }
});

describe('prepare hook install', () => {
  it('no longer swallows a failed install in package.json', () => {
    expect(pkg.scripts.prepare).not.toContain('|| true');
  });

  it('fails when the local hook install fails', () => {
    expect(prepareHooks({ env: {}, install: () => 1 })).toBe(1);
  });

  it('succeeds when the local hook install succeeds', () => {
    expect(prepareHooks({ env: {}, install: () => 0 })).toBe(0);
  });

  it.each([{ CI: 'true' }, { VERCEL: '1' }, { NODE_ENV: 'production' }])(
    'skips the install on %o',
    (env) => {
      let called = false;
      const code = prepareHooks({
        env,
        install: () => {
          called = true;
          return 1;
        },
      });
      expect(called).toBe(false);
      expect(code).toBe(0);
    },
  );
});
