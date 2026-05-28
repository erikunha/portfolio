'use client';

import { useState } from 'react';
import s from './RmsButtons.module.css';

const BUTTON_LABELS: Record<string, string> = {
  R: 'record arm',
  M: 'mute',
  S: 'solo',
};

interface RmsButtonsProps {
  buttons: string[];
  initialActive: string[];
  channelName: string;
}

export function RmsButtons({ buttons, initialActive, channelName }: RmsButtonsProps) {
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
          aria-label={`${channelName} ${BUTTON_LABELS[btn] ?? btn}`}
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
