'use client';

import { useEffect, useState } from 'react';

// The SYSTEM FAILURE headline overlay, extracted from Hero.tsx DesktopHero.
// Listens for 'hero:sysfail:show' and 'hero:sysfail:hide' window events
// dispatched by HeroBootAnimation when the first dialog loop completes.
// The existing 'sysfail:start' / 'sysfail:end' events continue to handle
// MatrixRain pause/resume (unchanged from original wiring).
//
// State-based visibility: visible prop toggles `hero-sysfail-on` class
// (defined in app/css/components.css @layer components) onto the overlay.
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
