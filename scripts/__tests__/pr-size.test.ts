import { describe, expect, it } from 'vitest';
import { toSubsystem } from '../pr-size-lib';

describe('toSubsystem — a subsystem is a directory, not a file', () => {
  it('collapses every root-level file into one `(root)` bucket', () => {
    for (const f of ['package.json', 'pnpm-lock.yaml', 'DECISIONS.md', 'README.md', '.gitignore']) {
      expect(toSubsystem(f)).toBe('(root)');
    }
    // the defect this fixes: 5 root files must count as ONE subsystem, not five
    const roots = ['package.json', 'pnpm-lock.yaml', 'DECISIONS.md', 'README.md', '.gitignore'];
    expect(new Set(roots.map(toSubsystem)).size).toBe(1);
  });

  it('counts a file one level deep as its directory, not the file', () => {
    expect(toSubsystem('content/hero.ts')).toBe('content');
    expect(toSubsystem('scripts/pr-size.ts')).toBe('scripts');
    expect(toSubsystem('.github/dependabot.yml')).toBe('.github');
    // several files in one dir are one subsystem
    const contentFiles = ['content/hero.ts', 'content/visa.ts', 'content/projects.ts'];
    expect(new Set(contentFiles.map(toSubsystem)).size).toBe(1);
  });

  it('keeps meaningful breadth for deeper trees, capped at two segments', () => {
    expect(toSubsystem('app/api/ask/route.ts')).toBe('app/api');
    expect(toSubsystem('app/design-system/tokens/page.mdx')).toBe('app/design-system');
    expect(toSubsystem('.github/workflows/ci.yml')).toBe('.github/workflows');
    // distinct second-level dirs remain distinct subsystems (real breadth is preserved)
    expect(toSubsystem('app/api/x/y.ts')).not.toBe(toSubsystem('app/design-system/z.tsx'));
  });
});
