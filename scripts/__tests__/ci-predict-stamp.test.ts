import { describe, expect, it } from 'vitest';
import { checkStamp, fingerprint, stampText } from '../lib/ci-predict-stamp';

const TREE = { head: 'a'.repeat(40), diff: '', untracked: [] as string[] };

describe('build stamp', () => {
  const stamp = stampText({ fingerprint: fingerprint(TREE), buildId: 'build-1' });

  it('accepts a .next that was built from this exact tree', () => {
    expect(checkStamp(stamp, { fingerprint: fingerprint(TREE), buildId: 'build-1' })).toEqual({
      valid: true,
      reason: '',
    });
  });

  it('refuses a .next with no stamp, such as one a dev server or another tool wrote', () => {
    const result = checkStamp(undefined, { fingerprint: fingerprint(TREE), buildId: 'build-1' });
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('without --skip-build');
  });

  it('refuses a .next built from another commit', () => {
    const other = fingerprint({ ...TREE, head: 'b'.repeat(40) });
    const result = checkStamp(stamp, { fingerprint: other, buildId: 'build-1' });
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('another tree');
  });

  it('refuses a .next built before a tracked edit or a new untracked file', () => {
    for (const changed of [
      { ...TREE, diff: '+edit' },
      { ...TREE, untracked: ['new-file.ts'] },
    ]) {
      expect(
        checkStamp(stamp, { fingerprint: fingerprint(changed), buildId: 'build-1' }).valid,
      ).toBe(false);
    }
  });

  it('refuses a .next whose build id changed after the stamp, or that has none', () => {
    expect(checkStamp(stamp, { fingerprint: fingerprint(TREE), buildId: 'build-2' }).valid).toBe(
      false,
    );
    expect(checkStamp(stamp, { fingerprint: fingerprint(TREE), buildId: undefined }).valid).toBe(
      false,
    );
  });

  it('refuses a stamp it cannot read', () => {
    expect(
      checkStamp('{not json', { fingerprint: fingerprint(TREE), buildId: 'build-1' }).valid,
    ).toBe(false);
  });
});
