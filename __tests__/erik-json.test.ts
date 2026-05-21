// __tests__/erik-json.test.ts
// Behavioral test (CG3): calls the real GET handler of /api/erik.json and
// asserts the parsed JSON body + response headers, instead of grepping the
// route source text. This exercises the actual machine-readable hiring
// profile a recruiter's tooling would fetch.

import { describe, expect, it } from 'vitest';
import { GET } from '@/app/api/erik.json/route';

describe('/api/erik.json route', () => {
  it('GET returns a JSON 200 response', async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toMatch(/application\/json/);
  });

  it('body is typed as a HiringProfile', async () => {
    const body = (await (await GET()).json()) as Record<string, unknown>;
    expect(body['@type']).toBe('HiringProfile');
  });

  it('body exposes the recruiter-facing fields', async () => {
    const body = (await (await GET()).json()) as Record<string, unknown>;
    expect(body.availability).toBeDefined();
    expect(body.stack_primary).toBeDefined();
    expect(Array.isArray(body.stack_primary)).toBe(true);
    expect(body.work_auth).toBeDefined();
  });

  it('sets a long-lived public cache header', async () => {
    const res = await GET();
    const cacheControl = res.headers.get('cache-control') ?? '';
    expect(cacheControl).toMatch(/max-age=\d+/);
    // max-age must be non-trivial — a static hiring manifest should cache.
    const maxAge = Number(cacheControl.match(/max-age=(\d+)/)?.[1] ?? '0');
    expect(maxAge).toBeGreaterThanOrEqual(3600);
  });

  it('sets X-Content-Type-Options: nosniff', async () => {
    const res = await GET();
    expect(res.headers.get('x-content-type-options')).toBe('nosniff');
  });
});
