'use client';

import { useState } from 'react';
import { cn } from '@/lib/cn';

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
    <div className="rms-buttons flex gap-[3px]">
      {buttons.map((btn) => (
        <button
          key={btn}
          type="button"
          aria-label={`${channelName} ${buttonLabels[btn] ?? btn}`}
          aria-pressed={active.has(btn) ? 'true' : 'false'}
          onClick={() => toggle(btn)}
          className={cn(
            'rms-btn px-[6px] font-mono text-xs font-bold flex items-center justify-center cursor-pointer tracking-[0.02em] shrink-0',
            active.has(btn)
              ? [
                  'rms-active',
                  'border border-primary-500 text-primary-500',
                  'bg-[color-mix(in_srgb,var(--color-primary-500)_10%,transparent)]',
                  'shadow-[0_0_5px_color-mix(in_srgb,var(--color-primary-500)_35%,transparent)]',
                ].join(' ')
              : 'rms-inactive border border-[var(--color-primary-quiet)] bg-transparent text-primary-400',
          )}
        >
          {btn}
        </button>
      ))}
    </div>
  );
}
