'use client';

import { useSyncExternalStore } from 'react';
import { MOBILE_QUERY } from '@/lib/media-queries';
import { ErrorBoundary } from '../../ErrorBoundary';
import { MatrixRainLazy } from '../../responsive/MatrixRain';
import { TypeReveal } from '../TypeReveal';

const RAIN_MOBILE = { fontSize: 14, speed: 0.6, opacity: 0.22 } as const;
const RAIN_DESKTOP = { fontSize: 16, speed: 0.7, opacity: 0.28 } as const;
const RAIN_LAYER = 0;

function subscribeMobile(onChange: () => void) {
  const query = window.matchMedia(MOBILE_QUERY);
  query.addEventListener('change', onChange);
  return () => query.removeEventListener('change', onChange);
}

const readMobile = () => window.matchMedia(MOBILE_QUERY).matches;
const readMobileOnServer = () => false;

export function GlobalMotion() {
  const isMobile = useSyncExternalStore(subscribeMobile, readMobile, readMobileOnServer);

  const rain = isMobile ? RAIN_MOBILE : RAIN_DESKTOP;

  return (
    <>
      <ErrorBoundary fallback={null}>
        <MatrixRainLazy
          fontSize={rain.fontSize}
          speed={rain.speed}
          style={{
            position: 'fixed',
            inset: 0,
            pointerEvents: 'none',
            zIndex: RAIN_LAYER,
            opacity: rain.opacity,
          }}
        />
      </ErrorBoundary>
      <TypeReveal />
    </>
  );
}
