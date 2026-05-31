'use client';

import { useState } from 'react';
import { cn } from '@/lib/cn';

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
    <div className="rms-buttons flex gap-[3px]">
      {buttons.map((btn) => (
        <button
          key={btn}
          type="button"
          aria-label={`${channelName} ${BUTTON_LABELS[btn] ?? btn}`}
          aria-pressed={active.has(btn) ? 'true' : 'false'}
          onClick={() => toggle(btn)}
          className={cn(
            'min-w-[24px] min-h-[24px] px-[6px] font-mono text-xs font-bold flex items-center justify-center cursor-pointer tracking-[0.02em] shrink-0',
            'focus-visible:outline-2 focus-visible:outline-signal focus-visible:outline-offset-2',
            active.has(btn)
              ? [
                  'rms-active',
                  'border border-signal text-signal',
                  'bg-[color-mix(in_srgb,var(--color-signal)_10%,transparent)]',
                  'shadow-[0_0_5px_color-mix(in_srgb,var(--color-signal)_35%,transparent)]',
                ].join(' ')
              : 'rms-inactive border border-[var(--color-signal-quiet)] bg-transparent text-text-muted',
          )}
        >
          {btn}
        </button>
      ))}
    </div>
  );
}
