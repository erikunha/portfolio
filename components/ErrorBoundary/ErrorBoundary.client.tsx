'use client';

import { Component, type ReactNode } from 'react';

import { errorsClientContent } from '@/content/errors-client';
import { DEFAULT_SITE_LOCALE, type SiteLocale } from '@/content/site-locale';
import { buildLogPayload } from '@/lib/error-bridge.client';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  locale?: SiteLocale;
}

interface State {
  hasError: boolean;
}

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

export class ErrorBoundary extends Component<Props, State> {
  override state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  override componentDidCatch(error: Error, info: { componentStack?: string | null }) {
    console.error('[ErrorBoundary] client island crashed:', error, info.componentStack);
    reportClientError('[ErrorBoundary]', error, info.componentStack);
  }

  override render() {
    if (this.state.hasError) {
      return (
        this.props.fallback ?? (
          <div className="eb-fallback" role="alert" aria-live="polite">
            <span className="gt">!</span>{' '}
            {errorsClientContent[this.props.locale ?? DEFAULT_SITE_LOCALE].componentUnavailable}
          </div>
        )
      );
    }
    return this.props.children;
  }
}
