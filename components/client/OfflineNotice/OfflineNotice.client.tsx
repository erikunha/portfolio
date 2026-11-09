'use client';

import { useSyncExternalStore } from 'react';
import type { OfflineNotice as OfflineNoticeCopy } from '@/content/shell-states.schema';

const CONNECTION_EVENTS = ['online', 'offline'] as const;

function subscribe(notify: () => void): () => void {
  for (const type of CONNECTION_EVENTS) window.addEventListener(type, notify);
  return () => {
    for (const type of CONNECTION_EVENTS) window.removeEventListener(type, notify);
  };
}

const isOffline = () => !navigator.onLine;
const isOfflineOnServer = () => false;

export function OfflineNotice({ copy }: { copy: OfflineNoticeCopy }) {
  const offline = useSyncExternalStore(subscribe, isOffline, isOfflineOnServer);
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
