import type { Page } from '@playwright/test';
import { askErrors } from '../../../content/ask-errors';
import { profile } from '../../../content/profile';
import { SITE_LOCALE } from '../../../content/site-locale';
import { STREAM_ERR_SENTINEL } from '../../../lib/stream-protocol';

export const MOCK_ASK_ANSWER = `Erik is a ${profile.title} with 8+ years of experience.`;

export type MockState = {
  ask?:
    | 'happy'
    | 'kill-switch'
    | 'rate-limit'
    | 'budget-exhausted'
    | 'budget-daily'
    | 'stream-error';
  contact?: 'happy' | 'queued' | 'validation-error' | 'rate-limit' | 'server-error' | 'honeypot';
  log?: 'accept' | 'rate-limit' | 'storage-unavailable';
  forget?: 'happy' | 'not-found';
};

const EN = askErrors[SITE_LOCALE.en];

export async function installMockBackend(page: Page, state: MockState = {}): Promise<void> {
  await page.route('**/api/ask', async (route) => {
    const s = state.ask;

    if (s === 'kill-switch') {
      await route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ error: EN.unavailable }),
      });
      return;
    }

    if (s === 'rate-limit') {
      await route.fulfill({
        status: 429,
        contentType: 'application/json',
        body: JSON.stringify({ error: EN.rateLimited }),
      });
      return;
    }

    if (s === 'budget-exhausted') {
      await route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ error: EN.budget }),
      });
      return;
    }

    if (s === 'budget-daily') {
      await route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ error: EN.budgetDaily }),
      });
      return;
    }

    if (s === 'stream-error') {
      const body = `${STREAM_ERR_SENTINEL}${EN.interrupted}`;
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
