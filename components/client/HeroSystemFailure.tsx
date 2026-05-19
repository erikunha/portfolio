'use client';

import { useEffect, useRef } from 'react';

// The SYSTEM FAILURE headline overlay, extracted from Hero.tsx DesktopHero.
// Listens for 'hero:sysfail:show' and 'hero:sysfail:hide' window events
// dispatched by HeroBootAnimation when the first dialog loop completes.
// The existing 'sysfail:start' / 'sysfail:end' events continue to handle
// MatrixRain pause/resume (unchanged from original wiring).
export function HeroSystemFailure() {
  const sysfailRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = sysfailRef.current;
    if (!el) return;

    const onShow = () => el.classList.add('on');
    const onHide = () => el.classList.remove('on');

    window.addEventListener('hero:sysfail:show', onShow);
    window.addEventListener('hero:sysfail:hide', onHide);
    return () => {
      window.removeEventListener('hero:sysfail:show', onShow);
      window.removeEventListener('hero:sysfail:hide', onHide);
    };
  }, []);

  return (
    <div ref={sysfailRef} className="hero__headline" aria-hidden="true" aria-live="off">
      <div className="hero__headline-plate">SYSTEM FAILURE</div>
    </div>
  );
}
