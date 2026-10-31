'use client';

import { useEffect, useRef } from 'react';
import { heroClientContent } from '@/content/hero-client';
import {
  type BootClasses,
  type BootCtrl,
  buildDesktopOnFirstLoop,
  buildLine,
  buildStaticCmdLine,
  buildStaticDialogLine,
  DESKTOP_DIALOG,
  DESKTOP_LINE_SPECS,
  MOBILE_DIALOG,
  runBoot,
} from '@/lib/boot-animation';
import { readMotion } from '@/lib/motion';
import { runMobileBoot } from './mobile-boot';

type Props = {
  variant: 'desktop' | 'mobile';
};

const bootCls: BootClasses = {
  bootLine: 'hero-boot-line',
  bootOk: 'hero-boot-ok',
  bootEnc: 'hero-boot-enc',
  bootWelcome: 'hero-boot-welcome',
  bootPrompt: 'hero-boot-prompt',
  bootCmd: 'hero-boot-cmd',
  bootMatrixPrefix: 'hero-boot-matrix-prefix',
  bootMatrixOut: 'hero-boot-matrix-out',
  bootCursor: 'boot-cursor',
  shake: 'hero-shake',
  shake2: 'hero-shake2',
};

const timingDesktop = {
  lineMs: 150,
  lineJitter: 60,
  cmdMs: 70,
  cmdJitter: 30,
  typeMs: 80,
  holdMs: 2000,
  backMs: 40,
  interMs: 300,
  startMs: 250,
};

const timingMobile = {
  cmdMs: 60,
  cmdJitter: 30,
  typeMs: 75,
  holdMs: 1800,
  backMs: 35,
  interMs: 300,
};

function DesktopBoot() {
  const bootRef = useRef<HTMLDivElement>(null);
  const ctrlRef = useRef<BootCtrl | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const mql = window.matchMedia('(max-width: 767.98px)');
    const isMobileVP = mql.matches;

    let started = false;

    const onVisibility = () => {
      if (document.hidden) ctrlRef.current?.pauseDialog();
      else ctrlRef.current?.resumeDialog();
    };

    function startAnimation() {
      if (started) return;
      started = true;

      const el = bootRef.current;
      if (!el) return;

      if (!readMotion()) {
        for (const s of DESKTOP_LINE_SPECS) el.appendChild(buildLine(s, bootCls));
        el.appendChild(buildStaticCmdLine(bootCls));
        el.appendChild(buildLine([' '], bootCls));
        el.appendChild(buildStaticDialogLine(heroClientContent.bootStaticDialogLine, bootCls));
        return;
      }

      const onFirstLoop = buildDesktopOnFirstLoop(el, ctrlRef, bootCls);

      ctrlRef.current = runBoot(el, DESKTOP_LINE_SPECS, DESKTOP_DIALOG, bootCls, {
        ...timingDesktop,
        onFirstLoop,
      });

      document.addEventListener('visibilitychange', onVisibility);
    }

    if (!isMobileVP) startAnimation();

    const onBreakpointChange = (e: MediaQueryListEvent) => {
      if (!e.matches) startAnimation();
    };
    mql.addEventListener('change', onBreakpointChange);

    return () => {
      ctrlRef.current?.cancel();
      mql.removeEventListener('change', onBreakpointChange);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  return <div ref={bootRef} aria-hidden="true" className="hero-boot-desktop" />;
}

function MobileBoot() {
  const cmdRef = useRef<HTMLSpanElement>(null);
  const outRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const mql = window.matchMedia('(max-width: 767.98px)');
    let stop: (() => void) | undefined;

    function start() {
      const cmdEl = cmdRef.current;
      const outEl = outRef.current;
      if (!cmdEl || !outEl) return;

      if (!readMotion()) {
        cmdEl.textContent = heroClientContent.bootCommand;
        outEl.textContent = heroClientContent.bootStaticDialogLine;
        return;
      }

      stop = runMobileBoot(
        cmdEl,
        outEl,
        heroClientContent.bootCommand,
        MOBILE_DIALOG,
        timingMobile,
      );
    }

    if (mql.matches) start();

    const onBreakpointChange = (e: MediaQueryListEvent) => {
      if (!e.matches) {
        stop?.();
        stop = undefined;
        return;
      }
      if (!stop) start();
    };
    mql.addEventListener('change', onBreakpointChange);

    return () => {
      stop?.();
      mql.removeEventListener('change', onBreakpointChange);
    };
  }, []);

  return (
    <div aria-hidden="true" className="hero-boot-mobile">
      <span className="hero-boot-line" data-testid="boot-line">
        {heroClientContent.bootSequenceLine}
      </span>
      <span className="hero-boot-line" data-testid="boot-line">
        <span className="hero-boot-prompt">{heroClientContent.bootPrompt}</span>{' '}
        <span className="hero-boot-cmd" ref={cmdRef} />
      </span>
      <span className="hero-boot-line" data-testid="boot-line">
        <span className="hero-boot-matrix-prefix">&gt;</span>
        <span className="hero-boot-matrix-out" ref={outRef} />
      </span>
    </div>
  );
}

export function HeroBootAnimation({ variant }: Props) {
  return variant === 'desktop' ? <DesktopBoot /> : <MobileBoot />;
}
