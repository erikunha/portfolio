'use client';

import { useEffect, useState } from 'react';
import { ErrorBoundary } from '../../ErrorBoundary';
import { MatrixRainLazy } from '../../responsive/MatrixRain';
import { TypeReveal } from '../TypeReveal';

const MOBILE_QUERY = '(max-width: 767.98px)';
const RAIN_MOBILE = { fontSize: 14, speed: 0.6, opacity: 0.22 } as const;
const RAIN_DESKTOP = { fontSize: 16, speed: 0.7, opacity: 0.28 } as const;
const RAIN_LAYER = 0;

export function GlobalMotion() {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const query = window.matchMedia(MOBILE_QUERY);
    const sync = () => setIsMobile(query.matches);
    sync();
    query.addEventListener('change', sync);
    return () => query.removeEventListener('change', sync);
  }, []);

  const rain = isMobile ? RAIN_MOBILE : RAIN_DESKTOP;

  return (
    <>
      <ErrorBoundary>
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
