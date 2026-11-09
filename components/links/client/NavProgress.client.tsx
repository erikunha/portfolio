'use client';

import { useEffect, useState } from 'react';
import { readMotion } from '@/lib/motion';

const RUN_MS = 300;
const OUTBOUND_SELECTOR = 'a[data-outbound]';

export function NavProgress() {
  const [running, setRunning] = useState(false);

  useEffect(() => {
    let timerId: ReturnType<typeof setTimeout> | undefined;

    function onClick(event: MouseEvent) {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (!target.closest(OUTBOUND_SELECTOR)) return;
      if (!readMotion()) return;
      clearTimeout(timerId);
      setRunning(true);
      timerId = setTimeout(() => setRunning(false), RUN_MS);
    }

    document.addEventListener('click', onClick);
    return () => {
      clearTimeout(timerId);
      document.removeEventListener('click', onClick);
    };
  }, []);

  return <div className="links-progress" data-running={running} aria-hidden="true" />;
}
