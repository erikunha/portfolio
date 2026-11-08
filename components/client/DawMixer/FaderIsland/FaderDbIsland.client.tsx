'use client';

import { useCallback, useRef } from 'react';
import { FaderIsland } from './FaderIsland.client';
import { pctToDb } from './pct-to-db';

export { pctToDb } from './pct-to-db';

interface FaderDbProps {
  decibelUnit: string;
  loudnessLabel: string;
  peakLabel: string;
  initialPct: number;
  channelName: string;
  faderLabel: string;
  footer?: { lufs: string; pk: string } | undefined;
}

export function FaderDbIsland({
  decibelUnit,
  loudnessLabel,
  peakLabel,
  initialPct,
  channelName,
  faderLabel,
  footer,
}: FaderDbProps) {
  const dbRef = useRef<HTMLSpanElement>(null);

  const handlePctChange = useCallback((newPct: number) => {
    if (dbRef.current) {
      dbRef.current.textContent = pctToDb(newPct);
    }
  }, []);

  const handleAriaValueText = useCallback(
    (pct: number) => `${pctToDb(pct)} ${decibelUnit}`,
    [decibelUnit],
  );

  return (
    <>
      <div className="p-0">
        <FaderIsland
          initialPct={initialPct}
          channelName={channelName}
          label={faderLabel}
          onPctChange={handlePctChange}
          onAriaValueText={handleAriaValueText}
        />
      </div>
      <div className="flex flex-col items-end tabular-nums tracking-[0.04em] leading-[1.1] text-xs max-md:text-sm text-primary-400 text-right">
        <span ref={dbRef} className="dbValue">
          {pctToDb(initialPct)}
        </span>
        <span className="dbUnit">{decibelUnit}</span>
        {footer && (
          <span className="lufs">
            {loudnessLabel} {footer.lufs} · {peakLabel} {footer.pk}
          </span>
        )}
      </div>
    </>
  );
}
