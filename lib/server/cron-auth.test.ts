import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const SECRET = 'x'.repeat(24);

const request = (authorization?: string) =>
  new Request('http://localhost/api/cron', {
    headers: authorization === undefined ? {} : { authorization },
  });

describe('isCronAuthorized', () => {
  it('accepts only the exact bearer secret', async () => {
    const { isCronAuthorized } = await import('./cron-auth');
    expect(isCronAuthorized(request(`Bearer ${SECRET}`), SECRET)).toBe(true);
    expect(isCronAuthorized(request(`Bearer ${SECRET.slice(1)}`), SECRET)).toBe(false);
    expect(isCronAuthorized(request(SECRET), SECRET)).toBe(false);
    expect(isCronAuthorized(request(), SECRET)).toBe(false);
  });

  it('refuses every request when the secret is unset or empty', async () => {
    const { isCronAuthorized } = await import('./cron-auth');
    expect(isCronAuthorized(request('Bearer '), '')).toBe(false);
    expect(isCronAuthorized(request('Bearer undefined'), undefined)).toBe(false);
  });

  it('refuses a secret shorter than the minimum even when the header matches it', async () => {
    const { isCronAuthorized, CRON_SECRET_MIN_LENGTH } = await import('./cron-auth');
    const short = 's'.repeat(CRON_SECRET_MIN_LENGTH - 1);
    expect(
      isCronAuthorized(request(`Bearer ${short}`), short),
      'a short secret can be guessed over the public cron URL; refusing it fails closed instead of running cron work for anyone who guesses it',
    ).toBe(false);
    const atMinimum = 's'.repeat(CRON_SECRET_MIN_LENGTH);
    expect(isCronAuthorized(request(`Bearer ${atMinimum}`), atMinimum)).toBe(true);
  });
});
