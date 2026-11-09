'use client';

import { useEffect, useRef } from 'react';
import type { HeroClientContent } from '@/content/schemas';
import {
  BLANK_BOOT_LINE,
  BOOT_SLOT_ATTR,
  type BootClasses,
  type BootCtrl,
  type BootSlotSpec,
  bootSlotSpecs,
  buildBootSlots,
  buildDesktopOnFirstLoop,
  buildLine,
  buildStaticCmdLine,
  buildStaticDialogLine,
  desktopBootLines,
  placeBootLine,
  runBoot,
  type SysfailBeat,
} from '@/lib/boot-animation';
import { isMobileViewport, watchMobileViewport } from '@/lib/media-queries';
import { readMotion } from '@/lib/motion';
import { subscribeMotion } from '@/lib/motion-change';
import { pauseWhileHidden } from '@/lib/pause-when-hidden';
import { runMobileBoot } from './mobile-boot';

type Props = {
  variant: 'desktop' | 'mobile';
  copy: HeroClientContent;
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

const BOOT_SLOT_CLASS = 'hero-boot-slot';
const BOOT_SLOT_MARK = { [BOOT_SLOT_ATTR]: '' };

function BootSlot({ spec }: { spec: BootSlotSpec }) {
  return (
    <span className={BOOT_SLOT_CLASS} {...BOOT_SLOT_MARK}>
      {spec.parts.map((part) =>
        typeof part === 'string' ? (
          part
        ) : (
          <span key={part.text} className={bootCls[part.cls]}>
            {part.text}
          </span>
        ),
      )}
    </span>
  );
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
  cmdMs: 60,
  cmdJitter: 30,
  typeMs: 75,
  holdMs: 1800,
  backMs: 35,
  interMs: 300,
};

function DesktopBoot({ copy }: { copy: HeroClientContent }) {
  const bootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = bootRef.current;
    if (!el) return;
    const host: HTMLDivElement = el;

    const ctrlRef: { current: BootCtrl | null } = { current: null };
    let beat: SysfailBeat | null = null;
    let unwatch: (() => void) | undefined;
    let started = false;

    function render() {
      if (!readMotion()) {
        for (const s of desktopBootLines(copy)) placeBootLine(host, buildLine(s, bootCls));
        placeBootLine(host, buildStaticCmdLine(bootCls));
        placeBootLine(host, buildLine([BLANK_BOOT_LINE], bootCls));
        placeBootLine(host, buildStaticDialogLine(copy.bootStaticDialogLine, bootCls));
        return;
      }
      beat = buildDesktopOnFirstLoop(host, ctrlRef, bootCls);
      ctrlRef.current = runBoot(host, desktopBootLines(copy), copy.bootDialogDesktop, bootCls, {
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
      host.replaceChildren(...buildBootSlots(copy, bootCls, BOOT_SLOT_CLASS));
    }

    function startAnimation() {
      if (started) return;
      started = true;
      render();
    }

    if (!isMobileViewport()) startAnimation();

    const unwatchViewport = watchMobileViewport((isMobile) => {
      if (!isMobile) startAnimation();
    });
    const unsubscribeMotion = subscribeMotion(() => {
      if (!started) return;
      clear();
      render();
    });

    return () => {
      unsubscribeMotion();
      unwatchViewport();
      clear();
    };
  }, [copy]);

  return (
    <div ref={bootRef} aria-hidden="true" className="hero-boot-desktop">
      {bootSlotSpecs(copy).map((spec) => (
        <BootSlot key={spec.id} spec={spec} />
      ))}
    </div>
  );
}

function MobileBoot({ copy }: { copy: HeroClientContent }) {
  const cmdRef = useRef<HTMLSpanElement>(null);
  const outRef = useRef<HTMLSpanElement>(null);
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    const cmdEl = cmdRef.current;
    const outEl = outRef.current;
    if (!host || !cmdEl || !outEl) return;

    let ctrl: BootCtrl | null = null;
    let unwatch: (() => void) | undefined;

    function start() {
      if (!cmdEl || !outEl) return;
      if (!readMotion()) {
        cmdEl.textContent = copy.bootCommand;
        outEl.textContent = copy.bootStaticDialogLine;
        return;
      }
      ctrl = runMobileBoot(cmdEl, outEl, copy.bootCommand, copy.bootDialogMobile, timingMobile);
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

    if (isMobileViewport()) start();

    const unwatchViewport = watchMobileViewport((isMobile) => {
      if (!isMobile) {
        stop();
        return;
      }
      if (!ctrl) start();
    });
    const unsubscribeMotion = subscribeMotion(() => {
      if (isMobileViewport()) restart();
    });

    return () => {
      unsubscribeMotion();
      stop();
      unwatchViewport();
    };
  }, [copy]);

  return (
    <div ref={hostRef} aria-hidden="true" className="hero-boot-mobile">
      <span className="hero-boot-line" data-testid="boot-line">
        {copy.bootSequenceLine}
      </span>
      <span className="hero-boot-line" data-testid="boot-line">
        <span className="hero-boot-prompt">{copy.bootPrompt}</span>{' '}
        <span className="hero-boot-cmd" ref={cmdRef} />
      </span>
      <span className="hero-boot-line" data-testid="boot-line">
        <span className="hero-boot-matrix-prefix">&gt;</span>
        <span className="hero-boot-matrix-out" ref={outRef} />
      </span>
    </div>
  );
}

export function HeroBootAnimation({ variant, copy }: Props) {
  return variant === 'desktop' ? <DesktopBoot copy={copy} /> : <MobileBoot copy={copy} />;
}
