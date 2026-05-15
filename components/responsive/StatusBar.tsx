'use client';

import { useEffect, useState } from 'react';

function pad(n: number) {
  return String(n).padStart(2, '0');
}

function fmtClock(d: Date) {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function StatusBar() {
  const [time, setTime] = useState(() => fmtClock(new Date()));

  useEffect(() => {
    setTime(fmtClock(new Date()));
    const id = setInterval(() => setTime(fmtClock(new Date())), 15_000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="statusbar" role="status" aria-label="device status">
      <div className="statusbar__left">
        <span className="statusbar__time" suppressHydrationWarning>{time}</span>
        <span className="statusbar__carrier">DEV_OS</span>
      </div>
      <div className="statusbar__right" aria-hidden>
        <span className="statusbar__signal">
          <i style={{ height: 4 }} />
          <i style={{ height: 7 }} />
          <i style={{ height: 10 }} />
          <i style={{ height: 13, opacity: 0.5 }} />
        </span>
        <span className="statusbar__cell">5G</span>
        <span className="statusbar__battery" aria-hidden>
          <span className="statusbar__battery-num">78%</span>
          <span className="statusbar__battery-box"><i /></span>
        </span>
      </div>
    </div>
  );
}
