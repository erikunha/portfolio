// components/responsive/Module.tsx
'use client';

import { useBreakpoint } from '@/lib/use-breakpoint';
import { type ReactNode, useEffect, useState } from 'react';

export type ModuleProps = {
  id: string;
  header: string;
  mobileHeader?: string;
  icon?: ReactNode;
  defaultOpen?: boolean;
  children: ReactNode;
};

export function Module({ id, header, mobileHeader, icon, defaultOpen = true, children }: ModuleProps) {
  const { isMobile } = useBreakpoint();
  const activeHeader = isMobile && mobileHeader ? mobileHeader : header;

  if (!isMobile) {
    return (
      <section id={id} className="module module--desktop">
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
    <MobileModule id={id} header={activeHeader} icon={icon} defaultOpen={defaultOpen}>
      {children}
    </MobileModule>
  );
}

function MobileModule({ id, header, icon, defaultOpen, children }: ModuleProps) {
  const [open, setOpen] = useState(defaultOpen);

  // Listen for the 'module:open' custom event dispatched by Dock when the user
  // taps a nav item. This avoids direct DOM mutation (which bypasses React state).
  useEffect(() => {
    const handler = (e: Event) => {
      const { id: targetId } = (e as CustomEvent<{ id: string }>).detail;
      if (targetId === id) setOpen(true);
    };
    window.addEventListener('module:open', handler);
    return () => window.removeEventListener('module:open', handler);
  }, [id]);

  return (
    <section id={id} className="module module--mobile" data-open={open}>
      <button
        className="module__toggle"
        aria-expanded={open}
        aria-controls={`${id}-body`}
        onClick={() => setOpen((o) => !o)}
        type="button"
      >
        <span className="module__header-label">
          {icon ? (
            <span className="module__icon" aria-hidden>
              {icon}
            </span>
          ) : null}
          <span>{header}</span>
        </span>
        <span className="module__chevron" aria-hidden>
          {open ? '▾' : '▸'}
        </span>
      </button>
      <div className="module__body" id={`${id}-body`} hidden={!open}>
        {children}
      </div>
    </section>
  );
}
