'use client';

import { lazy, type ReactNode, useRef } from 'react';
import type { ContactContent } from '@/content/contact';
import { useInView } from '@/lib/use-in-view.client';
import { LazyIsland } from '../LazyIsland';

const PRELOAD_MARGIN_PX = 400;

const ContactTimezone = lazy(() =>
  import('./ContactTimezone.client').then((module) => ({ default: module.ContactTimezone })),
);

export function ContactTimezoneLazy({
  children,
  copy,
}: {
  children: ReactNode;
  copy: ContactContent['timezone'];
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const near = useInView(hostRef, { rootMargin: `${PRELOAD_MARGIN_PX}px`, once: true });

  return (
    <div className="ctz-host" ref={hostRef}>
      {near ? (
        <LazyIsland
          loading={children}
          failed={
            <div className="ctz-failed" data-testid="ctz-failed">
              {children}
            </div>
          }
        >
          <ContactTimezone copy={copy} />
        </LazyIsland>
      ) : (
        children
      )}
    </div>
  );
}
