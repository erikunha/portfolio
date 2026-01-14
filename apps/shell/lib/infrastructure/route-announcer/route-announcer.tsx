'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import styles from './route-announcer.module.css';

/**
 * Route Announcer Component
 * Announces route changes to screen readers for accessibility
 */
export function RouteAnnouncer() {
  const pathname = usePathname();
  const [announcement, setAnnouncement] = useState('');

  useEffect(() => {
    // Get page title or generate from pathname
    const pageTitle = document.title || pathname.replace(/\//g, ' ').trim();

    // Announce navigation
    setAnnouncement(`Navigated to ${pageTitle}`);

    // Clear announcement after announcement is read
    const timer = setTimeout(() => setAnnouncement(''), 1000);

    return () => clearTimeout(timer);
  }, [pathname]);

  return (
    <div
      className={styles['route-announcer']}
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      {announcement}
    </div>
  );
}
