import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parse as parseYaml } from 'yaml';

const workflow = parseYaml(readFileSync(`${process.cwd()}/.github/workflows/ci.yml`, 'utf8')) as {
  jobs: Record<string, { steps: Array<{ name?: string; run?: string }> }>;
};

const manifestStep = Object.values(workflow.jobs)
  .flatMap((job) => job.steps)
  .find((step) => step.name === 'Write the build provenance manifest');

const runManifestStep = (env: NodeJS.ProcessEnv): string => {
  const dir = mkdtempSync(join(tmpdir(), 'manifest-step-'));
  mkdirSync(join(dir, '.next'), { recursive: true });
  writeFileSync(join(dir, '.next', 'subject.txt'), 'payload\n');
  execFileSync('bash', ['-c', manifestStep?.run ?? ''], {
    cwd: dir,
    env,
    stdio: 'pipe',
  });
  return join(dir, '.next', 'build-subjects.sha256');
};

describe('ci.yml build provenance manifest step', () => {
  it('is defined', () => {
    expect(manifestStep?.run).toBeTypeOf('string');
  });

  it('writes the manifest when RUNNER_TEMP is unset, as the local CI predictor runs it', () => {
    const env = { ...process.env };
    delete env.RUNNER_TEMP;

    const manifest = runManifestStep(env);

    expect(existsSync(manifest)).toBe(true);
    expect(readFileSync(manifest, 'utf8')).toContain('subject.txt');
  });

  it('writes the manifest when RUNNER_TEMP is set', () => {
    const dir = mkdtempSync(join(tmpdir(), 'manifest-runner-temp-'));
    const env = { ...process.env, RUNNER_TEMP: dir };

    const manifest = runManifestStep(env);

    expect(existsSync(manifest)).toBe(true);
  });
});
