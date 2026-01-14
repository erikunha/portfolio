'use client';

import { useEffect } from 'react';
import { initWebVitals } from '../../../lib/web-vitals';

/**
 * Web Vitals Tracker Component
 * Add this to your root layout to start tracking Core Web Vitals
 */
export function WebVitalsTracker() {
  useEffect(() => {
    initWebVitals();
  }, []);

  return null; // This component doesn't render anything
}
