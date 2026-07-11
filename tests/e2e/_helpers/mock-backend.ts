import type { Page } from '@playwright/test';
import { STREAM_ERR_SENTINEL } from '../../../lib/stream-protocol';

export type MockState = {
  ask?:
    | 'happy'
    | 'kill-switch'
    | 'rate-limit'
    | 'budget-exhausted'
    | 'stream-error'
    | 'pre-stream-timeout';
  contact?: 'happy' | 'validation-error' | 'rate-limit' | 'server-error' | 'honeypot';
  log?: 'accept' | 'rate-limit' | 'storage-unavailable';
  forget?: 'happy' | 'not-found';
};

export async function installMockBackend(page: Page, state: MockState = {}): Promise<void> {
  await page.route('**/api/ask', async (route) => {
    const s = state.ask;

    if (s === 'kill-switch') {
      await route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({
          error: 'temporarily unavailable — email erikhenriquealvescunha@gmail.com directly',
        }),
      });
      return;
    }

    if (s === 'rate-limit') {
      await route.fulfill({
        status: 429,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'rate limit exceeded — try again in an hour' }),
      });
      return;
    }

    if (s === 'budget-exhausted') {
      await route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({
          error: 'monthly budget exhausted — email erikhenriquealvescunha@gmail.com directly',
        }),
      });
      return;
    }

    if (s === 'stream-error') {
      const body = `${STREAM_ERR_SENTINEL}upstream error`;
      await route.fulfill({
        status: 200,
        contentType: 'text/plain; charset=utf-8',
        headers: { 'X-Request-Id': crypto.randomUUID() },
        body,
      });
      return;
    }

    if (s === 'pre-stream-timeout') {
      const body = `${STREAM_ERR_SENTINEL}Request Timeout`;
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
        body: 'Erik is a Senior Full-Stack Engineer with 8+ years of experience.',
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
        body: JSON.stringify({ ok: true }),
      });
      return;
    }

    if (s === 'validation-error') {
      await route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'name is required' }),
      });
      return;
    }

    if (s === 'rate-limit') {
      await route.fulfill({
        status: 429,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'too many requests — try again in 10 minutes' }),
      });
      return;
    }

    if (s === 'server-error') {
      await route.fulfill({
        status: 502,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'storage unavailable — try again' }),
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
