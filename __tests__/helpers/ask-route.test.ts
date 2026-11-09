import { describe, expect, it, vi } from 'vitest';
import {
  ASK_URL,
  askLogModule,
  askRequest,
  ipHashModule,
  logModule,
  rateLimitModule,
  readBody,
} from './ask-route';

function chunkedResponse(chunks: Uint8Array[]): Response {
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(chunk);
      controller.close();
    },
  });
  return new Response(stream);
}

describe('readBody', () => {
  it('decodes a body delivered in several chunks', async () => {
    const encoded = new TextEncoder().encode('alpha-beta-gamma');
    const res = chunkedResponse([encoded.slice(0, 5), encoded.slice(5, 11), encoded.slice(11)]);
    expect(await readBody(res)).toBe('alpha-beta-gamma');
  });

  it('keeps a multi-byte character split across chunks intact', async () => {
    const encoded = new TextEncoder().encode('olá');
    const res = chunkedResponse([encoded.slice(0, 3), encoded.slice(3)]);
    expect(await readBody(res)).toBe('olá');
  });

  it('returns an empty string when the response has no body', async () => {
    expect(await readBody(new Response(null))).toBe('');
  });
});

describe('askRequest', () => {
  it('targets the ask route with a JSON POST', async () => {
    const req = askRequest({ question: 'Who is Erik?' });
    expect(req.url).toBe(ASK_URL);
    expect(new URL(req.url).pathname).toBe('/api/ask');
    expect(req.method).toBe('POST');
    expect(req.headers.get('content-type')).toBe('application/json');
    expect(await req.json()).toEqual({ question: 'Who is Erik?' });
  });

  it('sends a string body verbatim', async () => {
    expect(await askRequest('{not json').text()).toBe('{not json');
  });

  it('merges extra headers without dropping the content type', () => {
    const req = askRequest({ question: 'q' }, { headers: { 'x-site-locale': 'pt' } });
    expect(req.headers.get('content-type')).toBe('application/json');
    expect(req.headers.get('x-site-locale')).toBe('pt');
  });

  it('accepts another url for sibling routes', () => {
    const req = askRequest({ requestId: 'r' }, { url: 'http://localhost/api/log/forget' });
    expect(new URL(req.url).pathname).toBe('/api/log/forget');
  });
});

describe('module factories', () => {
  it('logModule exposes the four log levels and lets one be replaced', () => {
    const error = vi.fn();
    const { log } = logModule({ error });
    expect(log.error).toBe(error);
    expect(Object.keys(log).sort()).toEqual(['debug', 'error', 'info', 'warn']);
  });

  it('askLogModule uses the given persist mock', async () => {
    const persist = vi.fn(async () => undefined);
    expect(askLogModule(persist).persistAskInteraction).toBe(persist);
    expect(await askLogModule().persistAskInteraction()).toBeUndefined();
  });

  it('ipHashModule resolves a stable hash by default', async () => {
    expect(await ipHashModule().hashIp()).toBe('hashed-ip-test');
  });

  it('rateLimitModule defaults to an allowed request and applies overrides', async () => {
    const base = rateLimitModule();
    expect(await base.getAskLimit().limit()).toEqual({ success: true });
    expect((await base.reserveBudget()).allowed).toBe(true);
    const denied = rateLimitModule({ reserveBudget: vi.fn(async () => ({ allowed: false })) });
    expect((await denied.reserveBudget()).allowed).toBe(false);
    expect(denied.getClientIp()).toBe('127.0.0.1');
  });
});
