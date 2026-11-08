'use client';

import { buildLogPayload, postLog } from '@/lib/error-bridge.client';

export function reportClientError(
  prefix: string,
  error: Error,
  fallbackStack?: string | null,
): void {
  if (typeof window === 'undefined') return;
  postLog(buildLogPayload(`${prefix} ${error.message}`, error.stack ?? fallbackStack ?? undefined));
}
