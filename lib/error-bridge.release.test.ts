import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildLogPayload } from '@/lib/error-bridge.client';

const RELEASE = 'a1b2c3d4e5f6';
const VIEWPORT_WIDTH = 390;
const DIGEST = '2918476530';

function setViewportWidth(width: number): void {
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: width });
}

describe('client error context', () => {
  beforeEach(() => {
    vi.stubEnv('RELEASE', RELEASE);
    document.documentElement.lang = 'pt-BR';
    document.body.dataset.motion = 'reduce';
    setViewportWidth(VIEWPORT_WIDTH);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    document.documentElement.lang = '';
    delete document.body.dataset.motion;
  });

  it('tags a payload with the release, document language, motion state and viewport width', () => {
    const payload = buildLogPayload('boom', undefined);
    expect(payload).toMatchObject({
      release: RELEASE,
      lang: 'pt-BR',
      motion: 'reduce',
      vw: VIEWPORT_WIDTH,
    });
  });

  it('follows the live motion switch, not a value read at load', () => {
    document.body.dataset.motion = 'full';
    expect(buildLogPayload('boom', undefined)).toMatchObject({ motion: 'full' });
  });

  it('carries the Next error digest when one is given', () => {
    expect(buildLogPayload('boom', undefined, DIGEST)).toMatchObject({ digest: DIGEST });
  });
});

describe('error boundary reporter', () => {
  const fetchSpy = vi.fn(
    async (_url: string, _opts: RequestInit) => new Response(null, { status: 204 }),
  );

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchSpy);
    vi.stubEnv('RELEASE', RELEASE);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    fetchSpy.mockClear();
  });

  it('posts the digest of the error the boundary caught', async () => {
    const { reportClientError } = await import('@/lib/report-client-error.client');
    const error = Object.assign(new Error('render failed'), { digest: DIGEST });
    reportClientError('[RouteError]', error);
    await vi.waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledOnce();
    });
    const body = JSON.parse(String(fetchSpy.mock.calls[0]?.[1].body)) as Record<string, unknown>;
    expect(body).toMatchObject({ digest: DIGEST, release: RELEASE });
  });
});

describe('build-time release', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('inlines the same commit SHA that /api/healthz reports', async () => {
    vi.stubEnv('VERCEL_GIT_COMMIT_SHA', RELEASE);
    vi.resetModules();
    const config = (await import('../next.config')).default;
    const { commitSha } = await import('@/lib/env-build');
    expect(commitSha()).toBe(RELEASE);
    expect(config.env).toMatchObject({ RELEASE });
  });
});
