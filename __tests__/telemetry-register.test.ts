import { createRequire } from 'node:module';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetTelemetryRegistration } from './helpers/telemetry-registration';

const registerOTel = vi.fn();

vi.mock('langfuse-vercel', () => ({
  LangfuseExporter: class {},
}));

vi.mock('@vercel/otel', () => ({
  registerOTel,
}));

const logWarn = vi.fn();
vi.mock('@/lib/log', () => ({
  log: { info: vi.fn(), warn: logWarn, error: vi.fn() },
}));

type TelemetryGlobal = typeof globalThis & {
  AI_SDK_TELEMETRY_INTEGRATIONS?: unknown[];
};

const telemetryGlobal = globalThis as TelemetryGlobal;
const requireFromTest = createRequire(import.meta.url);

async function registeredLegacyIntegrations(): Promise<unknown[]> {
  const { LegacyOpenTelemetry } = await import('@ai-sdk/otel');
  return (telemetryGlobal.AI_SDK_TELEMETRY_INTEGRATIONS ?? []).filter(
    (integration) => integration instanceof LegacyOpenTelemetry,
  );
}

async function register(): Promise<void> {
  const mod = await import('@/lib/telemetry/langfuse');
  await mod.registerLangfuseProcessor();
}

describe('AI SDK telemetry registration', () => {
  beforeEach(() => {
    vi.resetModules();
    registerOTel.mockReset();
    logWarn.mockReset();
    resetTelemetryRegistration();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('registers no integration and no tracer provider when LANGFUSE_ENABLED is off', async () => {
    vi.stubEnv('LANGFUSE_ENABLED', undefined);
    await register();
    expect(registerOTel).not.toHaveBeenCalled();
    expect(await registeredLegacyIntegrations()).toHaveLength(0);
  });

  it('registers the legacy integration and the tracer provider once when the flag is on', async () => {
    vi.stubEnv('LANGFUSE_ENABLED', 'true');
    await register();
    expect(registerOTel).toHaveBeenCalledTimes(1);
    expect(await registeredLegacyIntegrations()).toHaveLength(1);
  });

  it('registers once even when register runs twice in one module instance', async () => {
    vi.stubEnv('LANGFUSE_ENABLED', 'true');
    const mod = await import('@/lib/telemetry/langfuse');
    await mod.registerLangfuseProcessor();
    await mod.registerLangfuseProcessor();
    expect(registerOTel).toHaveBeenCalledTimes(1);
    expect(await registeredLegacyIntegrations()).toHaveLength(1);
  });

  it('registers once when a reloaded module instance runs register again', async () => {
    vi.stubEnv('LANGFUSE_ENABLED', 'true');
    await register();
    vi.resetModules();
    await register();
    expect(registerOTel).toHaveBeenCalledTimes(1);
    expect(await registeredLegacyIntegrations()).toHaveLength(1);
  });

  it('warns without throwing and registers no integration when the tracer provider fails', async () => {
    vi.stubEnv('LANGFUSE_ENABLED', 'true');
    registerOTel.mockImplementation(() => {
      throw new Error('otel boom at cold start');
    });
    await expect(register()).resolves.toBeUndefined();
    expect(logWarn).toHaveBeenCalledTimes(1);
    expect(await registeredLegacyIntegrations()).toHaveLength(0);
  });

  it('retries registration after a failure instead of latching the guard', async () => {
    vi.stubEnv('LANGFUSE_ENABLED', 'true');
    registerOTel.mockImplementationOnce(() => {
      throw new Error('transient');
    });
    await register();
    await register();
    expect(registerOTel).toHaveBeenCalledTimes(2);
    expect(await registeredLegacyIntegrations()).toHaveLength(1);
  });

  it('keeps a single copy of ai: the OTel integration depends on the installed ai version', () => {
    const aiVersion = (requireFromTest('ai/package.json') as { version: string }).version;
    const otelPkg = requireFromTest('@ai-sdk/otel/package.json') as {
      dependencies: Record<string, string>;
    };
    expect(otelPkg.dependencies.ai).toBe(aiVersion);
  });
});
