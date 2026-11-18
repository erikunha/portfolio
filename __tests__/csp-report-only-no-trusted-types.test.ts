import { beforeEach, describe, expect, it, vi } from 'vitest';

const ENFORCED_HEADER = 'Content-Security-Policy';
const PROBE_HEADER = 'Content-Security-Policy-Report-Only';
const CONNECT_SRC = 'connect-src';
const TRUSTED_TYPES_DIRECTIVE = 'require-trusted-types-for';

interface HeaderRule {
  source: string;
  headers: { key: string; value: string }[];
}

async function loadRules(): Promise<HeaderRule[]> {
  const { default: config } = await import('@/next.config');
  return (await config.headers?.()) ?? [];
}

function policyOf(rule: HeaderRule, key: string): string {
  return rule.headers.find((header) => header.key === key)?.value ?? '';
}

function directives(policy: string): string[] {
  return policy
    .split(';')
    .map((part) => part.trim())
    .filter(Boolean);
}

function withoutConnectSrc(policy: string): string[] {
  return directives(policy).filter((part) => !part.startsWith(CONNECT_SRC));
}

beforeEach(() => {
  vi.resetModules();
});

describe('Content-Security-Policy-Report-Only probe scope', () => {
  it('carries no trusted types directive on any route that serves it', async () => {
    const carriers = (await loadRules()).filter((rule) =>
      rule.headers.some(({ key }) => key === PROBE_HEADER),
    );
    expect(carriers.length).toBeGreaterThan(0);
    for (const rule of carriers) {
      expect(policyOf(rule, PROBE_HEADER)).not.toContain(TRUSTED_TYPES_DIRECTIVE);
    }
  });

  it('differs from the enforced policy only in connect-src', async () => {
    const carriers = (await loadRules()).filter((rule) =>
      rule.headers.some(({ key }) => key === PROBE_HEADER),
    );
    for (const rule of carriers) {
      const probe = policyOf(rule, PROBE_HEADER);
      const enforced = policyOf(rule, ENFORCED_HEADER);
      expect(withoutConnectSrc(probe)).toEqual(withoutConnectSrc(enforced));
      expect(probe).not.toBe(enforced);
    }
  });
});
