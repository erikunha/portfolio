'use client';

import { useEffect } from 'react';
import { startVitalsReporting } from '@/lib/vitals/report.client';

export function VitalsReporter(): null {
  useEffect(startVitalsReporting, []);
  return null;
}
