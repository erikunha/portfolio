import type { Instrumentation } from 'next';
import { log } from '@/lib/log';
import { describeError } from '@/lib/log-error';

const QUERY_SEPARATOR = '?';
const REQUEST_ERROR_LOG_MESSAGE = 'request.error';

export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== 'edge') {
    const { registerLangfuseProcessor } = await import('@/lib/telemetry/langfuse');
    await registerLangfuseProcessor();
  }
}

function digestOf(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null || !('digest' in error)) return undefined;
  return String(error.digest);
}

export const onRequestError: Instrumentation.onRequestError = async (error, request, context) => {
  await log.error(REQUEST_ERROR_LOG_MESSAGE, {
    digest: digestOf(error),
    errorName: describeError(error).name,
    path: request.path.split(QUERY_SEPARATOR)[0],
    method: request.method,
    routerKind: context.routerKind,
    routePath: context.routePath,
    routeType: context.routeType,
    renderSource: context.renderSource,
  });
};
