import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const envMock = vi.hoisted(() => ({ CRON_SECRET: undefined as string | undefined }));
vi.mock('@/lib/env', () => ({ env: envMock }));

const SECRET = 'x'.repeat(24);
const UNAUTHORIZED_STATUS = 401;

const request = (authorization?: string) =>
  new Request('http://localhost/api/cron', {
    headers: authorization === undefined ? {} : { authorization },
  });

describe('requireCron', () => {
  beforeEach(() => {
    envMock.CRON_SECRET = SECRET;
  });

  it('returns null for the exact bearer secret', async () => {
    const { requireCron } = await import('./cron-auth');
    expect(requireCron(request(`Bearer ${SECRET}`))).toBeNull();
  });

  it.each([
    ['a wrong token', `Bearer ${SECRET.slice(1)}y`],
    ['a token of a different length', `Bearer ${SECRET}extra`],
    ['a missing bearer prefix', SECRET],
    ['a missing header', undefined],
  ])('answers 401 for %s', async (_name, header) => {
    const { requireCron } = await import('./cron-auth');
    const res = requireCron(request(header));
    expect(res?.status).toBe(UNAUTHORIZED_STATUS);
    const body = await res?.json();
    expect(body).toMatchObject({
      ok: false,
      error: { code: 'unauthorized', message: 'unauthorized' },
    });
    expect(res?.headers.get('x-request-id')).toBe(body.requestId);
  });

  it('answers 401 when the env secret is missing', async () => {
    envMock.CRON_SECRET = undefined;
    const { requireCron } = await import('./cron-auth');
    const res = requireCron(request('Bearer undefined'));
    expect(res?.status).toBe(UNAUTHORIZED_STATUS);
  });
});
