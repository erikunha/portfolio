'use client';

import { usePathname } from 'next/navigation';
import { type ReactNode, useEffect, useRef, useState } from 'react';
import { reportClientError } from '@/components/ErrorBoundary/ErrorBoundary.client';
import { MAIN_CONTENT_ID, PageMain } from '@/components/PageMain';
import { brandByLocale } from '@/content/brand';
import { errorsClientContent as errorsContent } from '@/content/errors-client';
import type { ErrorsContent } from '@/content/schemas';
import { localeOfPath, type SiteLocale } from '@/content/site-locale';
import { COPY_STATUS, useCopyFeedback } from '@/lib/use-copy-feedback.client';

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

const REF_EDGE_CHARS = 4;
const REF_ELLIPSIS = '...';
const BOOT_STAMP_PENDING = '--.---';
const BOOT_STAMP_DECIMALS = 3;
const MS_PER_SECOND = 1000;

export function ellipsizeRef(id: string): string {
  if (id.length <= REF_EDGE_CHARS * 2 + REF_ELLIPSIS.length) return id;
  return `${id.slice(0, REF_EDGE_CHARS)}${REF_ELLIPSIS}${id.slice(-REF_EDGE_CHARS)}`;
}

function bootStamp(elapsedMs: number): string {
  return (elapsedMs / MS_PER_SECOND).toFixed(BOOT_STAMP_DECIMALS);
}

export interface BootStamps {
  rendered: string;
  reported: string;
}

const PENDING_STAMPS: BootStamps = { rendered: BOOT_STAMP_PENDING, reported: BOOT_STAMP_PENDING };

export function useErrorReport(prefix: string, error: Error): BootStamps {
  const [stamps, setStamps] = useState(PENDING_STAMPS);
  useEffect(() => {
    const rendered = bootStamp(performance.now());
    reportClientError(prefix, error);
    setStamps({ rendered, reported: bootStamp(performance.now()) });
  }, [prefix, error]);
  return stamps;
}

function ErrorReference({
  digest,
  content,
}: {
  digest: string;
  content: ErrorsContent['serverError'];
}) {
  const { status, copy } = useCopyFeedback({ resetMs: COPIED_RESET_MS });

  return (
    <p className="err-ref">
      <span>
        {content.refLabel} <code title={digest}>{ellipsizeRef(digest)}</code>
      </span>
      <button
        type="button"
        className="copy-btn"
        aria-label={content.copyAriaLabel}
        onClick={() => copy(digest)}
      >
        {content.copyLabel}
      </button>
      <span className="sr-only" role="status">
        {status === COPY_STATUS.Copied ? content.copiedAnnouncement : ''}
      </span>
    </p>
  );
}

export interface RouteErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export function ServerErrorMain({
  reset,
  content,
  stamps,
  digest,
}: Pick<RouteErrorProps, 'reset'> & {
  content: ErrorsContent['serverError'];
  stamps: BootStamps;
  digest?: string | undefined;
}) {
  return (
    <PageMain className={ERROR_MAIN_CLASS}>
      <ErrorHeading>{content.code}</ErrorHeading>
      <div className="err-log" role="alert">
        <div className="err-log-boot" aria-hidden="true">
          <p>{`[ ${stamps.rendered} ] ${content.bootRender}`}</p>
          <p>{`[ ${stamps.reported} ] ${content.bootReport}`}</p>
        </div>
        <p className="err-text">{content.message}</p>
      </div>
      <div className="err-actions">
        <button type="button" className="err-action err-action-primary" onClick={reset}>
          {content.retryLabel}
        </button>
        <a className="err-action" href={content.home.href}>
          {content.home.label}
        </a>
      </div>
      {digest ? <ErrorReference digest={digest} content={content} /> : null}
    </PageMain>
  );
}

export function RouteErrorPage({ error, reset }: RouteErrorProps) {
  const locale = localeOfPath(usePathname());
  const content = errorsContent[locale];
  const stamps = useErrorReport('[RouteError]', error);

  return (
    <>
      <ErrorChrome chrome={content.chrome} brand={<ClientBrandLink locale={locale} />} />
      <ServerErrorMain
        reset={reset}
        content={content.serverError}
        stamps={stamps}
        digest={error.digest}
      />
    </>
  );
}
