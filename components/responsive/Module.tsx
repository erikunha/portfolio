// components/responsive/Module.tsx
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
import styles from './Module.module.css';

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
  children: ReactNode;
};

export function Module({ id, header, mobileHeader, icon, defer = false, children }: ModuleProps) {
  return (
    <details
      id={id}
      className={defer ? `${styles.root} ${styles.cvDefer}` : styles.root}
      // Always open: see the file header. A section can still be collapsed by
      // tapping its summary on mobile.
      open
    >
      <summary className={styles.toggle}>
        <h2 className={styles.header}>
          {icon ? (
            <span className={styles.icon} aria-hidden>
              {icon}
            </span>
          ) : null}
          <span className={`${styles.label} ${styles.labelDesktop}`}>{header}</span>
          <span className={`${styles.label} ${styles.labelMobile}`}>{mobileHeader ?? header}</span>
        </h2>
        <span className={styles.chevron} aria-hidden>
          ▸
        </span>
      </summary>
      <div className={styles.body} id={`${id}-body`}>
        {children}
      </div>
    </details>
  );
}
