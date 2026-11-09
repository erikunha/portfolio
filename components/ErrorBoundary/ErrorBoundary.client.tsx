'use client';

import { Component, type CSSProperties, type ReactNode } from 'react';

import { errorsClientContent } from '@/content/errors-client';
import { DEFAULT_SITE_LOCALE, type SiteLocale } from '@/content/site-locale';
import { reportClientError } from '@/lib/report-client-error.client';

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

export class ErrorBoundary extends Component<Props, State> {
  override state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  override componentDidCatch(error: Error, info: { componentStack?: string | null }) {
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
