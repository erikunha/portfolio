import { describe, expect, it } from 'vitest';
import { withBodyLimit } from './body-limit';

const LIMIT = 64;
const URL_IN = 'https://example.test/api/log?x=1';

const foreignRequest = (body: string): Request => {
  const real = new Request(URL_IN, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-site-locale': 'pt' },
    body,
  });
  return {
    url: real.url,
    method: real.method,
    headers: real.headers,
    body: real.body,
  } as unknown as Request;
};

describe('withBodyLimit', () => {
  it('rebuilds a request from another runtime realm instead of stringifying it to [object Request]', async () => {
    const seen: { url: string; method: string; locale: string | null; body: string }[] = [];
    const handler = withBodyLimit(async (req) => {
      seen.push({
        url: req.url,
        method: req.method,
        locale: req.headers.get('x-site-locale'),
        body: await req.text(),
      });
      return new Response('ok');
    }, LIMIT);

    const res = await handler(foreignRequest('{"a":1}'));

    expect(res.status).toBe(200);
    expect(seen).toEqual([{ url: URL_IN, method: 'POST', locale: 'pt', body: '{"a":1}' }]);
  });

  it('still refuses a body over the limit', async () => {
    const handler = withBodyLimit(async () => new Response('ok'), LIMIT);
    const res = await handler(foreignRequest('x'.repeat(LIMIT + 1)));
    expect(res.status).toBe(413);
  });
});
