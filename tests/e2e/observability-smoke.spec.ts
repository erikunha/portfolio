// tests/e2e/observability-smoke.spec.ts
// Smokes the Phase 3 endpoints end-to-end against the CI preview server.
// Spec ref: docs/superpowers/specs/2026-05-18-production-observability-design.md §8 criterion 8.

import { expect, test } from '@playwright/test';

const SYNTHETIC_REQUEST_ID = '00000000-0000-4000-8000-000000000000';

test.describe('observability smoke', () => {
  test('/api/log accepts a structured error payload (unified envelope)', async ({ request }) => {
    // PR 5b of audit roadmap migrated /api/log to defineHandler. Response
    // shape is now { ok: true, requestId } with X-Request-Id header
    // (previously 204 No Content). The smoke prefix still skips KV write.
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
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ ok: true });
    expect(typeof body.requestId).toBe('string');
    expect(res.headers()['x-request-id']).toBeTruthy();
  });

  test('/api/log rejects an invalid payload with 400 + validation_failed', async ({ request }) => {
    const res = await request.post('/api/log', {
      data: { not_a_valid_field: 'oops' },
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body).toMatchObject({ ok: false, error: { code: 'validation_failed' } });
  });

  test('/api/log/forget accepts a UUID requestId and returns unified envelope', async ({
    request,
  }) => {
    // The response no longer exposes the deletion count (existence oracle
    // protection). Shape is simply { ok: true, requestId }.
    const res = await request.post('/api/log/forget', {
      data: { requestId: SYNTHETIC_REQUEST_ID },
    });
    const status = res.status();
    // Rate limit (5/h) fires before handler — 429 after repeated local runs.
    // In CI the window is always fresh; a 429 there signals misconfiguration.
    if (status === 429) {
      if (process.env.CI) throw new Error('Rate-limit hit in CI — check window configuration');
      return;
    }
    expect(status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ ok: true });
    expect(typeof body.requestId).toBe('string');
    // Audit Theme 8: deleted count MUST NOT leak.
    expect(body.deleted).toBeUndefined();
  });

  test('/api/log/forget rejects non-UUID requestId with 400 + validation_failed', async ({
    request,
  }) => {
    const res = await request.post('/api/log/forget', {
      data: { requestId: 'not-a-uuid' },
    });
    const status = res.status();
    // Rate limit (5/h) fires before validation — 429 after repeated local runs.
    // In CI the window is always fresh; a 429 there signals misconfiguration.
    if (status === 429) {
      if (process.env.CI) throw new Error('Rate-limit hit in CI — check window configuration');
      return;
    }
    expect(status).toBe(400);
    const body = await res.json();
    expect(body).toMatchObject({ ok: false, error: { code: 'validation_failed' } });
  });
});
