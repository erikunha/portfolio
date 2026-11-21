import { act, createElement } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { flushMicrotasks, type MountedClient, mountClient } from '@/__tests__/helpers/render';
import { shellUi } from '@/content/shell-ui';
import { SITE_LOCALE } from '@/content/site-locale';
import { SITE_LOCALE_HEADER } from '@/lib/stream-protocol';
import { createAskRequest } from './ask-request';
import { useAskStream } from './useAskStream';

const params = { question: 'who are you', locale: SITE_LOCALE.en, conversationId: 'conv-1' };

function rejectOnAbort(init: RequestInit | undefined): Promise<Response> {
  return new Promise((_resolve, reject) => {
    init?.signal?.addEventListener('abort', () =>
      reject(new DOMException('aborted', 'AbortError')),
    );
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('createAskRequest', () => {
  it('posts the question, locale and conversation id as JSON to the ask endpoint', async () => {
    const fetchMock = vi.fn(async () => new Response('ok'));
    vi.stubGlobal('fetch', fetchMock);

    await createAskRequest(params).send();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('/api/ask');
    expect(init.method).toBe('POST');
    expect(init.headers).toEqual({
      'Content-Type': 'application/json',
      [SITE_LOCALE_HEADER]: SITE_LOCALE.en,
    });
    expect(JSON.parse(String(init.body))).toEqual({
      question: 'who are you',
      locale: SITE_LOCALE.en,
      conversationId: 'conv-1',
    });
  });

  it('returns a non-OK response instead of throwing', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('{}', { status: 429 })),
    );

    const response = await createAskRequest(params).send();

    expect(response.status).toBe(429);
  });

  it('aborting before the response resolves rejects the send with an abort error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((_url: string, init?: RequestInit) => rejectOnAbort(init)),
    );
    const request = createAskRequest(params);
    const sent = request.send();

    expect(request.aborted).toBe(false);
    request.abort();

    await expect(sent).rejects.toMatchObject({ name: 'AbortError' });
    expect(request.aborted).toBe(true);
  });

  it('aborting mid-stream cancels the open reader', async () => {
    const cancelled = vi.fn();
    const body = new ReadableStream<Uint8Array>({ cancel: cancelled });
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(body)),
    );
    const request = createAskRequest(params);
    const response = await request.send();
    const reader = request.openReader(response);
    const pending = reader?.read();

    request.abort();
    await pending;

    expect(cancelled).toHaveBeenCalledTimes(1);
  });

  it('abort is idempotent', async () => {
    const cancelled = vi.fn();
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(new ReadableStream<Uint8Array>({ cancel: cancelled }))),
    );
    const request = createAskRequest(params);
    request.openReader(await request.send());

    request.abort();
    request.abort();

    expect(request.aborted).toBe(true);
    expect(cancelled).toHaveBeenCalledTimes(1);
  });

  it('openReader returns undefined for a response with no body', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(null, { status: 204 })),
    );
    const request = createAskRequest(params);

    expect(request.openReader(await request.send())).toBeUndefined();
  });
});

describe('useAskStream unmount', () => {
  let mounted: MountedClient | undefined;

  async function mountHook() {
    const callbacks = {
      announce: vi.fn(),
      restoreInput: vi.fn(),
      onSettled: vi.fn(),
      dispatch: vi.fn(),
    };
    let ids = 0;
    const api: { start?: (question: string, command: string) => Promise<void> } = {};
    function Probe() {
      api.start = useAskStream({
        locale: SITE_LOCALE.en,
        ui: shellUi.en,
        nextId: () => ids++,
        ...callbacks,
      }).start;
      return null;
    }
    mounted = await mountClient(createElement(Probe));
    return { api, callbacks };
  }

  afterEach(() => {
    mounted?.unmount();
    mounted = undefined;
  });

  it('unmounting mid-stream aborts the request and runs no callback afterwards', async () => {
    const cancelled = vi.fn();
    const body = new ReadableStream<Uint8Array>({ cancel: cancelled });
    const fetchMock = vi.fn(async () => new Response(body));
    vi.stubGlobal('fetch', fetchMock);
    const { api, callbacks } = await mountHook();
    await act(async () => {
      void api.start?.('q', 'ask q');
      await flushMicrotasks();
    });
    const before = {
      announce: callbacks.announce.mock.calls.length,
      dispatch: callbacks.dispatch.mock.calls.length,
    };

    mounted?.unmount();
    mounted = undefined;
    await flushMicrotasks();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(cancelled).toHaveBeenCalledTimes(1);
    expect(callbacks.announce).toHaveBeenCalledTimes(before.announce);
    expect(callbacks.dispatch).toHaveBeenCalledTimes(before.dispatch);
    expect(callbacks.restoreInput).not.toHaveBeenCalled();
    expect(callbacks.onSettled).not.toHaveBeenCalled();
  });

  it('unmounting before the response resolves ignores the late response', async () => {
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const cancelled = vi.fn();
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        await gate;
        return new Response(new ReadableStream<Uint8Array>({ cancel: cancelled }));
      }),
    );
    const { api, callbacks } = await mountHook();
    await act(async () => {
      void api.start?.('q', 'ask q');
      await flushMicrotasks();
    });
    const announced = callbacks.announce.mock.calls.length;

    mounted?.unmount();
    mounted = undefined;
    release();
    await flushMicrotasks();

    expect(cancelled).toHaveBeenCalledTimes(1);
    expect(callbacks.announce).toHaveBeenCalledTimes(announced);
    expect(callbacks.restoreInput).not.toHaveBeenCalled();
    expect(callbacks.onSettled).not.toHaveBeenCalled();
  });
});
