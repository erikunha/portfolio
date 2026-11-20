// @vitest-environment node
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = join(import.meta.dirname, '../..');
const requireFromRoot = createRequire(join(ROOT, 'package.json'));

const POLYFILL_FILES = [
  'dist/build/polyfills/polyfill-module.js',
  'dist/build/polyfills/polyfill-nomodule.js',
] as const;
const APP_GLOBALS = 'dist/client/app-globals.js';
const POLYFILL_REQUIRE = 'require("../build/polyfills/polyfill-module")';
const STUB_MAX_BYTES = 256;
const POLYFILL_SIGNALS = ['Object.defineProperty', 'Array.prototype.at', 'Object.hasOwn'];
const DIFF_HEADER = /^diff --git a\/(\S+) b\/(\S+)$/gm;

interface PackageJson {
  scripts?: Record<string, string>;
  pnpm?: { patchedDependencies?: Record<string, string> };
}

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, 'utf8')) as T;
}

const manifest = readJson<PackageJson>(join(ROOT, 'package.json'));
const nextVersion = readJson<{ version: string }>(
  requireFromRoot.resolve('next/package.json'),
).version;
const patchKey = `next@${nextVersion}`;
const patchPath = `patches/${patchKey}.patch`;
const nextFile = (file: string) => requireFromRoot.resolve(`next/${file}`);

describe('the pnpm patch that empties the Next.js polyfill bundles', () => {
  it('is registered for the installed Next.js version', () => {
    expect(
      manifest.pnpm?.patchedDependencies?.[patchKey],
      `package.json pnpm.patchedDependencies has no entry for ${patchKey}. A Next.js bump needs a new patch: run \`pnpm patch next@${nextVersion}\`, empty the two polyfill files, and \`pnpm patch-commit\``,
    ).toBe(patchPath);
    expect(existsSync(join(ROOT, patchPath)), `${patchPath} is missing`).toBe(true);
  });

  it('changes only the two polyfill bundles', () => {
    const patch = readFileSync(join(ROOT, patchPath), 'utf8');
    const touched = Array.from(patch.matchAll(DIFF_HEADER), (match) => match[2]).sort();
    expect(touched).toEqual([...POLYFILL_FILES].sort());
  });

  it.each(POLYFILL_FILES)('leaves %s installed as a stub with no polyfill code', (file) => {
    const content = readFileSync(nextFile(file), 'utf8');
    expect(
      Buffer.byteLength(content, 'utf8'),
      `${file} is not the patched stub. Run \`pnpm install\` so the patch applies`,
    ).toBeLessThanOrEqual(STUB_MAX_BYTES);
    for (const signal of POLYFILL_SIGNALS) expect(content).not.toContain(signal);
  });

  it('targets the module the App Router client entry still loads', () => {
    expect(
      readFileSync(nextFile(APP_GLOBALS), 'utf8'),
      'Next.js no longer loads polyfill-module from app-globals; re-check where the polyfills come from before trusting the patch',
    ).toContain(POLYFILL_REQUIRE);
  });

  it('runs no postinstall that rewrites node_modules', () => {
    expect(manifest.scripts?.postinstall).toBeUndefined();
  });
});
