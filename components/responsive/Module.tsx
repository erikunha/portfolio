// components/responsive/Module.tsx
// Pure Server Component. No 'use client' boundary, no React state, no event
// listeners, no useBreakpoint hook. Saves ~18 client-component hydrations
// (one per section) at the cost of native <details> on mobile instead of a
// custom toggle. The 'module:open' event from Dock is handled by a single
// delegated listener in AppShell.client.tsx that flips the open attribute.
//
// ONE element for every viewport. The page is `force-static`, so the server
// has no per-request UA context — picking <section> vs <details> by UA
// detection always resolved to desktop and mobile visitors never got the
// collapsible chrome. Module wraps ~18 sections; rendering both variants
// would duplicate every section's subtree (~2500+ DOM nodes) and blow the
// dom-size budget. So Module always renders a native <details> and CSS
// neutralizes its collapsibility on desktop: at >= 769px the body is forced
// visible and the chevron hidden, so the <summary> reads as a plain <h2>
// section header — visually and behaviorally identical to the old desktop
// <section>. Mobile (<= 768px) keeps the real collapsible <details>.

import type { ReactNode } from 'react';

export type ModuleProps = {
  id: string;
  header: string;
  /**
   * Shorter header shown on mobile. With a single static element the header
   * text can't be branched by viewport at render time, so both labels are
   * emitted and CSS toggles them at the 768px breakpoint (same pattern the
   * four leaf sections use for their body variants). Falls back to `header`.
   */
  mobileHeader?: string;
  icon?: ReactNode;
  defaultOpen?: boolean;
  /** Applies content-visibility:auto deferral for below-fold modules. */
  defer?: boolean | undefined;
  children: ReactNode;
};

export function Module({
  id,
  header,
  mobileHeader,
  icon,
  defaultOpen = true,
  defer = false,
  children,
}: ModuleProps) {
  return (
    <details
      id={id}
      className={`module${defer ? ' cv-defer' : ''}`}
      // Desktop visibility is forced by CSS regardless of [open]; the attribute
      // exists for the mobile native semantics — mobile honors defaultOpen.
      open={defaultOpen || undefined}
    >
      <summary className="module__toggle">
        <h2 className="module__header">
          {icon ? (
            <span className="module__icon" aria-hidden>
              {icon}
            </span>
          ) : null}
          <span className="module__label module__label--desktop">{header}</span>
          <span className="module__label module__label--mobile">{mobileHeader ?? header}</span>
        </h2>
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
