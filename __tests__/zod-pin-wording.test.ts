import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = process.cwd();
const WORDING_SURFACES = ['AGENTS.md', 'CLAUDE.md', 'STANDARDS.md', '.agents'];
const EXACT_CLAIM =
  /`?zod`?\s+(?:is\s+)?(?:exact(?:-pinned)?|pinned exactly)|exact-pinned[^.\n]*`?zod`?/i;

function markdownFiles(path: string): string[] {
  const absolute = join(ROOT, path);
  if (!statSync(absolute).isDirectory()) return [path];
  return readdirSync(absolute, { recursive: true, encoding: 'utf8' })
    .filter((entry) => entry.endsWith('.md'))
    .map((entry) => join(path, entry));
}

describe('the zod pin as the docs describe it', () => {
  it('is a ~ range in package.json, which is what check-dep-pinning enforces', () => {
    // behavioral-test-allow: the manifest pin is the property the wording is compared against.
    const manifest = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')) as {
      dependencies: Record<string, string>;
    };
    expect(manifest.dependencies.zod).toMatch(/^~\d+\.\d+\.\d+$/);
  });

  it('is never called exact in the agent-facing docs', () => {
    const offenders = WORDING_SURFACES.flatMap(markdownFiles).filter((file) =>
      // behavioral-test-allow: the documentation text is the artifact under test.
      EXACT_CLAIM.test(readFileSync(join(ROOT, file), 'utf8')),
    );
    expect(offenders).toEqual([]);
  });
});
