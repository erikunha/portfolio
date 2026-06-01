// components/responsive/Module/Module.tsx
// Pure Server Component. No 'use client' boundary, no React state, no event
// listeners, no useBreakpoint hook. Saves ~18 client-component hydrations
// (one per section) at the cost of native <details> on mobile instead of a
// custom toggle. The 'module:open' event from Dock is handled by a single
// delegated listener in AppShell.client.tsx that flips the open attribute.
//
// ONE element for every viewport. Module wraps ~18 sections; rendering both a
// <section> and a <details> variant would duplicate every subtree (~2500+ DOM
// nodes) and blow the dom-size budget. So Module always renders a native
// <details open>. It must stay open: a closed <details> cannot be reopened by
// CSS (browsers gate the collapse via the ::details-content pseudo-element,
// which the Lightning CSS build strips). Desktop CSS (>= 769px) hides the
// chevron and strips the summary toggle chrome so it reads as a plain <h2>;
// mobile keeps the chevron and a section can be collapsed by tapping its
// summary. Per-section content selects its viewport variant via an async RSC
// + Suspense boundary (getIsMobile()); Module itself is always single-element.

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
  /** Applies content-visibility:auto deferral for below-fold modules. */
  defer?: boolean | undefined;
  /**
   * "green": full rgba(0,255,65,0.05) tint — for data-heavy/interactive sections.
   * Default (omitted): transparent background — for narrative/context sections.
   */
  variant?: 'green';
  children: ReactNode;
};

export function Module({
  id,
  header,
  mobileHeader,
  icon,
  defer = false,
  variant,
  children,
}: ModuleProps) {
  return (
    <details
      id={id}
      // module-root: houses ::details-content override + [open] selectors for body/chevron/bodyContent
      // Mobile: bordered panel (border + bg-[rgba(0,0,0,0.22)] + overflow-hidden)
      // Desktop (>=769px): border/bg/overflow removed via media query in components.css
      className={[
        'module-root',
        'mb-[18px] md:mb-10',
        'border border-primary-subtle bg-[rgba(0,0,0,0.22)] md:bg-transparent overflow-hidden md:overflow-visible',
        'md:border-0',
        defer ? 'module-deferred' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      // Always open: see the file header. A section can still be collapsed by
      // tapping its summary on mobile.
      open
      {...(defer ? { 'data-cv-defer': 'true' } : {})}
    >
      {/* summary: mobile — collapsible chrome; desktop — plain section header */}
      <summary
        className={[
          // Remove native disclosure marker
          '[list-style:none] [&::-webkit-details-marker]:hidden',
          'flex items-center gap-2 w-full',
          // Mobile chrome
          'px-[14px] py-3 min-h-11 bg-glow-04 border-b border-primary-quiet cursor-pointer',
          'focus-visible:outline-2 focus-visible:outline-primary-500 focus-visible:outline-offset-2',
          // Desktop: strip mobile chrome
          'md:px-0 md:py-0 md:min-h-0 md:bg-transparent md:border-b-0 md:mb-2',
        ].join(' ')}
      >
        {/* module-chevron: handles rotate on [open], hidden on desktop via components.css */}
        <span className="module-chevron" aria-hidden>
          ▸
        </span>
        <h2 className="flex-1 flex items-center gap-2 text-primary-500 font-mono text-xs max-md:text-[10px] md:text-[12px] font-medium tracking-[0.14em] md:tracking-[0.1em] uppercase m-0">
          {icon ? (
            <span
              className="inline-flex w-5 h-5 items-center justify-center text-primary-500 [&_svg]:w-[18px] [&_svg]:h-[18px] [&_svg]:stroke-current [&_svg]:fill-none [&_svg]:[stroke-width:1.4]"
              aria-hidden
            >
              {icon}
            </span>
          ) : null}
          <span className="hidden md:inline">{header}</span>
          <span className="md:hidden">{mobileHeader ?? header}</span>
        </h2>
      </summary>
      <div className="module-body" id={`${id}-body`}>
        {/* bodyInner: grid item — no padding so 0fr collapses to true 0.
            bodyContent: padding+color wrapper inside the overflow:hidden clip. */}
        <div className="min-h-0 overflow-hidden">
          <div className="module-body-content" data-variant={variant}>
            {children}
          </div>
        </div>
      </div>
    </details>
  );
}
