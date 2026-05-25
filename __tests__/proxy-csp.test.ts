// __tests__/proxy-csp.test.ts
// Behavioral test for the nonce-less CSP posture (see proxy.ts file-level
// comment for the static-generation constraint that makes nonces infeasible).
//
// Verifies:
//   1. CSP header is set on every response (matcher already excludes assets).
//   2. The CSP does NOT include a nonce-source on script-src — static page
//      can't carry per-request nonce attributes, and a nonce-source would
//      block every inline script (CSP-3 §6.7.2.4 ignores 'unsafe-inline'
//      when a nonce-source is present).
//   3. Every static directive is present.
//   4. Production CSP has no 'unsafe-eval' and no va.vercel-scripts.com in
//      script-src; dev-mode CSP adds both.
//   5. The proxy does NOT set an x-nonce request header — no consumer.
//   6. The same CSP value is emitted on every request (deterministic; no
//      per-request mint).

import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const makeRequest = (): NextRequest => new NextRequest('https://erikunha.dev/', { method: 'GET' });

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('proxy CSP — nonce-less posture', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('sets a Content-Security-Policy header on the response', async () => {
    const { proxy } = await import('@/proxy');
    const res = proxy(makeRequest());
    expect(res.headers.get('content-security-policy')).toBeTruthy();
  });

  it('does NOT include a nonce-source in script-src', async () => {
    const { proxy } = await import('@/proxy');
    const csp = proxy(makeRequest()).headers.get('content-security-policy') ?? '';
    expect(csp).not.toMatch(/'nonce-/);
  });

  it('includes every static directive in the CSP', async () => {
    const { proxy } = await import('@/proxy');
    const csp = proxy(makeRequest()).headers.get('content-security-policy') ?? '';
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("script-src 'self' 'unsafe-inline'");
    expect(csp).toContain("style-src 'self' 'unsafe-inline'");
    expect(csp).toContain("img-src 'self' data: blob:");
    expect(csp).toContain("font-src 'self'");
    expect(csp).toContain('connect-src');
    expect(csp).toContain('api.anthropic.com');
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("base-uri 'self'");
  });

  it('production script-src omits unsafe-eval and va.vercel-scripts.com', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    const { proxy } = await import('@/proxy');
    const csp = proxy(makeRequest()).headers.get('content-security-policy') ?? '';
    const scriptSrcLine = csp.split(';').find((s) => s.trim().startsWith('script-src')) ?? '';
    expect(scriptSrcLine).not.toContain('unsafe-eval');
    expect(scriptSrcLine).not.toContain('va.vercel-scripts.com');
    expect(scriptSrcLine).toContain("'self'");
    expect(scriptSrcLine).toContain("'unsafe-inline'");
  });

  it('development script-src adds unsafe-eval + va.vercel-scripts.com', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    const { proxy } = await import('@/proxy');
    const csp = proxy(makeRequest()).headers.get('content-security-policy') ?? '';
    const scriptSrcLine = csp.split(';').find((s) => s.trim().startsWith('script-src')) ?? '';
    expect(scriptSrcLine).toContain("'unsafe-eval'");
    expect(scriptSrcLine).toContain('https://va.vercel-scripts.com');
  });

  it('does not set x-nonce on the upstream request (no consumer)', async () => {
    const { proxy } = await import('@/proxy');
    const res = proxy(makeRequest());
    // The middleware-header-rewrite mechanism encodes upstream-request
    // overrides on the response as `x-middleware-override-headers` +
    // `x-middleware-request-x-nonce`. If we were rewriting x-nonce, those
    // would be set. They must NOT be.
    const overrides = res.headers.get('x-middleware-override-headers') ?? '';
    expect(overrides).not.toContain('x-nonce');
    expect(res.headers.get('x-middleware-request-x-nonce')).toBeNull();
    expect(res.headers.get('x-nonce')).toBeNull();
  });

  it('emits the same CSP on every request (deterministic; no per-request mint)', async () => {
    const { proxy } = await import('@/proxy');
    const a = proxy(makeRequest()).headers.get('content-security-policy');
    const b = proxy(makeRequest()).headers.get('content-security-policy');
    expect(a).toBe(b);
  });

  it('CSP includes report-uri /api/csp-report (unconditional — not env-gated)', async () => {
    // report-uri is not in a conditional branch — it is present in both dev
    // and production. No env stub needed: the directive must appear regardless
    // of NODE_ENV, so a plain import (with whatever env the test runner sets)
    // is the correct assertion. Env-stubbing here would be inert anyway because
    // proxy.ts computes CSP_DIRECTIVES at module-eval time, before any test-body
    // code runs — stubbing after import does not affect the cached CSP string.
    const { proxy } = await import('@/proxy');
    const csp = proxy(makeRequest()).headers.get('content-security-policy') ?? '';
    expect(csp).toContain('report-uri /api/csp-report');
  });
});
