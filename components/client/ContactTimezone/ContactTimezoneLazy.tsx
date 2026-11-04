'use client';

import { lazy, type ReactNode, Suspense, useEffect, useRef, useState } from 'react';
import type { ContactContent } from '@/content/contact';
import { ErrorBoundary } from '../../ErrorBoundary';

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
  const [near, setNear] = useState(false);

  useEffect(() => {
    const host = hostRef.current;
    if (!host || typeof IntersectionObserver === 'undefined') {
      setNear(true);
      return undefined;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setNear(true);
          observer.disconnect();
        }
      },
      { rootMargin: `${PRELOAD_MARGIN_PX}px` },
    );
    observer.observe(host);
    return () => observer.disconnect();
  }, []);

  return (
    <div className="ctz-host" ref={hostRef}>
      {near ? (
        <ErrorBoundary fallback={children}>
          <Suspense fallback={children}>
            <ContactTimezone copy={copy} />
          </Suspense>
        </ErrorBoundary>
      ) : (
        children
      )}
    </div>
  );
}
