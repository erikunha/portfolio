import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { inheritedEnvWithIsolatedGit } from '../../__tests__/helpers/hermetic-git';
import { aiDependencyVersions, computeCategories } from '../detect-changes.mjs';

const SUBPROCESS_TEST_TIMEOUT_MS = 60_000;

function lock(entries: Record<string, string>): string {
  const packages = Object.entries(entries)
    .map(([name, version]) => {
      const key = name.startsWith('@') ? `'${name}@${version}'` : `${name}@${version}`;
      return `  ${key}:\n    resolution: {integrity: sha512-x}\n`;
    })
    .join('\n');
  const snapshot =
    entries.ai === undefined
      ? ''
      : `  ai@${entries.ai}(zod@4.6.7):\n    dependencies:\n      zod: 4.6.7\n`;
  return `lockfileVersion: '9.0'\n\npackages:\n\n${packages}\nsnapshots:\n\n${snapshot}`;
}

describe('aiDependencyVersions', () => {
  it('lists ai, @ai-sdk/* and langfuse* with their resolved versions, sorted', () => {
    const text = lock({
      zod: '4.6.7',
      ai: '7.0.164',
      '@ai-sdk/gateway': '4.0.137',
      'langfuse-vercel': '3.39.2',
      '@langfuse/core': '4.0.0',
      react: '19.2.0',
    });
    expect(aiDependencyVersions(text)).toEqual([
      '@ai-sdk/gateway@4.0.137',
      '@langfuse/core@4.0.0',
      'ai@7.0.164',
      'langfuse-vercel@3.39.2',
    ]);
  });

  it('ignores packages that merely contain the letters ai', () => {
    expect(aiDependencyVersions(lock({ aiohttp: '1.0.0', 'tailwind-ai': '2.0.0' }))).toEqual([]);
  });

  it('does not double count the peer-suffixed snapshot of a package', () => {
    expect(aiDependencyVersions(lock({ ai: '7.0.164' }))).toEqual(['ai@7.0.164']);
  });
});

describe('computeCategories with an AI dependency lockfile change', () => {
  const none = { aiChanged: false, appChanged: true, uiChanged: false, pkgRenderChanged: false };

  it('arms ai from aiLockChanged alone', () => {
    expect(computeCategories({ ...none, aiLockChanged: true }).ai).toBe(true);
  });

  it('leaves ai off when only unrelated packages changed', () => {
    expect(computeCategories({ ...none, aiLockChanged: false }).ai).toBe(false);
  });
});

describe('detect-changes main() on a lockfile-only commit', {
  timeout: SUBPROCESS_TEST_TIMEOUT_MS,
}, () => {
  const runner = resolve(process.cwd(), 'scripts/detect-changes.mjs');

  function categoriesFor(baseLock: string, headLock: string): string {
    const dir = mkdtempSync(join(tmpdir(), 'dc-ailock-'));
    const git = (...args: string[]) =>
      execFileSync('git', args, {
        cwd: dir,
        encoding: 'utf8',
        env: inheritedEnvWithIsolatedGit(),
      }).trim();
    try {
      git('init', '-b', 'main');
      git('config', 'user.email', 't@t.dev');
      git('config', 'user.name', 't');
      writeFileSync(join(dir, 'package.json'), JSON.stringify({ dependencies: { ai: '^7.0.14' } }));
      writeFileSync(join(dir, 'pnpm-lock.yaml'), baseLock);
      git('add', '-A');
      git('commit', '-m', 'base');
      const base = git('rev-parse', 'HEAD');
      writeFileSync(join(dir, 'pnpm-lock.yaml'), headLock);
      git('add', '-A');
      git('commit', '-m', 'lock');
      const head = git('rev-parse', 'HEAD');
      const out = join(dir, 'gh_output');
      execFileSync('node', [runner], {
        cwd: dir,
        env: inheritedEnvWithIsolatedGit({
          EVENT_NAME: 'pull_request',
          BASE_SHA: base,
          HEAD_SHA: head,
          GITHUB_OUTPUT: out,
        }),
      });
      return readFileSync(out, 'utf8');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }

  it('arms ai when the lockfile resolves a new ai patch version', () => {
    expect(categoriesFor(lock({ ai: '7.0.164' }), lock({ ai: '7.0.165' }))).toContain('ai=true');
  });

  it('arms ai when a transitive @ai-sdk package moves', () => {
    expect(
      categoriesFor(
        lock({ ai: '7.0.164', '@ai-sdk/gateway': '4.0.137' }),
        lock({ ai: '7.0.164', '@ai-sdk/gateway': '4.0.138' }),
      ),
    ).toContain('ai=true');
  });

  it('leaves ai off when an unrelated package moves', () => {
    expect(
      categoriesFor(lock({ ai: '7.0.164', zod: '4.6.7' }), lock({ ai: '7.0.164', zod: '4.6.8' })),
    ).toContain('ai=false');
  });
});
