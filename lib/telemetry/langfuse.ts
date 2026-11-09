import 'server-only';

import { env } from '@/lib/env';
import { log } from '@/lib/log';

const REGISTERED_KEY = Symbol.for('erikunha.ai-telemetry.registered');

const SERVICE_NAME = 'erikunha-dev';

type RegistrationGuard = typeof globalThis & { [REGISTERED_KEY]?: true };

function isEnabled(): boolean {
  return env.LANGFUSE_ENABLED === 'true';
}

export async function registerLangfuseProcessor(): Promise<void> {
  if (!isEnabled()) return;

  const guard = globalThis as RegistrationGuard;
  if (guard[REGISTERED_KEY]) return;

  try {
    const [{ LangfuseExporter }, { registerOTel }, { registerTelemetry }, { LegacyOpenTelemetry }] =
      await Promise.all([
        import('langfuse-vercel'),
        import('@vercel/otel'),
        import('ai'),
        import('@ai-sdk/otel'),
      ]);

    const exporterOptions: {
      secretKey?: string;
      publicKey?: string;
      baseUrl?: string;
    } = {};
    if (env.LANGFUSE_SECRET_KEY) exporterOptions.secretKey = env.LANGFUSE_SECRET_KEY;
    if (env.LANGFUSE_PUBLIC_KEY) exporterOptions.publicKey = env.LANGFUSE_PUBLIC_KEY;
    if (env.LANGFUSE_BASEURL) exporterOptions.baseUrl = env.LANGFUSE_BASEURL;

    const traceExporter = new LangfuseExporter(exporterOptions);

    registerOTel({ serviceName: SERVICE_NAME, traceExporter });
    registerTelemetry(new LegacyOpenTelemetry());
    guard[REGISTERED_KEY] = true;

    log.info('langfuse span processor registered');
  } catch (err) {
    log.warn('langfuse span processor registration failed, continuing without it', {
      errMessage: err instanceof Error ? err.message : String(err),
    });
  }
}
