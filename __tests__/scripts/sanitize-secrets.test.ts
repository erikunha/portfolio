import { describe, expect, it } from 'vitest';
import { sanitizeSecrets } from '@/scripts/lib/sanitize-secrets';

describe('sanitizeSecrets', () => {
  it('redacts classic gh tokens (ghp_, ghs_, gho_, ghu_, ghr_)', () => {
    expect(sanitizeSecrets('token: ghp_AbCdEf0123456789012345')).toBe('token: [REDACTED]');
    expect(sanitizeSecrets('token: ghs_AbCdEf0123456789012345')).toBe('token: [REDACTED]');
    expect(sanitizeSecrets('token: gho_AbCdEf0123456789012345')).toBe('token: [REDACTED]');
    expect(sanitizeSecrets('token: ghu_AbCdEf0123456789012345')).toBe('token: [REDACTED]');
    expect(sanitizeSecrets('token: ghr_AbCdEf0123456789012345')).toBe('token: [REDACTED]');
  });

  it('redacts fine-grained PATs (github_pat_*)', () => {
    expect(sanitizeSecrets('pat: github_pat_AbCdEf0123456789_xyz')).toBe('pat: [REDACTED]');
  });

  it('leaves non-token text intact', () => {
    expect(sanitizeSecrets('PR #42 unresolved threads: T_kwDO123')).toBe(
      'PR #42 unresolved threads: T_kwDO123',
    );
  });

  it('redacts multiple tokens in one string', () => {
    expect(sanitizeSecrets('a ghp_AbCdEf0123456789012345 b ghs_XyZ012345678901234567 c')).toBe(
      'a [REDACTED] b [REDACTED] c',
    );
  });
});
