'use client';

import { useState } from 'react';
import { useVisibleInterval } from '@/lib/use-visible-interval.client';

const CLOCK_STEP_MS = 15_000;

function pad(n: number) {
  return String(n).padStart(2, '0');
}

function fmtClock(d: Date) {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function StatusBar() {
  const [time, setTime] = useState('');

  useVisibleInterval(() => setTime(fmtClock(new Date())), CLOCK_STEP_MS);

  return (
    <div
      className="status-bar sticky top-0 z-(--z-topbar) flex items-center justify-between px-[var(--space-gutter)] py-1.5 pt-[calc(env(safe-area-inset-top,0px)+6px)] bg-(color:--color-surface) border-b border-(color:--color-border-strong) text-xs leading-ratio-tight tracking-md text-(color:--color-accent) [font-variant-numeric:tabular-nums]"
      aria-hidden="true"
    >
      <div className="flex items-center gap-2">
        <span className="text-(color:--color-accent) font-bold">{time}</span>
        <span className="text-(color:--color-text) opacity-85">DEV_OS</span>
      </div>
      <div className="inline-flex items-center gap-1.5" aria-hidden>
        <span className="inline-flex items-end gap-0.5">
          <i className="meter-fill status-signal-bar" style={{ height: 4 }} />
          <i className="meter-fill status-signal-bar" style={{ height: 7 }} />
          <i className="meter-fill status-signal-bar" style={{ height: 10 }} />
          <i className="meter-dim status-signal-bar status-signal-bar-dim" style={{ height: 13 }} />
        </span>
        <span className="text-(color:--color-accent) tracking-xl">5G</span>
        <span
          className="inline-flex items-center gap-[3px] text-(color:--color-accent) font-bold"
          aria-hidden
        >
          <span>78%</span>
          <span className="status-battery">
            <i className="meter-fill status-battery-fill w-[78%]" />
          </span>
        </span>
      </div>
    </div>
  );
}
