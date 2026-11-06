'use client';

import { buildLogPayload } from '@/lib/error-bridge.client';

export function reportClientError(
  prefix: string,
  error: Error,
  fallbackStack?: string | null,
): void {
  if (typeof window === 'undefined') return;
  void fetch('/api/log', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(
      buildLogPayload(`${prefix} ${error.message}`, error.stack ?? fallbackStack ?? undefined),
    ),
    keepalive: true,
  }).catch(() => undefined);
}
