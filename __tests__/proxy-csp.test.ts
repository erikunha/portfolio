import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const makeRequest = (): NextRequest =>
  new NextRequest('https://www.erikunha.dev/', { method: 'GET' });

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
    expect(csp).not.toContain('api.anthropic.com');
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("frame-src 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("base-uri 'self'");
    expect(csp).toContain("form-action 'self'");
    expect(csp).toContain("worker-src 'self'");
    expect(csp).toContain('report-to csp-endpoint');
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

  it('CSP includes report-uri and report-to, and Reporting-Endpoints header is set', async () => {
    const { proxy } = await import('@/proxy');
    const res = proxy(makeRequest());
    const csp = res.headers.get('content-security-policy') ?? '';
    expect(csp).toContain('report-uri /api/csp-report');
    expect(csp).toContain('report-to csp-endpoint');
    expect(res.headers.get('reporting-endpoints')).toContain(
      'csp-endpoint="https://www.erikunha.dev/api/csp-report"',
    );
  });
});
