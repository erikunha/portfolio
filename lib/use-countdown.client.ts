'use client';

import { useEffect, useRef, useState } from 'react';

export function useCountdown({
  until,
  stepMs,
  onElapsed,
}: {
  until: number | null;
  stepMs: number;
  onElapsed: () => void;
}): number {
  const [clock, setClock] = useState(() => ({ until, now: Date.now() }));
  const elapsed = useRef(onElapsed);

  if (clock.until !== until) setClock({ until, now: Date.now() });

  useEffect(() => {
    elapsed.current = onElapsed;
  });

  // biome-ignore lint/correctness/useExhaustiveDependencies: each tick of the clock re-arms the timer for the next step
  useEffect(() => {
    if (until === null) return;
    const remaining = until - Date.now();
    if (remaining <= 0) {
      elapsed.current();
      return;
    }
    const timer = setTimeout(
      () => setClock({ until, now: Date.now() }),
      remaining % stepMs || stepMs,
    );
    return () => clearTimeout(timer);
  }, [until, stepMs, clock]);

  return clock.now;
}
