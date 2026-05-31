'use client';

import { useLayoutEffect, useState } from 'react';
import { WindowChrome } from '@/design-system';
import { cn } from '@/lib/cn';
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
    <div className="desktop-topbar fixed top-0 left-0 right-0 z-[110] bg-surface border-b border-signal-subtle hidden md:block">
      <div className="max-w-[1200px] mx-auto px-[14px] md:px-[18px] flex items-center gap-4 h-11">
        <WindowChrome size={12} style={{ gap: '8px' }} />
        <div className="flex gap-2 ml-2">
          <div
            className={cn(
              'inline-flex items-center gap-2 h-[26px] px-3 text-[12px] tracking-[0.05em] text-text-body border border-transparent',
              'text-signal border-signal-subtle bg-glow-04',
            )}
          >
            <span>&#9632;</span>
            <span>ERIK_CUNHA.SH</span>
            <span className="text-text-body ml-1.5 opacity-80">&times;</span>
          </div>
        </div>
        <nav
          className="ml-auto flex gap-[18px] items-center flex-nowrap"
          aria-label="Site navigation"
        >
          <a
            className="text-signal text-[12px] tracking-[0.08em] whitespace-nowrap hover:text-shadow-[0_0_8px_var(--color-signal)] hidden xl:inline"
            href="#sec-projects"
          >
            01_WORK
          </a>
          <a
            className="text-signal text-[12px] tracking-[0.08em] whitespace-nowrap hover:text-shadow-[0_0_8px_var(--color-signal)] hidden xl:inline"
            href="#sec-perf-receipts"
          >
            02_IMPACT
          </a>
          <a
            className="text-signal text-[12px] tracking-[0.08em] whitespace-nowrap hover:text-shadow-[0_0_8px_var(--color-signal)] hidden xl:inline"
            href="#sec-npm-stack"
          >
            03_DEPS
          </a>
          <a
            className="text-signal text-[12px] tracking-[0.08em] whitespace-nowrap hover:text-shadow-[0_0_8px_var(--color-signal)] hidden xl:inline"
            href="#sec-contact"
          >
            04_CONTACT
          </a>
          <a
            className="text-signal text-[12px] tracking-[0.08em] whitespace-nowrap hover:text-shadow-[0_0_8px_var(--color-signal)] hidden xl:inline"
            href="/design-system"
          >
            DESIGN_SYSTEM
          </a>
          <button
            type="button"
            className={cn(
              'inline-flex items-center gap-1.5 text-text-muted text-[12px] tracking-[0.08em]',
              'border border-signal-subtle px-[14px] py-1.5 cursor-pointer bg-transparent whitespace-nowrap',
              'transition-[box-shadow,background,border-color] duration-200 ease-out',
              'hover:shadow-[0_0_12px_var(--color-signal)] hover:bg-signal-quiet hover:border-signal',
              'hidden xl:inline-flex',
              'motion-reduce:transition-none [body[data-motion=reduce]_&]:transition-none',
            )}
            onClick={toggleMotion}
            data-motion={motionOn ? 'on' : 'off'}
            aria-pressed={motionOn}
          >
            <span
              className={cn(
                'w-1.5 h-1.5 rounded-full bg-signal block',
                !motionOn && 'bg-text-muted opacity-40',
              )}
              aria-hidden="true"
            />
            <span>{motionOn ? 'MOTION: ON' : 'MOTION: OFF'}</span>
          </button>
          <a
            className={cn(
              'border border-signal text-signal px-3 py-1.5 tracking-[0.08em] text-xs inline-block whitespace-nowrap',
              'transition-[box-shadow,background] duration-200 ease-out',
              'hover:shadow-[0_0_12px_var(--color-signal)] hover:bg-signal-quiet',
              'motion-reduce:transition-none [body[data-motion=reduce]_&]:transition-none',
            )}
            href="/erik-cunha-cv.pdf"
            download
          >
            DOWNLOAD_CV
          </a>
          <a
            className={cn(
              'bg-signal text-black font-bold tracking-[0.08em] px-[14px] py-1.5 text-[12px] border border-signal',
              'transition-[box-shadow] duration-200 ease-out',
              'hover:shadow-[0_0_12px_var(--color-signal)]',
              'inline-flex items-center whitespace-nowrap',
              'motion-reduce:transition-none [body[data-motion=reduce]_&]:transition-none',
            )}
            href="https://www.linkedin.com/in/erikunha/"
            target="_blank"
            rel="noreferrer noopener"
          >
            SSH_CONNECT
            <span className="sr-only"> (opens in new window)</span>
          </a>
        </nav>
      </div>
    </div>
  );
}
