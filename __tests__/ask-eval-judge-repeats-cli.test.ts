// @vitest-environment node

import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { MAX_JUDGE_REPEATS } from '@/lib/eval/judge-repeats';

const ROOT = path.resolve(__dirname, '..');
const TSX = path.join(ROOT, 'node_modules', '.bin', 'tsx');
const CLI_TIMEOUT_MS = 90_000;

function runCli(args: string[]) {
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    TSX_TSCONFIG_PATH: 'scripts/tsconfig.eval.json',
  };
  for (const name of ['AI_GATEWAY_API_KEY', 'VERCEL_OIDC_TOKEN', 'CI', 'EVAL_PUBLISH']) {
    delete env[name];
  }
  return spawnSync(TSX, ['scripts/ask-eval.ts', ...args], {
    cwd: ROOT,
    env,
    encoding: 'utf8',
    timeout: CLI_TIMEOUT_MS,
  });
}

describe('ask-eval command line', () => {
  it(
    'rejects an out-of-range --judge-repeats with a clear message and exit 1',
    () => {
      const out = runCli(['--judge-repeats', '0']);
      expect(out.status).toBe(1);
      expect(out.stderr).toContain(
        `--judge-repeats must be an integer from 1 to ${MAX_JUDGE_REPEATS}`,
      );
    },
    CLI_TIMEOUT_MS,
  );

  it(
    'accepts a valid --judge-repeats and then skips without a gateway credential',
    () => {
      const out = runCli(['--judge-repeats', '5']);
      expect(out.status).toBe(0);
      expect(out.stdout).toContain('ai-eval skipped');
    },
    CLI_TIMEOUT_MS,
  );
});
