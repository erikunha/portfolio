'use client';

import { Component, type ReactNode, useEffect, useRef, useState } from 'react';

import { errorsContent } from '@/content/errors';
import type { ErrorsContent } from '@/content/schemas';
import { Button } from '@/design-system';
import { buildLogPayload } from '@/lib/error-bridge.client';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
}

const COPIED_RESET_MS = 2000;
const FALLBACK_MONO_FONT = 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';

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
            <span className="gt">!</span>
            {' component unavailable'}
          </div>
        )
      );
    }
    return this.props.children;
  }
}

export function ErrorChrome({ chrome }: { chrome: ErrorsContent['chrome'] }) {
  return (
    <>
      <a href="#main-content" className="skip-to-content">
        {chrome.skipLabel}
      </a>
      <header className="err-bar">
        <a className="err-bar-brand" href={chrome.brandHref}>
          {chrome.brand}
        </a>
        <nav aria-label={chrome.navLabel}>
          {chrome.nav.map((item) => (
            <a key={item.href} className="err-bar-link" href={item.href}>
              {item.label}
            </a>
          ))}
        </nav>
      </header>
    </>
  );
}

export function ErrorHeading({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    ref.current?.focus({ preventScroll: true });
  }, []);
  return (
    <h1 ref={ref} className="err-h1" tabIndex={-1}>
      {children}
    </h1>
  );
}

function ErrorReference({
  digest,
  content,
}: {
  digest: string;
  content: ErrorsContent['serverError'];
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(digest);
    } catch {
      return;
    }
    setCopied(true);
    setTimeout(() => setCopied(false), COPIED_RESET_MS);
  }

  return (
    <div className="err-ref">
      <span>
        {content.refLabel} <code>{digest}</code>
      </span>
      <button type="button" className="copy-btn" aria-label={content.copyAriaLabel} onClick={copy}>
        {content.copyLabel}
      </button>
      <span className="sr-only" role="status">
        {copied ? content.copiedAnnouncement : ''}
      </span>
    </div>
  );
}

export interface RouteErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

function ServerErrorMain({
  error,
  reset,
  content,
}: RouteErrorProps & { content: ErrorsContent['serverError'] }) {
  return (
    <main className="err-main" id="main-content" tabIndex={-1}>
      <ErrorHeading>{content.code}</ErrorHeading>
      <p className="err-text">{content.message}</p>
      <div className="err-actions">
        <Button type="button" variant="primary" onClick={reset}>
          {content.retryLabel}
        </Button>
        <Button as="a" variant="secondary" href={content.home.href}>
          {content.home.label}
        </Button>
      </div>
      {error.digest ? <ErrorReference digest={error.digest} content={content} /> : null}
    </main>
  );
}

export function RouteErrorPage({ error, reset }: RouteErrorProps) {
  useEffect(() => {
    reportClientError('[RouteError]', error);
  }, [error]);

  return (
    <>
      <ErrorChrome chrome={errorsContent.chrome} />
      <ServerErrorMain error={error} reset={reset} content={errorsContent.serverError} />
    </>
  );
}

export function GlobalErrorPage({ error, reset }: RouteErrorProps) {
  useEffect(() => {
    reportClientError('[GlobalError]', error);
  }, [error]);

  return (
    <html lang="en">
      <body style={{ fontFamily: FALLBACK_MONO_FONT }}>
        <ErrorChrome chrome={errorsContent.chrome} />
        <ServerErrorMain error={error} reset={reset} content={errorsContent.serverError} />
      </body>
    </html>
  );
}
