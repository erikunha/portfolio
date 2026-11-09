'use client';

import { useBreakpoint } from '@/lib/use-breakpoint.client';
import { ErrorBoundary } from '../../ErrorBoundary';
import { MatrixRainLazy } from '../../responsive/MatrixRain';
import { RAIN_DESKTOP_PROFILE, RAIN_MOBILE_PROFILE } from '../../responsive/MatrixRain/rain-tokens';
import { TypeReveal } from '../TypeReveal';

export function GlobalMotion() {
  const { isMobile } = useBreakpoint();

  const rain = isMobile ? RAIN_MOBILE_PROFILE : RAIN_DESKTOP_PROFILE;

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
            zIndex: 'var(--z-rain)',
            opacity: rain.opacity,
          }}
        />
      </ErrorBoundary>
      <TypeReveal />
    </>
  );
}
