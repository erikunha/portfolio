import { beforeEach, describe, expect, it, vi } from 'vitest';

const PROBE_HEADER = 'Content-Security-Policy-Report-Only';
const EXPECTED_DIRECTIVES = [
  "connect-src 'self'",
  'report-to csp-endpoint',
  'report-uri /api/csp-report',
];
const ABSENT_DIRECTIVE_NAMES = [
  'default-src',
  'script-src',
  'style-src',
  'img-src',
  'font-src',
  'frame-src',
  'object-src',
  'worker-src',
  'frame-ancestors',
  'base-uri',
  'form-action',
];

async function probePolicies(): Promise<string[]> {
  const { default: config } = await import('@/next.config');
  const rules = (await config.headers?.()) ?? [];
  return rules.flatMap((rule) =>
    rule.headers.filter(({ key }) => key === PROBE_HEADER).map(({ value }) => value),
  );
}

function directives(policy: string): string[] {
  return policy
    .split(';')
    .map((part) => part.trim())
    .filter(Boolean);
}

beforeEach(() => {
  vi.resetModules();
});

describe('Content-Security-Policy-Report-Only probe carries only what it tests', () => {
  it('lists exactly connect-src and the reporting directives', async () => {
    const policies = await probePolicies();
    expect(policies.length).toBeGreaterThan(0);
    for (const policy of policies) {
      expect(directives(policy)).toEqual(EXPECTED_DIRECTIVES);
    }
  });

  it.each(ABSENT_DIRECTIVE_NAMES)('does not restate %s', async (name) => {
    for (const policy of await probePolicies()) {
      expect(directives(policy).map((part) => part.split(' ')[0])).not.toContain(name);
    }
  });
});
