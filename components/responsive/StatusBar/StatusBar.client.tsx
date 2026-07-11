'use client';

import { useEffect, useState } from 'react';

function pad(n: number) {
  return String(n).padStart(2, '0');
}

function fmtClock(d: Date) {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function StatusBar() {
  const [time, setTime] = useState('');

  useEffect(() => {
    let id: ReturnType<typeof setInterval> | null = null;

    function startClock() {
      setTime(fmtClock(new Date()));
      id = setInterval(() => setTime(fmtClock(new Date())), 15_000);
    }

    function onVisibility() {
      if (document.hidden) {
        if (id !== null) {
          clearInterval(id);
          id = null;
        }
      } else {
        startClock();
      }
    }

    startClock();
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      if (id !== null) clearInterval(id);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  return (
    <div
      className="status-bar sticky top-0 z-[110] flex items-center justify-between px-[14px] py-1.5 pt-[calc(env(safe-area-inset-top,0px)+6px)] bg-secondary-950 border-b border-primary-subtle text-xs tracking-[0.06em] text-primary-500 [font-variant-numeric:tabular-nums]"
      role="status"
      aria-label="device status"
    >
      <div className="flex items-center gap-2">
        <span className="text-primary-500 text-[12px] font-bold" suppressHydrationWarning>
          {time}
        </span>
        <span className="text-tertiary-50 opacity-85">DEV_OS</span>
      </div>
      <div className="inline-flex items-center gap-1.5" aria-hidden>
        <span className="inline-flex items-end gap-0.5">
          <i className="block w-[3px] bg-primary-500" style={{ height: 4 }} />
          <i className="block w-[3px] bg-primary-500" style={{ height: 7 }} />
          <i className="block w-[3px] bg-primary-500" style={{ height: 10 }} />
          <i className="block w-[3px] bg-primary-500 opacity-50" style={{ height: 13 }} />
        </span>
        <span className="text-primary-500 text-xs tracking-[0.1em]">5G</span>
        <span className="inline-flex items-center gap-[3px] text-primary-500 font-bold" aria-hidden>
          <span className="text-xs">78%</span>
          <span className="inline-block w-[22px] h-[11px] border border-primary-500 p-px relative after:content-[''] after:absolute after:right-[-3px] after:top-[2px] after:w-[2px] after:h-[5px] after:bg-primary-500">
            <i className="block h-full bg-primary-500 w-[78%]" />
          </span>
        </span>
      </div>
    </div>
  );
}
