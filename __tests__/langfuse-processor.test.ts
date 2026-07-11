import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const exporterCtor = vi.fn();
class MockLangfuseExporter {
  constructor(opts: unknown) {
    exporterCtor(opts);
  }
}

const registerOTel = vi.fn();

vi.mock('langfuse-vercel', () => ({
  LangfuseExporter: MockLangfuseExporter,
}));

vi.mock('@vercel/otel', () => ({
  registerOTel,
}));

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
    vi.stubEnv('LANGFUSE_ENABLED', undefined);
    await loadAndRegister();
    expect(exporterCtor).not.toHaveBeenCalled();
    expect(registerOTel).not.toHaveBeenCalled();
  });

  it('is inert when LANGFUSE_ENABLED is a non-"true" value', async () => {
    vi.stubEnv('LANGFUSE_ENABLED', 'TRUE');
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

    await expect(loadAndRegister()).resolves.toBeUndefined();
    expect(logWarn).toHaveBeenCalledTimes(1);
  });
});
