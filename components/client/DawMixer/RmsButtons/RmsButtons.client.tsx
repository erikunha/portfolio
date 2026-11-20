'use client';

import { useState } from 'react';

interface RmsButtonsProps {
  buttons: string[];
  initialActive: string[];
  channelName: string;
  buttonLabels: Readonly<Record<string, string>>;
}

export function RmsButtons({ buttons, initialActive, channelName, buttonLabels }: RmsButtonsProps) {
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
    <div className="rms-buttons flex gap-tight">
      {buttons.map((btn) => (
        <button
          key={btn}
          type="button"
          aria-label={`${channelName} ${buttonLabels[btn] ?? btn}`}
          aria-pressed={active.has(btn) ? 'true' : 'false'}
          onClick={() => toggle(btn)}
          className="btn rms-btn"
          data-variant="toggle"
        >
          {btn}
        </button>
      ))}
    </div>
  );
}
