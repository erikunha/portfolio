import { execFile } from 'node:child_process';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const execFileP = promisify(execFile);

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const gateScript = path.join(repoRoot, 'scripts', 'check-claude-approval.ts');
const tsxCli = path.join(repoRoot, 'node_modules', 'tsx', 'dist', 'cli.mjs');

const COMPARE_FILES_CAP = 300;
const HEAD = `f9a5d56${'a'.repeat(33)}`;
const REVIEWED = `0563abe${'b'.repeat(33)}`;
const OTHER = `c0ffee1${'c'.repeat(33)}`;

const FAKE_GH = `#!/bin/bash
args="$*"
case "$args" in
  *"repo view"*) echo "erikunha/portfolio" ;;
  *"/compare/"*) printf '{"merge_base_commit":{"sha":"%s"},"files":%s}' "$FAKE_MERGE_BASE" "$FAKE_FILES_JSON" ;;
  *"/issues/"*) printf '[{"user":{"login":"claude[bot]"},"body":"Reviewed at head commit \`%s\`. **Approve.**","created_at":"2026-11-03T12:00:00Z"}]' "$FAKE_REVIEWED" ;;
  *"/pulls/"*) echo "$FAKE_HEAD" ;;
  *) echo "unexpected gh call: $args" >&2; exit 1 ;;
esac
`;

let stubDir: string;

beforeAll(async () => {
  stubDir = await mkdtemp(path.join(tmpdir(), 'fake-gh-'));
  const stubPath = path.join(stubDir, 'gh');
  await writeFile(stubPath, FAKE_GH, { mode: 0o755 });
});

afterAll(async () => {
  await promisify(execFile)('rm', ['-rf', stubDir]);
});

type GateRun = { code: number; stdout: string; stderr: string };

async function runGate(env: Record<string, string>): Promise<GateRun> {
  try {
    const { stdout, stderr } = await execFileP(process.execPath, [tsxCli, gateScript, '332'], {
      cwd: repoRoot,
      timeout: 60_000,
      env: {
        ...process.env,
        PATH: `${stubDir}:${path.join(repoRoot, 'node_modules', '.bin')}:${process.env.PATH}`,
        FAKE_HEAD: HEAD,
        FAKE_REVIEWED: REVIEWED,
        ...env,
      },
    });
    return { code: 0, stdout, stderr };
  } catch (error) {
    const err = error as { code?: number; stdout?: string; stderr?: string };
    return { code: err.code ?? 1, stdout: err.stdout ?? '', stderr: err.stderr ?? '' };
  }
}

const BASELINES_ONLY = JSON.stringify([
  { filename: 'tests/visual/visual.spec.ts-snapshots/home-linux.png' },
  { filename: 'tests/e2e/design-system-components.spec.ts-snapshots/ds-chromium.png' },
]);

const MIXED = JSON.stringify([
  { filename: 'tests/visual/visual.spec.ts-snapshots/home-linux.png' },
  { filename: 'src/app/page.tsx' },
]);

describe('check-claude-approval run() end to end (mocked gh)', () => {
  it('carries the Approve when only visual baselines changed since the reviewed SHA', async () => {
    const r = await runGate({ FAKE_MERGE_BASE: REVIEWED, FAKE_FILES_JSON: BASELINES_ONLY });
    expect(r.code).toBe(0);
    expect(r.stdout).toMatch(/carried: baseline-only commits/);
  });

  it('fails STALE when the compare file list is at the API cap and may be truncated', async () => {
    const capped = JSON.stringify(
      Array.from({ length: COMPARE_FILES_CAP }, (_, index) => ({
        filename: `tests/visual/visual.spec.ts-snapshots/shot-${index}-linux.png`,
      })),
    );
    const r = await runGate({ FAKE_MERGE_BASE: REVIEWED, FAKE_FILES_JSON: capped });
    expect(r.code).toBe(1);
    expect(r.stderr).toMatch(/STALE/);
  });

  it('fails STALE when a non-baseline file changed since the reviewed SHA', async () => {
    const r = await runGate({ FAKE_MERGE_BASE: REVIEWED, FAKE_FILES_JSON: MIXED });
    expect(r.code).toBe(1);
    expect(r.stderr).toMatch(/STALE/);
  });

  it('fails STALE when the reviewed SHA is not an ancestor of HEAD (force-push)', async () => {
    const r = await runGate({ FAKE_MERGE_BASE: OTHER, FAKE_FILES_JSON: BASELINES_ONLY });
    expect(r.code).toBe(1);
    expect(r.stderr).toMatch(/STALE/);
  });

  it('fails STALE when the compare reports an empty diff', async () => {
    const r = await runGate({ FAKE_MERGE_BASE: REVIEWED, FAKE_FILES_JSON: '[]' });
    expect(r.code).toBe(1);
    expect(r.stderr).toMatch(/STALE/);
  });
});
