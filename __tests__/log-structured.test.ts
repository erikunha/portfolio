// __tests__/log-structured.test.ts
// Behavioral test: exercises the lib/log.ts structured-logging facade
// and verifies routes emit through it — instead of grepping route source for
// `import { log }` / the absence of `console.*`.
//
//  - lib/log.ts: imports the real `log` object, asserts its public surface
//    (info/warn/error) is callable, and that the deliberately-omitted
//    correlation helpers are genuinely absent from the module exports.
//  - Edge fallback: with NEXT_RUNTIME=edge, the facade must emit a JSON line
//    via console.log (pino's worker_threads transport is unavailable on Edge).
//  - Route integration: /api/contact is exercised end-to-end with a mocked
//    `log`; the route must call log.info / log.error with a structured ctx
//    object carrying `requestId` — the observable proof it logs structurally.
//
// The pino / pino-pretty dependency-declaration check is a genuine config
// read and carries a behavioral-test-allow tag.

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('lib/log.ts foundation', () => {
  it('declares pino as a runtime dep and pino-pretty as a dev dep', () => {
    // behavioral-test-allow: reads package.json to assert installed deps, not source structure
    const pkg = JSON.parse(readFileSync(path.resolve(__dirname, '../package.json'), 'utf-8')) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    expect(pkg.dependencies?.pino).toBeDefined();
    expect(pkg.devDependencies?.['pino-pretty']).toBeDefined();
  });

  it('exports a log object with callable info/warn/error methods', async () => {
    const { log } = await import('@/lib/log');
    expect(typeof log.info).toBe('function');
    expect(typeof log.warn).toBe('function');
    expect(typeof log.error).toBe('function');
    // The methods must not throw when called — they are the production
    // logging surface every route depends on.
    expect(() => log.info('test message')).not.toThrow();
    expect(() => log.warn('test message', { requestId: 'rid' })).not.toThrow();
    expect(() => log.error('test message', { err: new Error('x') })).not.toThrow();
  });

  it('does NOT export withRequestContext or currentRequestId', async () => {
    // The explicit-parameter correlation strategy means these helpers were
    // deliberately not built. Asserting their absence from the live module
    // exports catches a regression that reintroduces implicit context.
    const mod = await import('@/lib/log');
    expect('withRequestContext' in mod).toBe(false);
    expect('currentRequestId' in mod).toBe(false);
  });

  it('falls back to a JSON console line under the Edge runtime', async () => {
    vi.stubEnv('NEXT_RUNTIME', 'edge');
    vi.resetModules();
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {
      /* capture only — suppress real console output */
    });
    const { log } = await import('@/lib/log');
    log.info('edge message', { requestId: 'rid-edge' });
    expect(consoleSpy).toHaveBeenCalledOnce();
    // The Edge shim emits a single structured JSON line.
    const emitted = JSON.parse(String(consoleSpy.mock.calls[0]?.[0])) as Record<string, unknown>;
    expect(emitted.level).toBe('info');
    expect(emitted.msg).toBe('edge message');
    expect(emitted.requestId).toBe('rid-edge');
    consoleSpy.mockRestore();
    vi.unstubAllEnvs();
  });

  it('log.warn falls back to JSON console line under Edge runtime', async () => {
    vi.stubEnv('NEXT_RUNTIME', 'edge');
    vi.resetModules();
    // biome-ignore lint/suspicious/noEmptyBlockStatements: intentional no-op to suppress real console output
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const { log } = await import('@/lib/log');
    log.warn('edge warn', { requestId: 'rid-warn' });
    expect(consoleSpy).toHaveBeenCalledOnce();
    const emitted = JSON.parse(String(consoleSpy.mock.calls[0]?.[0])) as Record<string, unknown>;
    expect(emitted.level).toBe('warn');
    expect(emitted.msg).toBe('edge warn');
    consoleSpy.mockRestore();
    vi.unstubAllEnvs();
  });

  it('log.error falls back to JSON console line under Edge runtime', async () => {
    vi.stubEnv('NEXT_RUNTIME', 'edge');
    vi.resetModules();
    // biome-ignore lint/suspicious/noEmptyBlockStatements: intentional no-op to suppress real console output
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const { log } = await import('@/lib/log');
    log.error('edge error', { requestId: 'rid-err' });
    expect(consoleSpy).toHaveBeenCalledOnce();
    const emitted = JSON.parse(String(consoleSpy.mock.calls[0]?.[0])) as Record<string, unknown>;
    expect(emitted.level).toBe('error');
    expect(emitted.msg).toBe('edge error');
    consoleSpy.mockRestore();
    vi.unstubAllEnvs();
  });
});

describe('route integration — structured logging through the facade', () => {
  const logInfoMock = vi.fn();
  const logErrorMock = vi.fn();
  const redisSetMock = vi.fn();
  const resendSendMock = vi.fn();

  beforeEach(() => {
    vi.resetModules();
    logInfoMock.mockReset();
    logErrorMock.mockReset();
    redisSetMock.mockReset();
    resendSendMock.mockReset();
    process.env.RESEND_API_KEY = 'fake-key-for-tests';

    vi.doMock('@/lib/log', () => ({
      log: { info: logInfoMock, warn: vi.fn(), error: logErrorMock, debug: vi.fn() },
    }));
    vi.doMock('@/lib/rate-limit', () => ({
      getClientIp: vi.fn(() => '127.0.0.1'),
      getContactLimit: vi.fn(() => ({ limit: vi.fn(async () => ({ success: true })) })),
      getRedis: vi.fn(() => ({ set: redisSetMock })),
    }));
    vi.doMock('@/lib/ip-hash', () => ({
      hashIp: vi.fn(async () => 'hashed-ip-test'),
    }));
    vi.doMock('resend', () => ({
      Resend: class {
        emails = { send: resendSendMock };
      },
    }));
  });

  afterEach(() => {
    vi.doUnmock('@/lib/log');
    vi.doUnmock('@/lib/rate-limit');
    vi.doUnmock('@/lib/ip-hash');
    vi.doUnmock('resend');
  });

  function makeRequest(body: Record<string, unknown>): NextRequest {
    return new NextRequest('http://localhost/api/contact', {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' },
    });
  }

  it('/api/contact emits a structured log carrying requestId on the KV-failure path', async () => {
    // Make the KV write fail so the route hits its log.error branch.
    redisSetMock.mockRejectedValueOnce(new Error('KV down'));
    const { POST } = await import('@/app/api/contact/route');
    await POST(
      makeRequest({
        name: 'Real Name',
        email: 'real@example.com',
        message: 'A perfectly long-enough legitimate message',
      }),
    );

    // The route logged the failure through the facade with a structured ctx
    // object — not a bare console call, not a string-only message.
    expect(logErrorMock).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ requestId: expect.any(String) }),
    );
  });

  it('/api/contact emits a structured honeypot log carrying requestId', async () => {
    const { POST } = await import('@/app/api/contact/route');
    await POST(
      makeRequest({
        name: 'Real Name',
        email: 'real@example.com',
        message: 'A perfectly long-enough legitimate message',
        field_company: 'bot-filled', // honeypot → log.info path
      }),
    );

    expect(logInfoMock).toHaveBeenCalledWith(
      expect.stringMatching(/honeypot/i),
      expect.objectContaining({ requestId: expect.any(String) }),
    );
  });
});
