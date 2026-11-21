'use client';

import { useEffect, useRef } from 'react';

export function useVisibleInterval(callback: () => void, delayMs: number): void {
  const latest = useRef(callback);

  useEffect(() => {
    latest.current = callback;
  });

  useEffect(() => {
    let id: ReturnType<typeof setInterval> | null = null;

    const stop = () => {
      if (id === null) return;
      clearInterval(id);
      id = null;
    };
    const start = () => {
      stop();
      latest.current();
      id = setInterval(() => latest.current(), delayMs);
    };
    const onVisibility = () => {
      if (document.hidden) stop();
      else start();
    };

    start();
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      stop();
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [delayMs]);
}
