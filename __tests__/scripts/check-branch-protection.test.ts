import { describe, expect, it, vi } from 'vitest';
import { evaluateBranchProtection } from '@/scripts/check-branch-protection';

function mockGh(payload: unknown, opts: { reject?: Error } = {}) {
  return vi.fn(async () => {
    if (opts.reject) throw opts.reject;
    return JSON.stringify(payload);
  });
}

describe('evaluateBranchProtection', () => {
  it('passes when required_conversation_resolution.enabled is true', async () => {
    const ghExec = mockGh({ required_conversation_resolution: { enabled: true } });
    const r = await evaluateBranchProtection({
      owner: 'erikunha',
      repo: 'portfolio',
      branch: 'main',
      ghExec,
    });
    expect(r.ok).toBe(true);
  });

  it('fails with code "conversation_resolution_off" when enabled is false', async () => {
    const ghExec = mockGh({ required_conversation_resolution: { enabled: false } });
    const r = await evaluateBranchProtection({
      owner: 'erikunha',
      repo: 'portfolio',
      branch: 'main',
      ghExec,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('conversation_resolution_off');
  });

  it('fails with code "conversation_resolution_off" when block is missing entirely', async () => {
    const ghExec = mockGh({});
    const r = await evaluateBranchProtection({
      owner: 'erikunha',
      repo: 'portfolio',
      branch: 'main',
      ghExec,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('conversation_resolution_off');
  });

  it('fails with code "branch_unprotected" when gh returns 404-style error', async () => {
    const ghExec = mockGh(null, { reject: new Error('HTTP 404: Branch not protected') });
    const r = await evaluateBranchProtection({
      owner: 'erikunha',
      repo: 'portfolio',
      branch: 'main',
      ghExec,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('branch_unprotected');
  });

  it('fails with code "gh_auth_missing" on auth error', async () => {
    const ghExec = mockGh(null, { reject: new Error('gh: auth required') });
    const r = await evaluateBranchProtection({
      owner: 'erikunha',
      repo: 'portfolio',
      branch: 'main',
      ghExec,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('gh_auth_missing');
  });
});
