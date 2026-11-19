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
      className="status-bar sticky top-0 z-(--z-topbar) flex items-center justify-between px-[var(--space-gutter)] py-1.5 pt-[calc(env(safe-area-inset-top,0px)+6px)] bg-secondary-950 border-b border-primary-subtle text-xs leading-ratio-tight tracking-md text-(color:--color-accent) [font-variant-numeric:tabular-nums]"
      aria-hidden="true"
    >
      <div className="flex items-center gap-2">
        <span className="text-(color:--color-accent) font-bold">{time}</span>
        <span className="text-tertiary-50 opacity-85">DEV_OS</span>
      </div>
      <div className="inline-flex items-center gap-1.5" aria-hidden>
        <span className="inline-flex items-end gap-0.5">
          <i className="meter-fill block w-[3px] bg-(color:--color-accent)" style={{ height: 4 }} />
          <i className="meter-fill block w-[3px] bg-(color:--color-accent)" style={{ height: 7 }} />
          <i
            className="meter-fill block w-[3px] bg-(color:--color-accent)"
            style={{ height: 10 }}
          />
          <i
            className="meter-dim block w-[3px] bg-(color:--color-accent) opacity-50"
            style={{ height: 13 }}
          />
        </span>
        <span className="text-(color:--color-accent) tracking-xl">5G</span>
        <span
          className="inline-flex items-center gap-[3px] text-(color:--color-accent) font-bold"
          aria-hidden
        >
          <span>78%</span>
          <span className="status-battery inline-block w-[22px] h-[11px] border border-(color:--color-accent) p-px relative after:content-[''] after:absolute after:right-[-3px] after:top-[2px] after:w-[2px] after:h-[5px] after:bg-(color:--color-accent)">
            <i className="meter-fill block h-full bg-(color:--color-accent) w-[78%]" />
          </span>
        </span>
      </div>
    </div>
  );
}
