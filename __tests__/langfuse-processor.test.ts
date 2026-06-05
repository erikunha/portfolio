import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Behavioral contract for lib/telemetry/langfuse.ts (WS5 acceptance criterion 5):
//   - Flag OFF (unset or != 'true'): LangfuseExporter is NEVER constructed and
//     registerOTel is NEVER called. The hot path imports nothing.
//   - Flag ON ('true'): LangfuseExporter is constructed exactly once with the
//     operator credentials, and registerOTel receives it as a traceExporter.
// Both assertions are mechanical (mocked constructor + mocked registrar), not
// source-grep - they prove the zero-hot-path-impact contract by observation.

// Track LangfuseExporter construction + the credentials it was handed.
const exporterCtor = vi.fn();
class MockLangfuseExporter {
  constructor(opts: unknown) {
    exporterCtor(opts);
  }
}

// Track registerOTel invocation + the options it received (so we can assert the
// exporter was wired as traceExporter).
const registerOTel = vi.fn();

vi.mock('langfuse-vercel', () => ({
  LangfuseExporter: MockLangfuseExporter,
}));

vi.mock('@vercel/otel', () => ({
  registerOTel,
}));

// log.warn must fire on a registration throw without rethrowing - assert it is
// reachable but never the cause of a crash.
const logWarn = vi.fn();
vi.mock('@/lib/log', () => ({
  log: { info: vi.fn(), warn: logWarn, error: vi.fn() },
}));

async function loadAndRegister() {
  const mod = await import('@/lib/telemetry/langfuse');
  await mod.registerLangfuseProcessor();
}

describe('registerLangfuseProcessor - flag OFF', () => {
  beforeEach(() => {
    vi.resetModules();
    exporterCtor.mockReset();
    registerOTel.mockReset();
    logWarn.mockReset();
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('is inert when LANGFUSE_ENABLED is unset', async () => {
    vi.stubEnv('LANGFUSE_ENABLED', '');
    await loadAndRegister();
    expect(exporterCtor).not.toHaveBeenCalled();
    expect(registerOTel).not.toHaveBeenCalled();
  });

  it('is inert when LANGFUSE_ENABLED is a non-"true" value', async () => {
    vi.stubEnv('LANGFUSE_ENABLED', 'TRUE'); // case-sensitive: only lowercase 'true' activates
    await loadAndRegister();
    expect(exporterCtor).not.toHaveBeenCalled();
    expect(registerOTel).not.toHaveBeenCalled();
  });

  it('is inert when LANGFUSE_ENABLED is "1"', async () => {
    vi.stubEnv('LANGFUSE_ENABLED', '1');
    await loadAndRegister();
    expect(exporterCtor).not.toHaveBeenCalled();
    expect(registerOTel).not.toHaveBeenCalled();
  });
});

describe('registerLangfuseProcessor - flag ON', () => {
  beforeEach(() => {
    vi.resetModules();
    exporterCtor.mockReset();
    registerOTel.mockReset();
    logWarn.mockReset();
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('constructs LangfuseExporter once with operator credentials and wires it into registerOTel', async () => {
    vi.stubEnv('LANGFUSE_ENABLED', 'true');
    vi.stubEnv('LANGFUSE_SECRET_KEY', 'sk-test-secret');
    vi.stubEnv('LANGFUSE_PUBLIC_KEY', 'pk-test-public');
    vi.stubEnv('LANGFUSE_BASEURL', 'https://cloud.langfuse.example');

    await loadAndRegister();

    expect(exporterCtor).toHaveBeenCalledTimes(1);
    expect(exporterCtor).toHaveBeenCalledWith(
      expect.objectContaining({
        secretKey: 'sk-test-secret',
        publicKey: 'pk-test-public',
        baseUrl: 'https://cloud.langfuse.example',
      }),
    );

    expect(registerOTel).toHaveBeenCalledTimes(1);
    const arg = registerOTel.mock.calls[0]?.[0] as { traceExporter?: unknown };
    expect(arg.traceExporter).toBeInstanceOf(MockLangfuseExporter);
  });

  it('passes through without rethrowing when registration throws (logs warn)', async () => {
    vi.stubEnv('LANGFUSE_ENABLED', 'true');
    vi.stubEnv('LANGFUSE_SECRET_KEY', 'sk-test-secret');
    vi.stubEnv('LANGFUSE_PUBLIC_KEY', 'pk-test-public');
    registerOTel.mockImplementation(() => {
      throw new Error('otel boom at cold start');
    });

    // Must NOT throw - a Langfuse init failure must never crash the server.
    await expect(loadAndRegister()).resolves.toBeUndefined();
    expect(logWarn).toHaveBeenCalledTimes(1);
  });
});
