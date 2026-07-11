'use client';

import { useEffect, useRef } from 'react';
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
  MOBILE_LINE_SPECS,
  runBoot,
} from '@/lib/boot-animation';
import { readMotion } from '@/lib/motion';

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

export function HeroBootAnimation({ variant }: Props) {
  const bootRef = useRef<HTMLDivElement>(null);
  const ctrlRef = useRef<BootCtrl | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const mql = window.matchMedia('(max-width: 768px)');
    const isMobileVP = mql.matches;
    const shouldRun = variant === 'mobile' ? isMobileVP : !isMobileVP;

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

      const specs = variant === 'desktop' ? DESKTOP_LINE_SPECS : MOBILE_LINE_SPECS;
      const dialog = variant === 'desktop' ? DESKTOP_DIALOG : MOBILE_DIALOG;

      if (!readMotion()) {
        for (const s of specs) el.appendChild(buildLine(s, bootCls));
        el.appendChild(buildStaticCmdLine(bootCls));
        el.appendChild(buildLine([' '], bootCls));
        el.appendChild(buildStaticDialogLine('The Matrix has you...', bootCls));
        return;
      }

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
        lineMs: 110,
        lineJitter: 50,
        cmdMs: 60,
        cmdJitter: 30,
        typeMs: 75,
        holdMs: 1800,
        backMs: 35,
        interMs: 300,
        startMs: 200,
      };
      const timing = variant === 'desktop' ? timingDesktop : timingMobile;

      const onFirstLoop =
        variant === 'desktop' ? buildDesktopOnFirstLoop(el, ctrlRef, bootCls) : undefined;

      ctrlRef.current = runBoot(
        el,
        specs,
        dialog,
        bootCls,
        onFirstLoop ? { ...timing, onFirstLoop } : timing,
      );

      if (variant === 'desktop') {
        document.addEventListener('visibilitychange', onVisibility);
      }
    }

    if (shouldRun) startAnimation();

    const onBreakpointChange = (e: MediaQueryListEvent) => {
      const nowMobile = e.matches;
      const nowShouldRun = variant === 'mobile' ? nowMobile : !nowMobile;
      if (nowShouldRun) startAnimation();
    };
    mql.addEventListener('change', onBreakpointChange);

    return () => {
      ctrlRef.current?.cancel();
      mql.removeEventListener('change', onBreakpointChange);
      if (variant === 'desktop') {
        document.removeEventListener('visibilitychange', onVisibility);
      }
    };
  }, [variant]);

  return (
    <div
      ref={bootRef}
      className={variant === 'desktop' ? 'hero-boot-desktop' : 'hero-boot-mobile'}
    />
  );
}
