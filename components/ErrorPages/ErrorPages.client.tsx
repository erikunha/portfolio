'use client';

import { usePathname } from 'next/navigation';
import { type ReactNode, useEffect, useRef, useState } from 'react';
import { reportClientError } from '@/components/ErrorBoundary/ErrorBoundary.client';
import { MAIN_CONTENT_ID, PageMain } from '@/components/PageMain';
import { brandByLocale } from '@/content/brand';
import { errorsClientContent as errorsContent } from '@/content/errors-client';
import type { ErrorsContent } from '@/content/schemas';
import { localeOfPath, type SiteLocale } from '@/content/site-locale';

export const ERROR_MAIN_CLASS = 'err-main';

const COPIED_RESET_MS = 2000;

const BRAND_IMAGE_SRC = '/icon.svg';
const BRAND_IMAGE_SIZE_PX = 28;

function ClientBrandLink({ locale }: { locale: SiteLocale }) {
  const brand = brandByLocale[locale];
  return (
    <a className="brand-link" href={brand.homeHref} aria-label={brand.accessibleName}>
      {/* biome-ignore lint/performance/noImgElement: a client boundary cannot import the inline SVG without shipping its path to every route; the static icon file carries the same mark */}
      <img src={BRAND_IMAGE_SRC} width={BRAND_IMAGE_SIZE_PX} height={BRAND_IMAGE_SIZE_PX} alt="" />
    </a>
  );
}

export function ErrorChrome({
  chrome,
  brand,
}: {
  chrome: ErrorsContent['chrome'];
  brand: ReactNode;
}) {
  return (
    <>
      <a href={`#${MAIN_CONTENT_ID}`} className="skip-to-content">
        {chrome.skipLabel}
      </a>
      <header className="err-bar">
        <nav aria-label={chrome.navLabel}>
          {chrome.nav.map((item) => (
            <a key={item.href} className="err-bar-link" href={item.href}>
              {item.label}
            </a>
          ))}
        </nav>
        {brand}
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
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (resetTimer.current) clearTimeout(resetTimer.current);
    },
    [],
  );

  async function copy() {
    try {
      await navigator.clipboard.writeText(digest);
    } catch {
      return;
    }
    setCopied(true);
    if (resetTimer.current) clearTimeout(resetTimer.current);
    resetTimer.current = setTimeout(() => setCopied(false), COPIED_RESET_MS);
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

export function ServerErrorMain({
  reset,
  content,
  children,
}: Pick<RouteErrorProps, 'reset'> & {
  content: ErrorsContent['serverError'];
  children?: ReactNode;
}) {
  return (
    <PageMain className={ERROR_MAIN_CLASS}>
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
      {children}
    </PageMain>
  );
}

export function RouteErrorPage({ error, reset }: RouteErrorProps) {
  const locale = localeOfPath(usePathname());
  const content = errorsContent[locale];
  useEffect(() => {
    reportClientError('[RouteError]', error);
  }, [error]);

  return (
    <>
      <ErrorChrome chrome={content.chrome} brand={<ClientBrandLink locale={locale} />} />
      <ServerErrorMain reset={reset} content={content.serverError}>
        {error.digest ? (
          <ErrorReference digest={error.digest} content={content.serverError} />
        ) : null}
      </ServerErrorMain>
    </>
  );
}
