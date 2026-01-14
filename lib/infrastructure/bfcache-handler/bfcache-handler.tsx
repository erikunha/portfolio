'use client';

import { useEffect } from 'react';
import { logger } from '../../logger';

/**
 * Browser Back/Forward Cache (bfcache) Optimization
 * Ensures app works correctly when restored from bfcache
 */
export function BfcacheHandler() {
  useEffect(() => {
    // Detect bfcache restore
    const handlePageShow = (event: PageTransitionEvent) => {
      if (event.persisted) {
        logger.info('Page restored from bfcache', {
          component: 'BfcacheHandler',
        });

        // Refresh dynamic content or state if needed
        // For example, you might want to:
        // - Revalidate data
        // - Restart timers
        // - Update timestamps
        // - Reconnect websockets

        // Mark as restored for other components to react
        document.body.dataset['bfcacheRestored'] = 'true';
      }
    };

    // Listen for pageshow event
    window.addEventListener('pageshow', handlePageShow);

    return () => {
      window.removeEventListener('pageshow', handlePageShow);
    };
  }, []);

  return null;
}
