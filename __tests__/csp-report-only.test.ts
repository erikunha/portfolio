import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const ENFORCED_HEADER = 'content-security-policy';
const PROBE_HEADER = 'content-security-policy-report-only';
const REPORTING_HEADER = 'reporting-endpoints';
const EVERY_PATH_SOURCE = '/(.*)';
const CONNECT_SRC = 'connect-src';
const VERCEL_HOSTS = ['vitals.vercel-insights.com', 'va.vercel-scripts.com'];
const REPORT_DIRECTIVES = ['report-to csp-endpoint', 'report-uri /api/csp-report'];

interface HeaderRule {
  source: string;
  headers: { key: string; value: string }[];
}

async function loadRules(): Promise<HeaderRule[]> {
  const { default: config } = await import('@/next.config');
  return (await config.headers?.()) ?? [];
}

async function loadHeaders(): Promise<Map<string, string>> {
  const merged = new Map<string, string>();
  for (const rule of await loadRules()) {
    for (const { key, value } of rule.headers) merged.set(key.toLowerCase(), value);
  }
  return merged;
}

function directives(policy: string): string[] {
  return policy
    .split(';')
    .map((part) => part.trim())
    .filter(Boolean);
}

function withoutProbeDifferences(policy: string): string[] {
  return directives(policy).filter((part) => !part.startsWith(CONNECT_SRC));
}

async function loadPair(): Promise<{ enforced: string; probe: string }> {
  const headers = await loadHeaders();
  return {
    enforced: headers.get(ENFORCED_HEADER) ?? '',
    probe: headers.get(PROBE_HEADER) ?? '',
  };
}

beforeEach(() => {
  vi.resetModules();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('Content-Security-Policy-Report-Only probe', () => {
  it('is served on every path beside the enforced policy', async () => {
    const rules = await loadRules();
    const carrier = rules.find((rule) =>
      rule.headers.some(({ key }) => key === 'Content-Security-Policy'),
    );
    expect(carrier?.source).toBe(EVERY_PATH_SOURCE);
    expect(carrier?.headers.map(({ key }) => key)).toContain('Content-Security-Policy-Report-Only');
  });

  it('allows only self in connect-src, without the Vercel hosts the enforced policy lists', async () => {
    const { enforced, probe } = await loadPair();
    const probeConnect = directives(probe).find((part) => part.startsWith(CONNECT_SRC));
    expect(probeConnect).toBe(`${CONNECT_SRC} 'self'`);
    for (const host of VERCEL_HOSTS) {
      expect(probe).not.toContain(host);
      expect(enforced).toContain(host);
    }
  });

  it('reports to the same group and sink as the enforced policy', async () => {
    const headers = await loadHeaders();
    const probe = headers.get(PROBE_HEADER) ?? '';
    for (const directive of REPORT_DIRECTIVES) {
      expect(directives(probe)).toContain(directive);
      expect(directives(headers.get(ENFORCED_HEADER) ?? '')).toContain(directive);
    }
    expect(headers.get(REPORTING_HEADER)).toBe('csp-endpoint="/api/csp-report"');
  });

  it.each(['production', 'development'])(
    'differs from the enforced policy only in connect-src (%s)',
    async (environment) => {
      vi.stubEnv('NODE_ENV', environment);
      const { enforced, probe } = await loadPair();
      expect(probe).not.toBe('');
      expect(withoutProbeDifferences(probe)).toEqual(withoutProbeDifferences(enforced));
    },
  );

  it('leaves the enforced connect-src unchanged', async () => {
    const { enforced } = await loadPair();
    expect(directives(enforced)).toContain(
      "connect-src 'self' https://vitals.vercel-insights.com https://va.vercel-scripts.com",
    );
  });
});
