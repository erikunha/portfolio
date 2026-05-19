// __tests__/proxy-csp.test.ts
// Behavioral test for the CSP nonce hybrid posture shipped in PR 3 of the
// audit roadmap. See docs/audit/2026-05-19-principal-audit.md Theme 2.
//
// Verifies:
//   1. CSP header is set on every response (matcher already excludes assets).
//   2. The nonce is 16 random bytes base64-encoded (24 chars), not the
//      36-char UUID string the prior implementation used.
//   3. Every static directive is present.
//   4. Production CSP has no 'unsafe-eval' and no va.vercel-scripts.com in
//      script-src; dev-mode CSP adds both.
//   5. The proxy does NOT set an x-nonce request header — the previous
//      Headers-clone work is gone.

import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const makeRequest = (): NextRequest => new NextRequest('https://erikunha.dev/', { method: 'GET' });

afterEach(() => {
  // Reset NODE_ENV stub (and any other) so following tests inherit Vitest's
  // baseline. vi.stubEnv is the typed-safe way to mutate the readonly
  // process.env.NODE_ENV in tests.
  vi.unstubAllEnvs();
});

describe('proxy CSP — hybrid nonce posture (PR 3)', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('sets a Content-Security-Policy header on the response', async () => {
    const { proxy } = await import('@/proxy');
    const res = proxy(makeRequest());
    const csp = res.headers.get('content-security-policy');
    expect(csp).toBeTruthy();
  });

  it('emits a 24-character base64 nonce (16 random bytes)', async () => {
    const { proxy } = await import('@/proxy');
    const res = proxy(makeRequest());
    const csp = res.headers.get('content-security-policy') ?? '';
    const match = csp.match(/'nonce-([A-Za-z0-9+/=]+)'/);
    expect(match, 'CSP must include a nonce-XXX token').not.toBeNull();
    const nonce = match?.[1] ?? '';
    // 16 random bytes base64-encode to 24 chars (with one '=' pad).
    expect(nonce).toHaveLength(24);
    expect(nonce.endsWith('=')).toBe(true);
  });

  it('emits a different nonce on consecutive requests', async () => {
    const { proxy } = await import('@/proxy');
    const a = proxy(makeRequest()).headers.get('content-security-policy') ?? '';
    const b = proxy(makeRequest()).headers.get('content-security-policy') ?? '';
    const nonceA = a.match(/'nonce-([^']+)'/)?.[1];
    const nonceB = b.match(/'nonce-([^']+)'/)?.[1];
    expect(nonceA).toBeTruthy();
    expect(nonceA).not.toBe(nonceB);
  });

  it('includes every static directive in the CSP', async () => {
    const { proxy } = await import('@/proxy');
    const csp = proxy(makeRequest()).headers.get('content-security-policy') ?? '';
    expect(csp).toContain("default-src 'self'");
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
    expect(scriptSrcLine).toMatch(/'nonce-[A-Za-z0-9+/=]+'/);
  });

  it('development script-src adds unsafe-eval + va.vercel-scripts.com', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    const { proxy } = await import('@/proxy');
    const csp = proxy(makeRequest()).headers.get('content-security-policy') ?? '';
    const scriptSrcLine = csp.split(';').find((s) => s.trim().startsWith('script-src')) ?? '';
    expect(scriptSrcLine).toContain("'unsafe-eval'");
    expect(scriptSrcLine).toContain('https://va.vercel-scripts.com');
  });

  it('does NOT set the legacy x-nonce request header (audit Theme 2 removal)', async () => {
    const { proxy } = await import('@/proxy');
    const res = proxy(makeRequest());
    // x-nonce was a request-header rewrite on the upstream request — no
    // public response header should carry it either.
    expect(res.headers.get('x-nonce')).toBeNull();
  });
});
