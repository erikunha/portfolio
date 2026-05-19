// __tests__/proxy-csp.test.ts
// Behavioral test for the CSP nonce posture shipped in PR 3 of the audit
// roadmap. See docs/audit/2026-05-19-principal-audit.md Theme 2.
//
// Verifies:
//   1. CSP header is set on every response (matcher already excludes assets).
//   2. The nonce is 16 random bytes base64-encoded (24 chars), not the
//      36-char UUID string the prior implementation used.
//   3. Every static directive is present.
//   4. Production CSP has no 'unsafe-eval' and no va.vercel-scripts.com in
//      script-src; dev-mode CSP adds both.
//   5. The proxy forwards `x-nonce` on the upstream request headers AND
//      its value matches the nonce in the response CSP. Next reads
//      `headers().get('x-nonce')` during SSR to attribute the nonce to
//      its auto-injected inline scripts (RSC flight payloads). Without
//      this, Chrome blocks every Next-emitted inline script as a CSP
//      violation — see proxy.ts file-level comment §1.

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

  it('forwards x-nonce on the upstream request headers with the same value as the response CSP', async () => {
    const { proxy } = await import('@/proxy');
    const res = proxy(makeRequest());

    // Next encodes the upstream request-header rewrite into two pieces on
    // the NextResponse:
    //   - `x-middleware-override-headers`: comma-separated list of header
    //     names that the middleware overrode on the upstream request.
    //   - `x-middleware-request-<header-name>`: the new value for each
    //     header in that list (lowercased).
    // This is the public NextResponse contract for middleware header
    // rewrites. If Next changes it, this test breaks loudly — which is
    // what we want.
    const overrides = (res.headers.get('x-middleware-override-headers') ?? '').split(',');
    expect(overrides, 'middleware must declare x-nonce in its override list').toContain('x-nonce');

    const forwardedNonce = res.headers.get('x-middleware-request-x-nonce');
    expect(forwardedNonce, 'x-nonce must be set on the upstream request').toBeTruthy();

    const cspNonce =
      res.headers.get('content-security-policy')?.match(/'nonce-([A-Za-z0-9+/=]+)'/)?.[1] ?? '';
    expect(cspNonce).toBeTruthy();

    // The CSP's script-src nonce and the upstream-forwarded x-nonce MUST
    // be the same value, otherwise Next's inline scripts won't match the
    // CSP and Chrome will block them all.
    expect(forwardedNonce).toBe(cspNonce);
  });

  it('does not leak x-nonce as a response header (only on the upstream request)', async () => {
    const { proxy } = await import('@/proxy');
    const res = proxy(makeRequest());
    expect(res.headers.get('x-nonce')).toBeNull();
  });
});
