import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildLogPayload, postLog } from '@/lib/error-bridge.client';

const BRIDGE_STATE_KEY = Symbol.for('erikunha.dev/error-bridge');
const HTTP_NO_CONTENT = 204;
const UNKNOWN_ERROR_MESSAGE = 'unknown error';
const UNHANDLED_REJECTION_MESSAGE = 'unhandled promise rejection';

type Posted = { message: string; stack?: string; level: string };

const posts: Posted[] = [];
const fetchSpy = vi.fn(async (_url: string, init: RequestInit) => {
  posts.push(JSON.parse(String(init.body)) as Posted);
  return new Response(null, { status: HTTP_NO_CONTENT });
});

function fireError(init: { message?: string; error?: unknown }): void {
  window.dispatchEvent(Object.assign(new Event('error'), init) as ErrorEvent);
}

function fireRejection(reason: unknown): void {
  window.dispatchEvent(Object.assign(new Event('unhandledrejection'), { reason }));
}

async function lastPost(): Promise<Posted> {
  await vi.waitFor(() => expect(posts.length).toBeGreaterThan(0));
  return posts[posts.length - 1] as Posted;
}

describe('error bridge event handling', () => {
  beforeEach(() => {
    const state = (window as unknown as Record<symbol, Record<string, unknown> | undefined>)[
      BRIDGE_STATE_KEY
    ];
    if (state) Object.assign(state, { failures: 0, blockedUntil: 0, reported: 0 });
    posts.length = 0;
    vi.stubGlobal('fetch', fetchSpy);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    fetchSpy.mockClear();
  });

  it('reports a window error that carries no message as an unknown error without a stack', async () => {
    fireError({ error: 'not an Error instance' });

    const post = await lastPost();
    expect(post.message).toBe(UNKNOWN_ERROR_MESSAGE);
    expect(post).not.toHaveProperty('stack');
  });

  it('reports the stack of a window error that carries an Error', async () => {
    const boom = new Error('window-error-with-stack');
    fireError({ message: boom.message, error: boom });

    const post = await lastPost();
    expect(post.message).toBe('window-error-with-stack');
    expect(post.stack).toBe(boom.stack);
  });

  it('reports an unhandled rejection of an Error with its message and stack', async () => {
    const boom = new Error('rejected-with-error');
    fireRejection(boom);

    const post = await lastPost();
    expect(post).toMatchObject({
      level: 'error',
      message: 'rejected-with-error',
      stack: boom.stack,
    });
  });

  it('reports an unhandled rejection of a string as its text', async () => {
    fireRejection('rejected-with-string');

    const post = await lastPost();
    expect(post.message).toBe('rejected-with-string');
    expect(post).not.toHaveProperty('stack');
  });

  it('reports an unhandled rejection of any other value under a fixed message', async () => {
    fireRejection({ code: 42 });

    expect((await lastPost()).message).toBe(UNHANDLED_REJECTION_MESSAGE);
  });

  it('posts a repeated rejection once inside the dedup window', async () => {
    const boom = new Error('rejected-twice');
    fireRejection(boom);
    fireRejection(boom);
    await vi.waitFor(() => expect(posts.length).toBeGreaterThan(0));

    expect(posts.filter((post) => post.message === 'rejected-twice')).toHaveLength(1);
  });
});

describe('error bridge outside a browser window', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    fetchSpy.mockClear();
  });

  it('builds a payload with empty url and user agent', () => {
    vi.stubGlobal('window', undefined);

    expect(buildLogPayload('server-side', undefined)).toMatchObject({ url: '', userAgent: '' });
  });

  it('does not post', () => {
    vi.stubGlobal('window', undefined);
    vi.stubGlobal('fetch', fetchSpy);

    postLog(buildLogPayload('server-side', undefined));

    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
