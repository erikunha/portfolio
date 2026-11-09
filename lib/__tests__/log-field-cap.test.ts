import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const pinoInfo = vi.hoisted(() => vi.fn());

vi.mock('pino', () => {
  const factory = Object.assign(
    vi.fn(() => ({ info: pinoInfo, warn: pinoInfo, error: pinoInfo })),
    { stdSerializers: { err: vi.fn() } },
  );
  return { default: factory };
});

const FIELD_CAP = 2_000;
const HUGE = 'x'.repeat(50_000);

describe('log field length cap', () => {
  beforeEach(() => {
    vi.resetModules();
    pinoInfo.mockClear();
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('truncates long string fields before they reach pino, including nested ones', async () => {
    const { log } = await import('@/lib/log');
    log.info('event', { requestId: 'short', blob: HUGE, nested: { deep: HUGE }, list: [HUGE] });

    const ctx = pinoInfo.mock.calls[0]?.[0] as {
      requestId: string;
      blob: string;
      nested: { deep: string };
      list: string[];
    };
    expect(ctx.requestId).toBe('short');
    expect(
      ctx.blob.length,
      'a caller-controlled string of any size must not be written whole to the log drain',
    ).toBeLessThanOrEqual(FIELD_CAP);
    expect(ctx.nested.deep.length).toBeLessThanOrEqual(FIELD_CAP);
    expect(ctx.list[0]?.length).toBeLessThanOrEqual(FIELD_CAP);
  });

  it('truncates long string fields on the edge runtime path as well', async () => {
    vi.stubEnv('NEXT_RUNTIME', 'edge');
    const spy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const { log } = await import('@/lib/log');
    log.error('event', { blob: HUGE });

    const line = JSON.parse(String(spy.mock.calls[0]?.[0])) as { blob: string };
    expect(line.blob.length).toBeLessThanOrEqual(FIELD_CAP);
  });

  it('keeps non-string values and short strings untouched', async () => {
    const { log } = await import('@/lib/log');
    const when = new Date(0);
    log.warn('event', { count: 3, ok: true, none: null, when, text: 'hello' });

    expect(pinoInfo.mock.calls[0]?.[0]).toEqual({
      count: 3,
      ok: true,
      none: null,
      when,
      text: 'hello',
    });
  });
});
