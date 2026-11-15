import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

const SUBPROCESS_TEST_TIMEOUT_MS = 60_000;

const SCRIPT = path.resolve('scripts/gates/check-client-naming.ts');
const WALK_HELPER = path.resolve('scripts/lib/walk.ts');
const roots: string[] = [];

function run(relativeFile: string) {
  const root = mkdtempSync(path.join(tmpdir(), 'client-naming-'));
  roots.push(root);
  mkdirSync(path.join(root, 'scripts/gates'), { recursive: true });
  mkdirSync(path.join(root, 'scripts/lib'), { recursive: true });
  copyFileSync(WALK_HELPER, path.join(root, 'scripts/lib/walk.ts'));
  const copy = path.join(root, 'scripts/gates/check-client-naming.ts');
  copyFileSync(SCRIPT, copy);
  const file = path.join(root, relativeFile);
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, "'use client';\nexport const X = 1;\n");
  return spawnSync('node', [copy], { encoding: 'utf-8' });
}

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe('check-client-naming scan roots', { timeout: SUBPROCESS_TEST_TIMEOUT_MS }, () => {
  it('fails a use-client file under design-system without the suffix', () => {
    const result = run('design-system/components/Bad/Bad.tsx');
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('design-system/components/Bad/Bad.tsx');
  });

  it('accepts a use-client file under design-system with the suffix', () => {
    expect(run('design-system/components/Ok/Ok.client.tsx').status).toBe(0);
  });
});
