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
  type SysfailBeat,
} from '@/lib/boot-animation';
import { MOBILE_QUERY } from '@/lib/media-queries';
import { readMotion } from '@/lib/motion';
import { subscribeMotion } from '@/lib/motion-change';
import { pauseWhileHidden } from '@/lib/pause-when-hidden';
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

  useEffect(() => {
    const el = bootRef.current;
    if (!el) return;
    const host: HTMLDivElement = el;

    const mql = window.matchMedia(MOBILE_QUERY);
    const ctrlRef: { current: BootCtrl | null } = { current: null };
    let beat: SysfailBeat | null = null;
    let unwatch: (() => void) | undefined;
    let started = false;

    function render() {
      if (!readMotion()) {
        for (const s of DESKTOP_LINE_SPECS) host.appendChild(buildLine(s, bootCls));
        host.appendChild(buildStaticCmdLine(bootCls));
        host.appendChild(buildLine([' '], bootCls));
        host.appendChild(buildStaticDialogLine(heroClientContent.bootStaticDialogLine, bootCls));
        return;
      }
      beat = buildDesktopOnFirstLoop(host, ctrlRef, bootCls);
      ctrlRef.current = runBoot(host, DESKTOP_LINE_SPECS, DESKTOP_DIALOG, bootCls, {
        ...timingDesktop,
        onFirstLoop: beat,
      });
      unwatch = pauseWhileHidden(host, {
        pause: (reason) => ctrlRef.current?.pauseDialog(reason),
        resume: (reason) => ctrlRef.current?.resumeDialog(reason),
      });
    }

    function clear() {
      unwatch?.();
      unwatch = undefined;
      beat?.settle();
      beat = null;
      ctrlRef.current?.cancel();
      ctrlRef.current = null;
      host.replaceChildren();
    }

    function startAnimation() {
      if (started) return;
      started = true;
      render();
    }

    if (!mql.matches) startAnimation();

    const onBreakpointChange = (e: MediaQueryListEvent) => {
      if (!e.matches) startAnimation();
    };
    mql.addEventListener('change', onBreakpointChange);
    const unsubscribeMotion = subscribeMotion(() => {
      if (!started) return;
      clear();
      render();
    });

    return () => {
      unsubscribeMotion();
      mql.removeEventListener('change', onBreakpointChange);
      clear();
    };
  }, []);

  return <div ref={bootRef} aria-hidden="true" className="hero-boot-desktop" />;
}

function MobileBoot() {
  const cmdRef = useRef<HTMLSpanElement>(null);
  const outRef = useRef<HTMLSpanElement>(null);
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    const cmdEl = cmdRef.current;
    const outEl = outRef.current;
    if (!host || !cmdEl || !outEl) return;

    const mql = window.matchMedia(MOBILE_QUERY);
    let ctrl: BootCtrl | null = null;
    let unwatch: (() => void) | undefined;

    function start() {
      if (!cmdEl || !outEl) return;
      if (!readMotion()) {
        cmdEl.textContent = heroClientContent.bootCommand;
        outEl.textContent = heroClientContent.bootStaticDialogLine;
        return;
      }
      ctrl = runMobileBoot(
        cmdEl,
        outEl,
        heroClientContent.bootCommand,
        MOBILE_DIALOG,
        timingMobile,
      );
      unwatch = pauseWhileHidden(host as HTMLDivElement, {
        pause: (reason) => ctrl?.pauseDialog(reason),
        resume: (reason) => ctrl?.resumeDialog(reason),
      });
    }

    function stop() {
      unwatch?.();
      unwatch = undefined;
      ctrl?.cancel();
      ctrl = null;
    }

    function restart() {
      stop();
      if (cmdEl) cmdEl.textContent = '';
      if (outEl) outEl.textContent = '';
      start();
    }

    if (mql.matches) start();

    const onBreakpointChange = (e: MediaQueryListEvent) => {
      if (!e.matches) {
        stop();
        return;
      }
      if (!ctrl) start();
    };
    mql.addEventListener('change', onBreakpointChange);
    const unsubscribeMotion = subscribeMotion(() => {
      if (mql.matches) restart();
    });

    return () => {
      unsubscribeMotion();
      stop();
      mql.removeEventListener('change', onBreakpointChange);
    };
  }, []);

  return (
    <div ref={hostRef} aria-hidden="true" className="hero-boot-mobile">
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
