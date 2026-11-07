import { describe, expect, it } from 'vitest';
import { hasGatewayCredential } from '../gateway-credential';

describe('hasGatewayCredential', () => {
  it('accepts an AI Gateway API key', () => {
    expect(hasGatewayCredential({ AI_GATEWAY_API_KEY: 'k' })).toBe(true);
  });

  it('accepts a Vercel OIDC token, which the gateway provider uses when no key is set', () => {
    expect(hasGatewayCredential({ VERCEL_OIDC_TOKEN: 't' })).toBe(true);
  });

  it('rejects an environment with neither credential, or only empty values', () => {
    expect(hasGatewayCredential({})).toBe(false);
    expect(hasGatewayCredential({ AI_GATEWAY_API_KEY: '', VERCEL_OIDC_TOKEN: '' })).toBe(false);
  });
});
