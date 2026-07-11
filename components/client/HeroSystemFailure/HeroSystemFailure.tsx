'use client';

import { useEffect, useState } from 'react';

export function HeroSystemFailure() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onShow = () => setVisible(true);
    const onHide = () => setVisible(false);

    window.addEventListener('hero:sysfail:show', onShow);
    window.addEventListener('hero:sysfail:hide', onHide);
    return () => {
      window.removeEventListener('hero:sysfail:show', onShow);
      window.removeEventListener('hero:sysfail:hide', onHide);
    };
  }, []);

  return (
    <div
      className={`hero-sysfail${visible ? ' hero-sysfail-on' : ''}`}
      aria-hidden="true"
      aria-live="off"
    >
      <div className="sysfail-plate">SYSTEM FAILURE</div>
    </div>
  );
}
