'use client';

import { useEffect, useState } from 'react';
import { HERO_SYSFAIL_HIDE, HERO_SYSFAIL_SHOW } from '@/lib/events';

export function HeroSystemFailure({ plate }: { plate: string }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onShow = () => setVisible(true);
    const onHide = () => setVisible(false);

    window.addEventListener(HERO_SYSFAIL_SHOW, onShow);
    window.addEventListener(HERO_SYSFAIL_HIDE, onHide);
    return () => {
      window.removeEventListener(HERO_SYSFAIL_SHOW, onShow);
      window.removeEventListener(HERO_SYSFAIL_HIDE, onHide);
    };
  }, []);

  return (
    <div
      className={`hero-sysfail${visible ? ' hero-sysfail-on' : ''}`}
      aria-hidden="true"
      aria-live="off"
    >
      <div className="sysfail-plate">{plate}</div>
    </div>
  );
}
