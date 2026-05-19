// components/responsive/Module.tsx
// Pure Server Component. No 'use client' boundary, no React state, no event
// listeners, no useBreakpoint hook. Saves ~18 client-component hydrations
// (one per section) at the cost of native <details> on mobile instead of a
// custom toggle. The 'module:open' event from Dock is handled by a single
// delegated listener in AppShell.client.tsx that flips the open attribute.

import { headers } from 'next/headers';
import type { ReactNode } from 'react';
import { detectMobileFromUA } from '@/lib/breakpoint';

export type ModuleProps = {
  id: string;
  header: string;
  mobileHeader?: string;
  icon?: ReactNode;
  defaultOpen?: boolean;
  /** Applies content-visibility:auto deferral for below-fold modules. */
  defer?: boolean | undefined;
  children: ReactNode;
};

export async function Module({
  id,
  header,
  mobileHeader,
  icon,
  defaultOpen = true,
  defer = false,
  children,
}: ModuleProps) {
  const ua = (await headers()).get('user-agent');
  const isMobile = detectMobileFromUA(ua);
  const activeHeader = isMobile && mobileHeader ? mobileHeader : header;

  if (!isMobile) {
    return (
      <section id={id} className={`module module--desktop${defer ? ' cv-defer' : ''}`}>
        <h2 className="module__header">
          {icon ? (
            <span className="module__icon" aria-hidden>
              {icon}
            </span>
          ) : null}
          <span>{activeHeader}</span>
        </h2>
        <div className="module__body">{children}</div>
      </section>
    );
  }

  return (
    <details
      id={id}
      className={`module module--mobile${defer ? ' cv-defer' : ''}`}
      open={defaultOpen || undefined}
    >
      <summary className="module__toggle">
        <span className="module__header-label">
          {icon ? (
            <span className="module__icon" aria-hidden>
              {icon}
            </span>
          ) : null}
          <span>{activeHeader}</span>
        </span>
        <span className="module__chevron" aria-hidden>
          ▸
        </span>
      </summary>
      <div className="module__body" id={`${id}-body`}>
        {children}
      </div>
    </details>
  );
}
