import { describe, expect, it, vi } from 'vitest';
import { evaluateBranchProtection } from '@/scripts/check-branch-protection';

function mockGh(payload: unknown, opts: { reject?: Error } = {}) {
  return vi.fn(async () => {
    if (opts.reject) throw opts.reject;
    return JSON.stringify(payload);
  });
}

describe('evaluateBranchProtection', () => {
  it('passes when conversation resolution is on and classic protection requires checks', async () => {
    const ghExec = mockGh({
      required_conversation_resolution: { enabled: true },
      required_status_checks: { contexts: ['typecheck'] },
    });
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

function routingGh(routes: {
  protection?: unknown;
  rules?: unknown;
  rulesReject?: Error;
  rulesRaw?: string;
}) {
  return vi.fn(async (args: string[]) => {
    const path = args[1] ?? '';
    if (path.includes('/rules/branches/')) {
      if (routes.rulesReject) throw routes.rulesReject;
      if (routes.rulesRaw !== undefined) return routes.rulesRaw;
      return JSON.stringify(routes.rules ?? []);
    }
    return JSON.stringify(routes.protection ?? {});
  });
}

const CONVO_ON = { required_conversation_resolution: { enabled: true } };

describe('evaluateBranchProtection — required status checks enforcement', () => {
  it('fails with "required_status_checks_unenforced" when classic has none and no ruleset rule applies (the inert-ruleset incident)', async () => {
    const ghExec = routingGh({ protection: CONVO_ON, rules: [] });
    const r = await evaluateBranchProtection({
      owner: 'erikunha',
      repo: 'portfolio',
      branch: 'main',
      ghExec,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.code).toBe('required_status_checks_unenforced');
      expect(r.message).toContain('required_status_checks');
    }
  });

  it('passes when an applied ruleset rule requires status checks', async () => {
    const ghExec = routingGh({
      protection: CONVO_ON,
      rules: [
        {
          type: 'required_status_checks',
          parameters: { required_status_checks: [{ context: 'typecheck' }, { context: 'build' }] },
        },
      ],
    });
    const r = await evaluateBranchProtection({
      owner: 'erikunha',
      repo: 'portfolio',
      branch: 'main',
      ghExec,
    });
    expect(r.ok).toBe(true);
  });

  it('passes via classic protection contexts without consulting the rules endpoint', async () => {
    const ghExec = routingGh({
      protection: {
        ...CONVO_ON,
        required_status_checks: { contexts: ['typecheck', 'build'], checks: [] },
      },
      rulesReject: new Error('should not be called'),
    });
    const r = await evaluateBranchProtection({
      owner: 'erikunha',
      repo: 'portfolio',
      branch: 'main',
      ghExec,
    });
    expect(r.ok).toBe(true);
    expect(ghExec).toHaveBeenCalledTimes(1);
  });

  it('passes via classic protection checks[] shape when contexts is absent', async () => {
    const ghExec = routingGh({
      protection: {
        ...CONVO_ON,
        required_status_checks: { checks: [{ context: 'typecheck' }] },
      },
    });
    const r = await evaluateBranchProtection({
      owner: 'erikunha',
      repo: 'portfolio',
      branch: 'main',
      ghExec,
    });
    expect(r.ok).toBe(true);
  });

  it('fails when the applied rule exists but its required checks list is empty (gutted rule)', async () => {
    const ghExec = routingGh({
      protection: CONVO_ON,
      rules: [{ type: 'required_status_checks', parameters: { required_status_checks: [] } }],
    });
    const r = await evaluateBranchProtection({
      owner: 'erikunha',
      repo: 'portfolio',
      branch: 'main',
      ghExec,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('required_status_checks_unenforced');
  });

  it('fails closed with "unknown" when the rules query errors and classic has no checks', async () => {
    const ghExec = routingGh({ protection: CONVO_ON, rulesReject: new Error('HTTP 500') });
    const r = await evaluateBranchProtection({
      owner: 'erikunha',
      repo: 'portfolio',
      branch: 'main',
      ghExec,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('unknown');
  });

  it('fails closed with "unknown" on non-JSON rules output', async () => {
    const ghExec = routingGh({ protection: CONVO_ON, rulesRaw: 'not json' });
    const r = await evaluateBranchProtection({
      owner: 'erikunha',
      repo: 'portfolio',
      branch: 'main',
      ghExec,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('unknown');
  });

  it('conversation-resolution failure takes priority over status-check evaluation', async () => {
    const ghExec = routingGh({
      protection: { required_conversation_resolution: { enabled: false } },
      rules: [
        {
          type: 'required_status_checks',
          parameters: { required_status_checks: [{ context: 'typecheck' }] },
        },
      ],
    });
    const r = await evaluateBranchProtection({
      owner: 'erikunha',
      repo: 'portfolio',
      branch: 'main',
      ghExec,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('conversation_resolution_off');
  });
});
