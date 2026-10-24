import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';

// behavioral-test-allow: the artifacts under test ARE package.json and pnpm-lock.yaml.
// This asserts a property OF the manifests (the audit gate ignores nothing, and the package
// that once justified an ignore is gone from the graph), which has no runtime surface.
const root = resolve(__dirname, '..');
const pkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8')) as {
  pnpm?: { auditConfig?: { ignoreGhsas?: string[] } };
};
const lock = parse(readFileSync(resolve(root, 'pnpm-lock.yaml'), 'utf8')) as {
  snapshots?: Record<string, unknown>;
};

describe('audit gate ignores nothing', () => {
  it('has no ignored advisories, so every finding reds pnpm audit', () => {
    expect(
      pkg.pnpm?.auditConfig?.ignoreGhsas ?? [],
      'an advisory is being ignored. Fix it with an upgrade or override; an ignore needs its own DECISIONS.md entry and a test that holds its justification.',
    ).toEqual([]);
  });

  it('keeps extract-zip out of the lockfile entirely', () => {
    const extractZip = Object.keys(lock.snapshots ?? {}).filter((key) =>
      key.startsWith('extract-zip@'),
    );
    expect(
      extractZip,
      'extract-zip is back in the graph. It has unpatched advisories; the @puppeteer/browsers ^3 override in package.json is what removes it.',
    ).toEqual([]);
  });
});
