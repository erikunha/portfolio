'use client';

import { useLayoutEffect, useState } from 'react';
import { applyMotion, readMotion } from '@/lib/motion';

export function DesktopTopbar() {
  const [motionOn, setMotionOn] = useState(true);

  useLayoutEffect(() => {
    if (typeof window === 'undefined') return;
    const on = readMotion();
    setMotionOn(on);
    applyMotion(on);
  }, []);

  function toggleMotion() {
    const next = !motionOn;
    setMotionOn(next);
    applyMotion(next);
  }

  return (
    <div className="topbar">
      <div className="topbar-inner">
        <div className="topbar__dots" aria-hidden="true">
          <span className="topbar__dot topbar__dot--red" />
          <span className="topbar__dot topbar__dot--yellow" />
          <span className="topbar__dot topbar__dot--green" />
        </div>
        <div className="topbar__tabs">
          <div className="topbar__tab topbar__tab--active">
            <span>&#9632;</span>
            <span>PORTFOLIO.SH</span>
            <span className="topbar__tab-close">&times;</span>
          </div>
          <div className="topbar__tab">
            <span>&#9635;</span>
            <span>PROJECTS</span>
          </div>
        </div>
        <nav className="topbar__nav" aria-label="Site navigation">
          <a className="topbar__navlink" href="#bio">
            01_BIO
          </a>
          <a className="topbar__navlink" href="#sec-projects">
            02_WORK
          </a>
          <a className="topbar__navlink" href="#sec-git-log">
            03_LOGS
          </a>
          <a className="topbar__navlink" href="#sec-npm-stack">
            04_DEPS
          </a>
          <button
            type="button"
            className="topbar__motion"
            onClick={toggleMotion}
            aria-label="Toggle motion"
            data-motion={motionOn ? 'on' : 'off'}
          >
            <span className="topbar__mdot" />
            <span>{motionOn ? 'MOTION: ON' : 'MOTION: OFF'}</span>
          </button>
          <a className="topbar__btn-outline" href="/erik-cunha-cv.pdf" download>
            DOWNLOAD_CV
          </a>
          <a
            className="topbar__btn-primary"
            href="https://www.linkedin.com/in/erikunha/"
            target="_blank"
            rel="noreferrer"
          >
            SSH_CONNECT
          </a>
        </nav>
      </div>
    </div>
  );
}
