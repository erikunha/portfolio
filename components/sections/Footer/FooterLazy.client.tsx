'use client';

// components/sections/Footer/FooterLazy.client.tsx
//
// IntersectionObserver-gated lazy mount of <Footer>. PR 6 of audit roadmap.
//
// Why: the audit (Theme 4) flagged Footer as silently consuming the 43KB
// client-JS budget below the fold. Footer carries 5 useState, 5 useEffect,
// a MatrixRain canvas, a setInterval clock, and a scroll listener — all
// hydrating immediately on page load even though most visitors never scroll
// past the 18 sections above it.
//
// dynamic({ ssr: false }) alone would skip SSR but still ship + hydrate
// Footer on the critical path. The IntersectionObserver sentinel below it
// delays hydration until the viewport approaches the footer position
// (rootMargin: 400px buffer for smooth pre-mount). Result: zero Footer
// runtime cost for visitors who don't scroll, and a hydration that races
// against scroll-stop instead of initial paint for those who do.
//
// Layout: the sentinel claims `min-height: 400px` so the page total
// height doesn't change when Footer mounts. Footer's actual rendered
// height is taller, but it sits at the bottom of the page so any height
// delta affects only document scroll-end (no above-the-fold CLS).

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
    // Defensive: IntersectionObserver is a browser API. Guard for vitest
    // jsdom envs that don't ship it (it does, but better safe than crash).
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
