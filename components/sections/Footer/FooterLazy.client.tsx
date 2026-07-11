'use client';

import dynamic from 'next/dynamic';
import { useEffect, useRef, useState } from 'react';

const Footer = dynamic(() => import('./Footer.client').then((m) => ({ default: m.Footer })), {
  ssr: false,
});

const MOUNT_ROOT_MARGIN = '400px';
const SENTINEL_MIN_HEIGHT = '400px';

export function FooterLazy() {
  const sentinelRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    if (mounted) return;
    const node = sentinelRef.current;
    if (!node) return;
    if (typeof IntersectionObserver === 'undefined') {
      setMounted(true);
      return;
    }
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setMounted(true);
          obs.disconnect();
        }
      },
      { rootMargin: MOUNT_ROOT_MARGIN },
    );
    obs.observe(node);
    return () => obs.disconnect();
  }, [mounted]);

  if (mounted) return <Footer />;
  return (
    <div
      ref={sentinelRef}
      aria-hidden="true"
      style={{ minHeight: SENTINEL_MIN_HEIGHT }}
      data-testid="footer-lazy-sentinel"
    />
  );
}
