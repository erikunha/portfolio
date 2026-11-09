import type { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const PRERENDER_INTERRUPT_DIGEST = 'NEXT_PRERENDER_INTERRUPTED';

function prerenderInterrupt(): Error {
  return Object.assign(new Error('Route needs to bail out of prerendering'), {
    digest: PRERENDER_INTERRUPT_DIGEST,
  });
}

const getClientIpMock = vi.fn<(req: unknown) => string>();
const limitMock = vi.fn();
const getScoresMock = vi.fn();
const logWarnMock = vi.fn();

vi.mock('@/lib/rate-limit', () => ({
  getClientIp: getClientIpMock,
  getLighthouseLimit: vi.fn(() => ({ limit: limitMock })),
  getMcpLimit: vi.fn(() => ({ limit: limitMock })),
}));

vi.mock('@/lib/lighthouse-scores', () => ({
  getScores: getScoresMock,
  LIGHTHOUSE_FALLBACK: { fetchedAt: '-' },
  LIGHTHOUSE_TTL_S: 86400,
}));

vi.mock('@/lib/log', () => ({
  log: { info: vi.fn(), warn: logWarnMock, error: vi.fn(), debug: vi.fn() },
}));

const request = {} as NextRequest;

beforeEach(() => {
  vi.resetModules();
  getClientIpMock.mockReset();
  limitMock.mockReset();
  getScoresMock.mockReset();
  logWarnMock.mockReset();
  getClientIpMock.mockImplementation(() => {
    throw prerenderInterrupt();
  });
});

describe('route handlers during next build', () => {
  it('GET /api/lighthouse lets the prerender interrupt through and never reaches PSI', async () => {
    const { GET } = await import('@/app/api/lighthouse/route');
    await expect(GET(request)).rejects.toMatchObject({ digest: PRERENDER_INTERRUPT_DIGEST });
    expect(getScoresMock).not.toHaveBeenCalled();
    expect(logWarnMock).not.toHaveBeenCalled();
  });

  it('GET /api/lighthouse still allows the request when the rate limiter itself fails', async () => {
    getClientIpMock.mockReturnValue('203.0.113.7');
    limitMock.mockRejectedValue(new Error('redis down'));
    getScoresMock.mockResolvedValue({ fetchedAt: '2026-01-01T00:00:00.000Z' });
    const { GET } = await import('@/app/api/lighthouse/route');
    const res = await GET(request);
    expect(res.status).toBe(200);
    expect(getScoresMock).toHaveBeenCalledOnce();
  });

  it('withRateLimit lets the prerender interrupt through and never runs the handler', async () => {
    const handler = vi.fn(async () => new Response('ok'));
    const { withRateLimit } = await import('@/lib/server/rate-limit-guard');
    const guarded = withRateLimit(handler, () => ({ limit: limitMock }), 'too many requests');
    await expect(guarded(new Request('http://localhost/api/mcp'))).rejects.toMatchObject({
      digest: PRERENDER_INTERRUPT_DIGEST,
    });
    expect(handler).not.toHaveBeenCalled();
    expect(logWarnMock).not.toHaveBeenCalled();
  });

  it('withRateLimit still allows the request when the rate limiter itself fails', async () => {
    getClientIpMock.mockReturnValue('203.0.113.7');
    limitMock.mockRejectedValue(new Error('redis down'));
    const handler = vi.fn(async () => new Response('ok'));
    const { withRateLimit } = await import('@/lib/server/rate-limit-guard');
    const guarded = withRateLimit(handler, () => ({ limit: limitMock }), 'too many requests');
    const res = await guarded(new Request('http://localhost/api/mcp'));
    expect(res.status).toBe(200);
    expect(handler).toHaveBeenCalledOnce();
  });
});
