import { describe, expect, it } from 'vitest';
import { autoGenHeader, hasAutoGenHeader } from '@/scripts/lib/copilot/auto-gen-header';

describe('autoGenHeader', () => {
  it('contains the AUTO-GENERATED marker', () => {
    const h = autoGenHeader('CLAUDE.md');
    expect(h).toContain('AUTO-GENERATED');
  });

  it('cites the source file path', () => {
    const h = autoGenHeader('CLAUDE.md');
    expect(h).toContain('CLAUDE.md');
  });

  it('warns against manual edits', () => {
    const h = autoGenHeader('x.md');
    expect(h.toLowerCase()).toContain('do not edit');
  });
});

describe('hasAutoGenHeader', () => {
  it('returns true when content begins with marker', () => {
    const content = `${autoGenHeader('a.md')}\n\nbody`;
    expect(hasAutoGenHeader(content)).toBe(true);
  });

  it('returns false when content lacks marker', () => {
    expect(hasAutoGenHeader('# just a doc\n')).toBe(false);
  });
});
