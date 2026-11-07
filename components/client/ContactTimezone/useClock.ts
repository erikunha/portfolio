'use client';

import { type RefObject, useEffect, useState } from 'react';

const VIEWPORT_ROOT_MARGIN = '0px';

export function useNow(active: boolean, stepMs: number): Date {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    if (!active) return undefined;
    setNow(new Date());
    let timer: ReturnType<typeof setTimeout>;
    const schedule = () => {
      timer = setTimeout(
        () => {
          setNow(new Date());
          schedule();
        },
        stepMs - (Date.now() % stepMs),
      );
    };
    schedule();
    return () => clearTimeout(timer);
  }, [active, stepMs]);

  return now;
}

export function usePanelActive(ref: RefObject<Element | null>): boolean {
  const [inView, setInView] = useState(false);
  const [tabVisible, setTabVisible] = useState(() => document.visibilityState !== 'hidden');

  useEffect(() => {
    const node = ref.current;
    if (!node || typeof IntersectionObserver === 'undefined') {
      setInView(true);
      return undefined;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        const latest = entries[entries.length - 1];
        if (latest) setInView(latest.isIntersecting);
      },
      { rootMargin: VIEWPORT_ROOT_MARGIN },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [ref]);

  useEffect(() => {
    const sync = () => setTabVisible(document.visibilityState !== 'hidden');
    document.addEventListener('visibilitychange', sync);
    return () => document.removeEventListener('visibilitychange', sync);
  }, []);

  return inView && tabVisible;
}
