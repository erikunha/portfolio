'use client';

import { usePathname } from 'next/navigation';
import { type ReactNode, Suspense, useEffect, useRef, useState } from 'react';
import { PageMain } from '@/components/PageMain';
import { NOT_FOUND_PATH_TOKEN } from '@/content/errors.constants';
import type { ErrorsContent } from '@/content/schemas';
import { CmdLine } from '@/design-system';
import { reportClientError } from '@/lib/report-client-error.client';
import { COPY_STATUS, useCopyFeedback } from '@/lib/use-copy-feedback.client';
import { ERROR_MAIN_CLASS } from './error-main';

const COPIED_RESET_MS = 2000;

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

const MAX_PATH_CHARS = 64;
const PATH_ELLIPSIS = '...';
const SPOOFING_CONTROLS = /[\p{Cc}\u061C\u200E\u200F\u202A-\u202E\u2066-\u2069]/gu;

export function readablePath(pathname: string | null, fallback: string): string {
  if (!pathname) return fallback;
  let decoded = pathname;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    decoded = pathname;
  }
  decoded = decoded.replace(SPOOFING_CONTROLS, '');
  if (decoded === '') return fallback;
  const characters = Array.from(decoded);
  return characters.length > MAX_PATH_CHARS
    ? `${characters.slice(0, MAX_PATH_CHARS - PATH_ELLIPSIS.length).join('')}${PATH_ELLIPSIS}`
    : decoded;
}

type RequestedPathContent = Pick<
  ErrorsContent['notFound'],
  'prompt' | 'command' | 'output' | 'pathFallback'
>;

function PathCmdLine({ content, path }: { content: RequestedPathContent; path: string }) {
  return (
    <CmdLine
      className="err-cmd"
      user=""
      prompt={content.prompt}
      command={content.command.replace(NOT_FOUND_PATH_TOKEN, () => path)}
      output={content.output.replace(NOT_FOUND_PATH_TOKEN, () => path)}
    />
  );
}

function CurrentPathCmdLine({ content }: { content: RequestedPathContent }) {
  return <PathCmdLine content={content} path={readablePath(usePathname(), content.pathFallback)} />;
}

export function RequestedPathCmdLine({ content }: { content: RequestedPathContent }) {
  return (
    <Suspense fallback={<PathCmdLine content={content} path={content.pathFallback} />}>
      <CurrentPathCmdLine content={content} />
    </Suspense>
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
