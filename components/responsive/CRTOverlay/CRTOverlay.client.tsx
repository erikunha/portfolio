'use client';

import { useEffect } from 'react';
import { applyMotion, readMotion } from '@/lib/motion';

export function CRTOverlay() {
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const handler = () => applyMotion(readMotion());
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  return (
    <>
      <div className="crt-vignette" data-testid="crt-vignette" aria-hidden />
      <div className="crt-scanlines" data-testid="crt-overlay" aria-hidden />
      <div className="crt-mask" data-testid="crt-mask" aria-hidden />
      <div className="crt-noise" data-testid="crt-noise" aria-hidden />
      <div className="crt-flicker" data-testid="crt-flicker" aria-hidden />
      <div className="crt-scan-beam" data-testid="crt-scan-beam" aria-hidden />
    </>
  );
}
