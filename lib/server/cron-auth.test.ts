import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const request = (authorization?: string) =>
  new Request('http://localhost/api/cron', {
    headers: authorization === undefined ? {} : { authorization },
  });

describe('isCronAuthorized', () => {
  it('accepts only the exact bearer secret', async () => {
    const { isCronAuthorized } = await import('./cron-auth');
    expect(isCronAuthorized(request('Bearer s3cret'), 's3cret')).toBe(true);
    expect(isCronAuthorized(request('Bearer s3cre'), 's3cret')).toBe(false);
    expect(isCronAuthorized(request('s3cret'), 's3cret')).toBe(false);
    expect(isCronAuthorized(request(), 's3cret')).toBe(false);
  });

  it('refuses every request when the secret is unset or empty', async () => {
    const { isCronAuthorized } = await import('./cron-auth');
    expect(isCronAuthorized(request('Bearer '), '')).toBe(false);
    expect(isCronAuthorized(request('Bearer undefined'), undefined)).toBe(false);
  });
});
