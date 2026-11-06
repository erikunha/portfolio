'use client';

import { Component, type CSSProperties, type ReactNode } from 'react';

import { errorsClientContent } from '@/content/errors-client';
import { DEFAULT_SITE_LOCALE, type SiteLocale } from '@/content/site-locale';
import { buildLogPayload } from '@/lib/error-bridge.client';

const MIN_HEIGHT_VAR = '--eb-min-height';

function reloadPage() {
  window.location.reload();
}

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  locale?: SiteLocale;
  minHeight?: string;
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
    if (!this.state.hasError) return this.props.children;
    const { fallback, locale = DEFAULT_SITE_LOCALE, minHeight } = this.props;
    if (fallback !== undefined) return fallback;
    const copy = errorsClientContent[locale];
    return (
      <div
        className="eb-fallback"
        role="alert"
        style={minHeight ? ({ [MIN_HEIGHT_VAR]: minHeight } as CSSProperties) : undefined}
      >
        <p className="eb-title">! {copy.componentUnavailable}</p>
        <p className="eb-text">{copy.componentExplanation}</p>
        <button type="button" className="eb-reload" onClick={reloadPage}>
          {copy.reloadLabel}
        </button>
      </div>
    );
  }
}
