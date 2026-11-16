import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const CSP_HEADER = 'Content-Security-Policy';
const REPORTING_HEADER = 'Reporting-Endpoints';
const EVERY_PATH_SOURCE = '/(.*)';

interface HeaderRule {
  source: string;
  headers: { key: string; value: string }[];
}

async function loadRules(): Promise<HeaderRule[]> {
  const { default: config } = await import('@/next.config');
  return (await config.headers?.()) ?? [];
}

async function loadHeaders(): Promise<Map<string, string>> {
  const rules = await loadRules();
  const merged = new Map<string, string>();
  for (const rule of rules) {
    for (const { key, value } of rule.headers) merged.set(key.toLowerCase(), value);
  }
  return merged;
}

async function loadCsp(): Promise<string> {
  return (await loadHeaders()).get(CSP_HEADER.toLowerCase()) ?? '';
}

function directive(csp: string, name: string): string {
  return (
    csp
      .split(';')
      .map((part) => part.trim())
      .find((part) => part.startsWith(name)) ?? ''
  );
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('static CSP header: nonce-less posture', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('serves a Content-Security-Policy header', async () => {
    expect(await loadCsp()).toBeTruthy();
  });

  it('applies the policy to every path, static assets included', async () => {
    const rules = await loadRules();
    const carrier = rules.find((rule) => rule.headers.some(({ key }) => key === CSP_HEADER));
    expect(carrier?.source).toBe(EVERY_PATH_SOURCE);
  });

  it('does NOT include a nonce-source in script-src', async () => {
    expect(await loadCsp()).not.toMatch(/'nonce-/);
  });

  it('includes every static directive in the CSP', async () => {
    const csp = await loadCsp();
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("script-src 'self' 'unsafe-inline'");
    expect(csp).toContain("style-src 'self' 'unsafe-inline'");
    expect(csp).toContain("img-src 'self' data: blob:");
    expect(csp).toContain("font-src 'self' data:");
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
    const scriptSrc = directive(await loadCsp(), 'script-src');
    expect(scriptSrc).not.toContain('unsafe-eval');
    expect(scriptSrc).not.toContain('va.vercel-scripts.com');
    expect(scriptSrc).toContain("'self'");
    expect(scriptSrc).toContain("'unsafe-inline'");
  });

  it('development script-src adds unsafe-eval + va.vercel-scripts.com', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    const scriptSrc = directive(await loadCsp(), 'script-src');
    expect(scriptSrc).toContain("'unsafe-eval'");
    expect(scriptSrc).toContain('https://va.vercel-scripts.com');
  });

  it('sets no nonce header (no consumer)', async () => {
    const headers = await loadHeaders();
    expect(headers.has('x-nonce')).toBe(false);
  });

  it('emits the same CSP on every evaluation (deterministic; no per-request mint)', async () => {
    const a = await loadCsp();
    vi.resetModules();
    const b = await loadCsp();
    expect(a).toBe(b);
  });

  it('CSP includes report-uri and report-to, and Reporting-Endpoints names the same sink', async () => {
    const headers = await loadHeaders();
    const csp = headers.get(CSP_HEADER.toLowerCase()) ?? '';
    expect(csp).toContain('report-uri /api/csp-report');
    expect(csp).toContain('report-to csp-endpoint');
    expect(headers.get(REPORTING_HEADER.toLowerCase())).toBe('csp-endpoint="/api/csp-report"');
  });

  it('keeps the static security headers beside the CSP', async () => {
    const headers = await loadHeaders();
    expect(headers.get('x-frame-options')).toBe('DENY');
    expect(headers.get('strict-transport-security')).toContain('max-age=');
  });
});
