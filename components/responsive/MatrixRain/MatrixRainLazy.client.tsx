'use client';

import dynamic from 'next/dynamic';

export const MatrixRainLazy = dynamic(
  () => import('./MatrixRain.client').then((m) => ({ default: m.MatrixRain })),
  { ssr: false },
);
