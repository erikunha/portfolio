'use client';

import { useEffect } from 'react';
import { reportClientError } from '@/lib/report-client-error.client';

const GOVERNOR_LOAD_ERROR_PREFIX = '[CRTOverlay] frame governor failed to load:';

export function CRTOverlay() {
  useEffect(() => {
    let release: (() => void) | undefined;
    let unmounted = false;
    import('@/lib/frame-governor')
      .then(({ acquireFrameGovernor }) => {
        if (!unmounted) release = acquireFrameGovernor();
      })
      .catch((error: unknown) => {
        reportClientError(
          GOVERNOR_LOAD_ERROR_PREFIX,
          error instanceof Error ? error : new Error(String(error)),
        );
      });
    return () => {
      unmounted = true;
      release?.();
    };
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
