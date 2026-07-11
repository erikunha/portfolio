import 'server-only';

import { env } from '@/lib/env';
import { log } from '@/lib/log';

function isEnabled(): boolean {
  return env.LANGFUSE_ENABLED === 'true';
}

export async function registerLangfuseProcessor(): Promise<void> {
  if (!isEnabled()) return;

  try {
    const [{ LangfuseExporter }, { registerOTel }] = await Promise.all([
      import('langfuse-vercel'),
      import('@vercel/otel'),
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

    registerOTel({ serviceName: 'erikunha-dev', traceExporter });

    log.info('langfuse span processor registered');
  } catch (err) {
    log.warn('langfuse span processor registration failed, continuing without it', {
      errMessage: err instanceof Error ? err.message : String(err),
    });
  }
}
