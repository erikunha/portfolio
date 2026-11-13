import type { Page } from '@playwright/test';
import { askErrors } from '../../../content/ask-errors';
import { profile } from '../../../content/profile';
import { SITE_LOCALE, type SiteLocale } from '../../../content/site-locale';
import { STREAM_ERR_SENTINEL } from '../../../lib/stream-protocol';

export const MOCK_ASK_ANSWER = `Erik is a ${profile.title} with 8+ years of experience.`;

export type MockState = {
  ask?:
    | 'happy'
    | 'kill-switch'
    | 'rate-limit'
    | 'budget-exhausted'
    | 'budget-daily'
    | 'stream-error'
    | 'server-error'
    | 'network-error';
  locale?: SiteLocale;
  contact?: 'happy' | 'queued' | 'validation-error' | 'rate-limit' | 'server-error' | 'honeypot';
  log?: 'accept' | 'rate-limit' | 'storage-unavailable';
  forget?: 'happy' | 'not-found';
};

const EN = askErrors[SITE_LOCALE.en];

export async function installMockBackend(page: Page, state: MockState = {}): Promise<void> {
  const copy = state.locale ? askErrors[state.locale] : EN;
  await page.route('**/api/ask', async (route) => {
    const s = state.ask;

    if (s === 'network-error') {
      await route.abort('failed');
      return;
    }

    if (s === 'server-error') {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        headers: { 'X-Request-Id': 'server-error-request-id' },
        body: JSON.stringify({}),
      });
      return;
    }

    if (s === 'kill-switch') {
      await route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ error: copy.unavailable }),
      });
      return;
    }

    if (s === 'rate-limit') {
      await route.fulfill({
        status: 429,
        contentType: 'application/json',
        body: JSON.stringify({ error: copy.rateLimited }),
      });
      return;
    }

    if (s === 'budget-exhausted') {
      await route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ error: copy.budget }),
      });
      return;
    }

    if (s === 'budget-daily') {
      await route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ error: copy.budgetDaily }),
      });
      return;
    }

    if (s === 'stream-error') {
      const body = `${STREAM_ERR_SENTINEL}${copy.interrupted}`;
      await route.fulfill({
        status: 200,
        contentType: 'text/plain; charset=utf-8',
        headers: { 'X-Request-Id': crypto.randomUUID() },
        body,
      });
      return;
    }

    if (s === 'happy') {
      await route.fulfill({
        status: 200,
        contentType: 'text/plain; charset=utf-8',
        headers: { 'X-Request-Id': 'test-request-id-abc123' },
        body: MOCK_ASK_ANSWER,
      });
      return;
    }

    throw new Error(`installMockBackend: no mock configured for ask state "${String(s)}"`);
  });

  await page.route('**/api/contact', async (route) => {
    const s = state.contact;

    if (s === 'happy' || s === 'honeypot') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true, requestId: 'contact-test-request-id' }),
      });
      return;
    }

    if (s === 'queued') {
      await route.fulfill({
        status: 202,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: false,
          requestId: 'contact-test-request-id',
          error: {
            code: 'queued',
            message:
              'saved, not delivered yet; delivery is retried automatically; for a faster reply use LinkedIn',
          },
        }),
      });
      return;
    }

    if (s === 'validation-error') {
      await route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: false,
          requestId: 'contact-test-request-id',
          error: { code: 'validation_failed', message: 'name is required' },
        }),
      });
      return;
    }

    if (s === 'rate-limit') {
      await route.fulfill({
        status: 429,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: false,
          requestId: 'contact-test-request-id',
          error: { code: 'rate_limited', message: 'too many requests, try again in 10 minutes' },
        }),
      });
      return;
    }

    if (s === 'server-error') {
      await route.fulfill({
        status: 502,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: false,
          requestId: 'contact-test-request-id',
          error: { code: 'internal_error', message: 'internal server error' },
        }),
      });
      return;
    }

    throw new Error(`installMockBackend: no mock configured for contact state "${String(s)}"`);
  });

  await page.route('**/api/log', async (route) => {
    const s = state.log;

    if (s === 'accept') {
      await route.fulfill({ status: 204 });
      return;
    }

    if (s === 'rate-limit') {
      await route.fulfill({ status: 429 });
      return;
    }

    if (s === 'storage-unavailable') {
      await route.fulfill({ status: 502 });
      return;
    }

    await route.fulfill({ status: 204 });
  });

  await page.route('**/api/log/forget', async (route) => {
    const s = state.forget;

    if (s === 'happy' || s === 'not-found') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true, requestId: crypto.randomUUID() }),
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true, requestId: crypto.randomUUID() }),
    });
  });
}

const CHUNKED_ASK_KEY = '__chunkedAsk';
const CHUNKED_REQUEST_ID_PREFIX = 'chunked-request-id';

export type ChunkedAsk = {
  push: (text: string) => Promise<void>;
  end: () => Promise<void>;
  requests: () => Promise<number>;
  aborted: () => Promise<number>;
};

type ChunkedAskStream = { controller: ReadableStreamDefaultController<Uint8Array>; open: boolean };
type ChunkedAskHandle = { streams: ChunkedAskStream[]; aborted: number };

export async function installChunkedAsk(
  page: Page,
  options: { requestId?: string } = {},
): Promise<ChunkedAsk> {
  await page.addInitScript(
    ([key, idPrefix, fixedId]) => {
      const handle: ChunkedAskHandle = { streams: [], aborted: 0 };
      (window as unknown as Record<string, ChunkedAskHandle>)[key] = handle;
      const realFetch = window.fetch.bind(window);
      window.fetch = (input, init) => {
        const url = input instanceof Request ? input.url : String(input);
        if (!url.includes('/api/ask')) return realFetch(input, init);
        const index = handle.streams.length;
        const body = new ReadableStream<Uint8Array>({
          start(controller) {
            handle.streams.push({ controller, open: true });
          },
        });
        init?.signal?.addEventListener('abort', () => {
          const stream = handle.streams[index];
          if (!stream?.open) return;
          stream.open = false;
          handle.aborted += 1;
          stream.controller.error(new DOMException('aborted', 'AbortError'));
        });
        return Promise.resolve(
          new Response(body, {
            status: 200,
            headers: {
              'Content-Type': 'text/plain; charset=utf-8',
              'X-Request-Id': fixedId || `${idPrefix}-${index + 1}`,
            },
          }),
        );
      };
    },
    [CHUNKED_ASK_KEY, CHUNKED_REQUEST_ID_PREFIX, options.requestId ?? ''] as const,
  );

  return {
    push: (text) =>
      page.evaluate(
        ([key, chunk]) => {
          const handle = (window as unknown as Record<string, ChunkedAskHandle>)[key];
          const stream = handle?.streams.at(-1);
          if (stream?.open) stream.controller.enqueue(new TextEncoder().encode(chunk));
        },
        [CHUNKED_ASK_KEY, text] as const,
      ),
    end: () =>
      page.evaluate((key) => {
        const stream = (window as unknown as Record<string, ChunkedAskHandle>)[key]?.streams.at(-1);
        if (!stream?.open) return;
        stream.open = false;
        stream.controller.close();
      }, CHUNKED_ASK_KEY),
    requests: () =>
      page.evaluate(
        (key) => (window as unknown as Record<string, ChunkedAskHandle>)[key]?.streams.length ?? 0,
        CHUNKED_ASK_KEY,
      ),
    aborted: () =>
      page.evaluate(
        (key) => (window as unknown as Record<string, ChunkedAskHandle>)[key]?.aborted ?? 0,
        CHUNKED_ASK_KEY,
      ),
  };
}
