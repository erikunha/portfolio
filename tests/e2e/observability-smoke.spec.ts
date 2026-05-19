// tests/e2e/observability-smoke.spec.ts
// Smokes the Phase 3 endpoints end-to-end against the CI preview server.
// Spec ref: docs/superpowers/specs/2026-05-18-production-observability-design.md §8 criterion 8.

import { expect, test } from '@playwright/test';

const SYNTHETIC_REQUEST_ID = '00000000-0000-4000-8000-000000000000';

test.describe('observability smoke', () => {
  test('/api/log accepts a structured error payload', async ({ request }) => {
    const res = await request.post('/api/log', {
      data: {
        level: 'error',
        message: '[smoke] synthetic test error',
        stack: 'Error: smoke\n  at test',
        url: 'http://localhost:3000/smoke',
        userAgent: 'playwright/smoke',
        ts: new Date().toISOString(),
      },
    });
    expect(res.status()).toBe(204);
  });

  test('/api/log rejects an invalid payload with 400', async ({ request }) => {
    const res = await request.post('/api/log', {
      data: { not_a_valid_field: 'oops' },
    });
    expect(res.status()).toBe(400);
  });

  test('/api/log/forget accepts a UUID requestId and returns ok shape', async ({ request }) => {
    const res = await request.post('/api/log/forget', {
      data: { requestId: SYNTHETIC_REQUEST_ID },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ ok: true });
    expect(typeof body.deleted).toBe('number');
  });

  test('/api/log/forget rejects non-UUID requestId with 400', async ({ request }) => {
    const res = await request.post('/api/log/forget', {
      data: { requestId: 'not-a-uuid' },
    });
    expect(res.status()).toBe(400);
  });
});
