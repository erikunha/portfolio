import { NextRequest } from 'next/server';
import { describe, expect, it } from 'vitest';
import { withBodyLimit } from './body-limit';

const LIMIT = 64;
const URL_IN = 'https://example.test/api/log';
const PAYLOAD = '{"a":"é"}';

function recorder() {
  const seen: NextRequest[] = [];
  const handler = withBodyLimit(async (req) => {
    seen.push(req);
    return new Response('ok');
  }, LIMIT);
  return { seen, handler };
}

describe('withBodyLimit paths', () => {
  it('hands a bodiless NextRequest to the handler unchanged', async () => {
    const { seen, handler } = recorder();
    const req = new NextRequest(URL_IN, { method: 'GET' });

    const res = await handler(req);

    expect(res.status).toBe(200);
    expect(seen[0]).toBe(req);
  });

  it('wraps a bodiless plain Request in a NextRequest that keeps method, url and headers', async () => {
    const { seen, handler } = recorder();

    await handler(new Request(URL_IN, { method: 'GET', headers: { 'x-site-locale': 'pt' } }));

    expect(seen[0]).toBeInstanceOf(NextRequest);
    expect(seen[0]?.url).toBe(URL_IN);
    expect(seen[0]?.headers.get('x-site-locale')).toBe('pt');
  });

  it('sets content-length to the bytes read and passes the body on', async () => {
    const { seen, handler } = recorder();
    const byteLength = new TextEncoder().encode(PAYLOAD).byteLength;

    await handler(new NextRequest(URL_IN, { method: 'POST', body: PAYLOAD }));

    expect(seen[0]?.headers.get('content-length')).toBe(String(byteLength));
    expect(await seen[0]?.text()).toBe(PAYLOAD);
  });

  it('refuses a declared content-length over the limit without calling the handler', async () => {
    const { seen, handler } = recorder();
    const req = new NextRequest(URL_IN, {
      method: 'POST',
      headers: { 'content-length': String(LIMIT + 1) },
      body: 'x',
    });

    const res = await handler(req);

    expect(res.status).toBe(413);
    expect(seen).toHaveLength(0);
  });

  it('refuses a body that cannot be read with a 400 and does not call the handler', async () => {
    const { seen, handler } = recorder();
    const failing = new ReadableStream<Uint8Array>({
      pull(controller) {
        controller.error(new Error('socket reset'));
      },
    });

    const res = await handler({
      url: URL_IN,
      method: 'POST',
      headers: new Headers(),
      body: failing,
    } as Request);

    expect(res.status).toBe(400);
    expect(seen).toHaveLength(0);
  });
});
