'use client';

import { useEffect, useRef } from 'react';
import {
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

// Re-export kept for backwards-compat (sysfail-loop.test.ts imports from lib/boot-animation
// directly, so this re-export is technically dead — remove in a follow-up refactor).
export { type BootCtrl, runBoot } from '@/lib/boot-animation';

// ── HeroBootAnimation island ──────────────────────────────────────────────────
// Each variant mounts its own instance; only the one matching the viewport runs.
// matchMedia is deterministic regardless of stylesheet load order — picked over
// getComputedStyle to avoid the hydration race documented in spec §6.
//
// A MediaQueryList 'change' listener reacts to breakpoint crosses (device
// rotation, devtools resize) and starts the newly-visible variant if it hasn't
// already started. The hidden variant keeps running but is invisible — simpler
// than cancelling and re-seeding state on hide.

type Props = {
  variant: 'desktop' | 'mobile';
};

export function HeroBootAnimation({ variant }: Props) {
  const bootRef = useRef<HTMLDivElement>(null);
  // ctrlRef holds the BootCtrl returned by runBoot. Passed into
  // buildDesktopOnFirstLoop so onFirstLoop accesses it at invocation time
  // (seconds after runBoot assigns it) instead of capturing a pre-assignment
  // binding — this eliminates the temporal dead zone (Fix 2).
  const ctrlRef = useRef<BootCtrl | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const mql = window.matchMedia('(max-width: 768px)');
    const isMobileVP = mql.matches;
    const shouldRun = variant === 'mobile' ? isMobileVP : !isMobileVP;

    // started tracks whether this instance has already kicked off the animation.
    // Prevents double-start if the matchMedia change handler fires after mount.
    let started = false;

    // Lifted to effect scope so the cleanup return can removeEventListener with
    // the same stable reference. Only registered for the desktop variant —
    // mobile dialog is short enough that pausing isn't critical.
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
        for (const s of specs) el.appendChild(buildLine(s));
        el.appendChild(buildStaticCmdLine());
        // Fix 5: was buildBlankLine()
        el.appendChild(buildLine([' ']));
        el.appendChild(buildStaticDialogLine('The Matrix has you...'));
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

      const onFirstLoop = variant === 'desktop' ? buildDesktopOnFirstLoop(el, ctrlRef) : undefined;

      ctrlRef.current = runBoot(
        el,
        specs,
        dialog,
        onFirstLoop ? { ...timing, onFirstLoop } : timing,
      );

      if (variant === 'desktop') {
        document.addEventListener('visibilitychange', onVisibility);
      }
    }

    if (shouldRun) startAnimation();

    // React to viewport crosses (device rotation, devtools resize).
    // If the user crosses 768px and this variant becomes visible, start the
    // animation if it hasn't run yet.
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

  return <div ref={bootRef} className="hero__boot" />;
}
