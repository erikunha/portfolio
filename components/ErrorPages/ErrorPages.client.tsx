'use client';

import { type ReactNode, useEffect, useRef, useState } from 'react';

import { reportClientError } from '@/components/ErrorBoundary/ErrorBoundary.client';
import { errorsClientContent as errorsContent } from '@/content/errors-client';
import type { ErrorsContent } from '@/content/schemas';

const COPIED_RESET_MS = 2000;

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
        <button type="button" className="err-action" onClick={reset}>
          {content.retryLabel}
        </button>
        <a className="err-action" href={content.home.href}>
          {content.home.label}
        </a>
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
