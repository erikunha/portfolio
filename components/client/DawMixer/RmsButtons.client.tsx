'use client';

import { useState } from 'react';
import s from './DawMixer.module.css';

interface RmsButtonsProps {
  buttons: string[];
  initialActive: string[];
}

export function RmsButtons({ buttons, initialActive }: RmsButtonsProps) {
  const [active, setActive] = useState<Set<string>>(() => new Set(initialActive));

  const toggle = (btn: string) => {
    setActive((prev) => {
      const next = new Set(prev);
      if (next.has(btn)) next.delete(btn);
      else next.add(btn);
      return next;
    });
  };

  return (
    <div className={s.rmsButtons}>
      {buttons.map((btn) => (
        <button
          key={btn}
          type="button"
          aria-pressed={active.has(btn) ? 'true' : 'false'}
          className={active.has(btn) ? s.rmsActive : s.rmsInactive}
          onClick={() => toggle(btn)}
        >
          {btn}
        </button>
      ))}
    </div>
  );
}
