'use client';

import { useCallback, useRef } from 'react';
import s from '@/components/sections/DawMixerSection/DawMixerSection.module.css';
import { FaderIsland } from './FaderIsland.client';
import { pctToDb } from './pct-to-db';

export { pctToDb } from './pct-to-db';

interface FaderDbProps {
  initialPct: number;
  channelName: string;
  footer?: { lufs: string; pk: string } | undefined;
}

export function FaderDbIsland({ initialPct, channelName, footer }: FaderDbProps) {
  const dbRef = useRef<HTMLSpanElement>(null);

  const handlePctChange = useCallback((newPct: number) => {
    if (dbRef.current) {
      dbRef.current.textContent = pctToDb(newPct);
    }
  }, []);

  const handleAriaValueText = useCallback((pct: number) => `${pctToDb(pct)} dB`, []);

  return (
    <>
      <div className={s.colFader}>
        <FaderIsland
          initialPct={initialPct}
          channelName={channelName}
          onPctChange={handlePctChange}
          onAriaValueText={handleAriaValueText}
        />
      </div>
      <div className={s.colDb}>
        <span ref={dbRef} className={s.dbValue}>
          {pctToDb(initialPct)}
        </span>
        <span className={s.dbUnit}>dB</span>
        {footer && (
          <span className={s.lufs}>
            LUFS {footer.lufs} · PK {footer.pk}
          </span>
        )}
      </div>
    </>
  );
}
