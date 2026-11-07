import { describe, expect, it } from 'vitest';
import { readBoundedBody } from './read-body';

const LIMIT = 16;
const enc = new TextEncoder();

function streamOf(chunks: string[]): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(enc.encode(chunk));
      controller.close();
    },
  });
}

describe('readBoundedBody', () => {
  it('returns the bytes of a body within the limit', async () => {
    const result = await readBoundedBody(
      { headers: new Headers(), body: streamOf(['{"a":', '1}']) },
      LIMIT,
    );
    expect(result.ok && new TextDecoder().decode(result.bytes ?? new Uint8Array())).toBe('{"a":1}');
  });

  it('refuses a declared length over the limit without touching the stream', async () => {
    let pulled = false;
    const body = new ReadableStream<Uint8Array>(
      {
        pull() {
          pulled = true;
        },
      },
      { highWaterMark: 0 },
    );
    const result = await readBoundedBody(
      { headers: new Headers({ 'content-length': String(LIMIT + 1) }), body },
      LIMIT,
    );
    expect(result).toMatchObject({ ok: false, status: 413, code: 'payload_too_large' });
    expect(pulled).toBe(false);
  });

  it('refuses a streamed body that grows past the limit', async () => {
    const result = await readBoundedBody(
      { headers: new Headers(), body: streamOf(['0123456789', '0123456789']) },
      LIMIT,
    );
    expect(result).toMatchObject({ ok: false, status: 413 });
  });

  it('reports a body that errors mid-read as unreadable', async () => {
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.error(new Error('reset'));
      },
    });
    const result = await readBoundedBody({ headers: new Headers(), body }, LIMIT);
    expect(result).toMatchObject({ ok: false, status: 400, code: 'invalid_body' });
  });

  it('returns null bytes for a request with no body', async () => {
    const result = await readBoundedBody({ headers: new Headers(), body: null }, LIMIT);
    expect(result).toEqual({ ok: true, bytes: null });
  });
});
