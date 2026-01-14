'use client';

import { useEffect } from 'react';
import { logger } from '../../logger';

/**
 * Service Worker Registration Component
 * Registers SW for offline support and PWA capabilities
 */
export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (
      typeof window !== 'undefined' &&
      'serviceWorker' in navigator &&
      process.env.NODE_ENV === 'production'
    ) {
      navigator.serviceWorker
        .register('/sw.js')
        .then((registration) => {
          logger.info('Service Worker registered', {
            component: 'ServiceWorkerRegistration',
            scope: registration.scope,
          });

          // Check for updates periodically
          setInterval(
            () => {
              registration.update();
            },
            60 * 60 * 1000,
          ); // Check every hour
        })
        .catch((error) => {
          logger.error('Service Worker registration failed', error, {
            component: 'ServiceWorkerRegistration',
          });
        });
    }
  }, []);

  return null;
}
