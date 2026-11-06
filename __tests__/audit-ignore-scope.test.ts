import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// behavioral-test-allow: the artifact under test IS package.json. This asserts a property OF
// the manifest (the audit gate may not carry an ignore list), which has no runtime surface to
// exercise instead.
const root = resolve(__dirname, '..');
const pkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8')) as {
  pnpm?: { auditConfig?: { ignoreGhsas?: string[] } };
};
const workspacePath = resolve(root, 'pnpm-workspace.yaml');
const workspace = existsSync(workspacePath) ? readFileSync(workspacePath, 'utf8') : '';

describe('audit gate carries no ignore list', () => {
  it('ignores no advisory, so every finding reaches `pnpm audit --audit-level=moderate`', () => {
    expect(
      pkg.pnpm?.auditConfig?.ignoreGhsas ?? [],
      'an ignored advisory hides a real finding. Fix it by raising an override or moving the dependency; if no fix exists, ignore it by GHSA id only, argue why every vulnerable copy is dev-only in DECISIONS.md, and replace this guard with a lockfile closure check that fails when a vulnerable version becomes reachable from `dependencies`.',
    ).toEqual([]);
  });

  it('keeps no audit config in pnpm-workspace.yaml, the other place pnpm reads it from', () => {
    expect(workspace).not.toMatch(/auditConfig|ignoreGhsas|ignoreCves/);
  });
});
