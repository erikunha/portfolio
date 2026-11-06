'use client';

import { useSyncExternalStore } from 'react';
import { offlineNotice } from '@/content/offline';
import type { SiteLocale } from '@/content/site-locale';

const CONNECTION_EVENTS = ['online', 'offline'] as const;

function subscribe(notify: () => void): () => void {
  for (const type of CONNECTION_EVENTS) window.addEventListener(type, notify);
  return () => {
    for (const type of CONNECTION_EVENTS) window.removeEventListener(type, notify);
  };
}

const isOffline = () => !navigator.onLine;
const isOfflineOnServer = () => false;

export function OfflineNotice({ locale }: { locale: SiteLocale }) {
  const offline = useSyncExternalStore(subscribe, isOffline, isOfflineOnServer);
  const copy = offlineNotice[locale];
  return (
    <div role="status" className="offline-notice">
      {offline && (
        <>
          <span className="offline-notice-badge">{copy.badge}</span>
          <span className="offline-notice-message">{copy.message}</span>
        </>
      )}
    </div>
  );
}
