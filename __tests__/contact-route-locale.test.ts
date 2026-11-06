import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { contactContent } from '@/content/contact';
import { SITE_LOCALE } from '@/content/site-locale';
import { ASK_LOCALE_HEADER } from '@/lib/stream-protocol';

const redisSet = vi.fn();
const limit = vi.fn();
const logger = { info: vi.fn(), error: vi.fn(), warn: vi.fn() };

vi.mock('@/lib/rate-limit', () => ({
  getClientIp: () => '127.0.0.1',
  getContactLimit: () => ({ limit }),
  getRedis: () => ({ set: redisSet }),
}));
vi.mock('@/lib/ip-hash', () => ({ hashIp: async () => 'hashed-ip' }));
vi.mock('@/lib/log', () => ({ log: logger }));

const validBody = {
  name: 'Visitor',
  email: 'visitor@example.com',
  message: 'A private contact message.',
};
const request = (locale?: string) =>
  new NextRequest('http://localhost/api/contact', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(locale === undefined ? {} : { [ASK_LOCALE_HEADER]: locale }),
    },
    body: JSON.stringify(validBody),
  });

describe('contact API error language', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    limit.mockResolvedValue({ success: true });
    redisSet.mockRejectedValue(new Error('kv down'));
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it.each([
    [SITE_LOCALE.pt, SITE_LOCALE.pt],
    [SITE_LOCALE.en, SITE_LOCALE.en],
    [undefined, SITE_LOCALE.en],
    ['fr', SITE_LOCALE.en],
  ])('answers a storage failure for locale header %s in %s', async (header, expected) => {
    const { POST } = await import('@/app/api/contact/route');
    const res = await POST(request(header));
    const body = await res.json();
    expect(res.status).toBe(502);
    expect(body.error.message).toBe(contactContent[expected].errors.storageUnavailable);
  });
});
