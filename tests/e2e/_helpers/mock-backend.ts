// tests/e2e/_helpers/mock-backend.ts
//
// Installs Playwright page.route() interceptors for all four /api/* routes.
// Call installMockBackend(page, state) before page.goto('/') in any test that
// exercises a form or API call.
//
// Throwing vs fail-silent (intentional asymmetry):
//   - /api/ask + /api/contact throw when un-configured. These are user-facing
//     critical paths — a missing mock indicates a real test bug, never a no-op.
//   - /api/log + /api/log/forget default to success when un-configured. These
//     are fire-and-forget observability endpoints designed to fail silently in
//     production (per lib/log.ts); matching that posture in the mock prevents
//     every UI test from having to wire `log: 'accept'` explicitly.

import type { Page } from '@playwright/test';

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

// STREAM_ERR_SENTINEL matches lib/stream-protocol.ts. Duplicated here so the
// helper has zero runtime dependency on the Next.js source tree.
const STREAM_ERR_SENTINEL = '\x00ERR:';

export async function installMockBackend(page: Page, state: MockState = {}): Promise<void> {
  // --- /api/ask ---
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
      // The real route streams a sentinel then closes.
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
      // Simulates SDK 30s timeout firing before the first SSE chunk.
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
      // Stream a short canned answer with the real content-type.
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

  // --- /api/contact ---
  await page.route('**/api/contact', async (route) => {
    const s = state.contact;

    if (s === 'happy' || s === 'honeypot') {
      // Both happy and honeypot return 200 ok (honeypot silently succeeds).
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

  // --- /api/log ---
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

    // Default: silently accept log calls so tests that don't care about logging
    // still pass without configuring a log state.
    await route.fulfill({ status: 204 });
  });

  // --- /api/log/forget ---
  await page.route('**/api/log/forget', async (route) => {
    const s = state.forget;

    if (s === 'happy') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true, deleted: 1 }),
      });
      return;
    }

    if (s === 'not-found') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true, deleted: 0 }),
      });
      return;
    }

    // Default: return happy shape so tests that don't configure forget still pass.
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true, deleted: 0 }),
    });
  });
}
