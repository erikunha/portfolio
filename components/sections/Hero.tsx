// components/sections/Hero.tsx
'use client';

import { useEffect, useRef } from 'react';
import { readMotion } from '@/lib/motion';
import { useBreakpoint } from '@/lib/use-breakpoint';

// ── Typed line-spec data ──────────────────────────────────────────────────────
type Span = { cls: string; text: string };
type LinePart = string | Span;

const DESKTOP_LINE_SPECS: LinePart[][] = [
  ['[SYSTEM BOOT SEQUENCE INITIATED]'],
  [' '],
  ['Initializing kernel modules... ', { cls: 'boot__ok', text: 'OK' }],
  ['Mounting local filesystems... ', { cls: 'boot__ok', text: 'OK' }],
  ['Starting network services... ', { cls: 'boot__ok', text: 'OK' }],
  ['Loading security protocols... ', { cls: 'boot__enc', text: '[ENCRYPTED]' }],
  [{ cls: 'boot__welcome', text: 'Welcome to DEV_OS v2.0.4-stable [user: erik]' }],
  [' '],
];

const MOBILE_LINE_SPECS: LinePart[][] = [
  ['[BOOT SEQUENCE INITIATED]'],
  [' '],
  ['kernel modules... ', { cls: 'boot__ok', text: 'OK' }],
  ['mount fs... ', { cls: 'boot__ok', text: 'OK' }],
  ['network... ', { cls: 'boot__ok', text: 'OK' }],
  ['security... ', { cls: 'boot__enc', text: '[ENCRYPTED]' }],
  [{ cls: 'boot__welcome', text: 'DEV_OS v2.0.4 [user: erik]' }],
  [' '],
];

const DESKTOP_DIALOG = [
  'Wake up, Neo...',
  'Wake up...',
  'The Matrix has you...',
  'Knock, knock, Neo...',
];
const MOBILE_DIALOG = ['Wake up, Neo...', 'The Matrix has you...', 'Knock, knock, Neo...'];

// ── Safe DOM builders (no innerHTML) ─────────────────────────────────────────
function buildLine(parts: LinePart[]): HTMLElement {
  const line = document.createElement('span');
  line.className = 'boot__line';
  for (const p of parts) {
    if (typeof p === 'string') {
      line.appendChild(document.createTextNode(p));
    } else {
      const s = document.createElement('span');
      s.className = p.cls;
      s.textContent = p.text;
      line.appendChild(s);
    }
  }
  return line;
}

function buildBlankLine(): HTMLElement {
  return buildLine([' ']);
}

function buildStaticCmdLine(): HTMLElement {
  return buildLine([
    { cls: 'boot__prompt', text: 'erik@portfolio:~$' },
    ' ',
    { cls: 'boot__cmd', text: 'run bio.exe --verbose' },
  ]);
}

function buildStaticDialogLine(text: string): HTMLElement {
  return buildLine([
    { cls: 'boot__matrix-prefix', text: '>' },
    { cls: 'boot__matrix-out', text: text },
  ]);
}

// ── Boot animation (DOM mutations, no per-char useState — matches proto) ──────
type BootCtrl = { cancel: () => void; pauseDialog: () => void; resumeDialog: () => void };

export function runBoot(
  container: HTMLElement,
  specs: LinePart[][],
  dialog: string[],
  opts: {
    lineMs: number;
    lineJitter: number;
    cmdMs: number;
    cmdJitter: number;
    typeMs: number;
    holdMs: number;
    backMs: number;
    interMs: number;
    startMs: number;
    onFirstLoop?: () => void;
  },
): BootCtrl {
  let cancelled = false;
  let dialogPaused = false;
  let dialogResumeFn: (() => void) | null = null;
  const timers: ReturnType<typeof setTimeout>[] = [];

  function later(fn: () => void, ms: number) {
    if (cancelled) return;
    timers.push(setTimeout(fn, ms));
  }

  function revealLines(idx: number) {
    if (cancelled) return;
    if (idx >= specs.length) {
      later(typeCmd, 350);
      return;
    }
    const spec = specs[idx];
    if (!spec) return;
    container.appendChild(buildLine(spec));
    later(() => revealLines(idx + 1), opts.lineMs + Math.random() * opts.lineJitter);
  }

  function typeCmd() {
    if (cancelled) return;
    const cmdText = 'run bio.exe --verbose';

    const line = document.createElement('span');
    line.className = 'boot__line';
    const prompt = document.createElement('span');
    prompt.className = 'boot__prompt';
    prompt.textContent = 'erik@portfolio:~$';
    const cmdEl = document.createElement('span');
    cmdEl.className = 'boot__cmd';
    const cursor = document.createElement('span');
    cursor.className = 'boot__cursor';
    line.appendChild(prompt);
    line.appendChild(document.createTextNode(' '));
    line.appendChild(cmdEl);
    line.appendChild(cursor);
    container.appendChild(line);

    let i = 0;
    function step() {
      if (cancelled) return;
      if (i >= cmdText.length) {
        cursor.remove();
        container.appendChild(buildBlankLine());
        later(startDialog, 350);
        return;
      }
      cmdEl.textContent += cmdText[i++];
      later(step, opts.cmdMs + Math.random() * opts.cmdJitter);
    }
    step();
  }

  function startDialog() {
    if (cancelled) return;

    const line = document.createElement('span');
    line.className = 'boot__line';
    const prefix = document.createElement('span');
    prefix.className = 'boot__matrix-prefix';
    prefix.textContent = '>';
    const out = document.createElement('span');
    out.className = 'boot__matrix-out';
    const cur = document.createElement('span');
    cur.className = 'boot__cursor';
    line.appendChild(prefix);
    line.appendChild(out);
    line.appendChild(cur);
    container.appendChild(line);

    let phraseIdx = 0;
    let charIdx = 0;
    let phase: 'type' | 'hold' | 'back' = 'type';
    let firedOnce = false;

    function tick() {
      if (cancelled) return;
      // Pause: store self as resume target and yield until resumeDialog() fires.
      if (dialogPaused) {
        dialogResumeFn = tick;
        return;
      }
      const phrase = dialog[phraseIdx];
      if (!phrase) return;
      if (phase === 'type') {
        out.textContent = phrase.slice(0, ++charIdx);
        if (charIdx >= phrase.length) {
          phase = 'hold';
          later(tick, opts.holdMs);
        } else later(tick, opts.typeMs);
      } else if (phase === 'hold') {
        phase = 'back';
        later(tick, opts.backMs);
      } else {
        out.textContent = phrase.slice(0, --charIdx);
        if (charIdx <= 0) {
          phraseIdx = (phraseIdx + 1) % dialog.length;
          if (phraseIdx === 0 && !firedOnce) {
            firedOnce = true;
            opts.onFirstLoop?.();
          }
          phase = 'type';
          later(tick, opts.interMs);
        } else {
          later(tick, opts.backMs);
        }
      }
    }
    tick();
  }

  later(() => revealLines(0), opts.startMs);

  return {
    cancel: () => {
      cancelled = true;
      timers.forEach(clearTimeout);
      dialogResumeFn = null;
    },
    pauseDialog: () => {
      dialogPaused = true;
    },
    resumeDialog: () => {
      dialogPaused = false;
      if (dialogResumeFn) {
        const fn = dialogResumeFn;
        dialogResumeFn = null;
        fn();
      }
    },
  };
}

// ── Components ────────────────────────────────────────────────────────────────
export function Hero() {
  const { isMobile } = useBreakpoint();
  if (isMobile) return <MobileHero />;
  return <DesktopHero />;
}

function DesktopHero() {
  const bootRef = useRef<HTMLDivElement>(null);
  const sectionRef = useRef<HTMLElement>(null);
  const sysfailRef = useRef<HTMLDivElement>(null);
  const bootCtrl = useRef<BootCtrl | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const el = bootRef.current;
    if (!el) return;

    if (!readMotion()) {
      for (const s of DESKTOP_LINE_SPECS) el.appendChild(buildLine(s));
      el.appendChild(buildStaticCmdLine());
      el.appendChild(buildBlankLine());
      el.appendChild(buildStaticDialogLine('The Matrix has you...'));
      return;
    }

    const ctrl = runBoot(el, DESKTOP_LINE_SPECS, DESKTOP_DIALOG, {
      lineMs: 150,
      lineJitter: 60,
      cmdMs: 70,
      cmdJitter: 30,
      typeMs: 80,
      holdMs: 2000,
      backMs: 40,
      interMs: 300,
      startMs: 250,
      onFirstLoop: () => {
        const section = sectionRef.current;
        const sysfail = sysfailRef.current;

        // Skip if hero is off-screen (dialog pauses when off-screen anyway)
        if (section) {
          const r = section.getBoundingClientRect();
          if (r.bottom < 0 || r.top > window.innerHeight) return;
        }

        // 1. Shake hero panel (40ms shake → 40ms shake-2 → 80ms clear)
        if (section) {
          section.classList.add('shake');
          setTimeout(() => section.classList.replace('shake', 'shake-2'), 40);
          setTimeout(() => section.classList.remove('shake', 'shake-2'), 80);
        }

        // 2. Pause rain + CRT effects + dialog
        window.dispatchEvent(new CustomEvent('sysfail:start'));
        document.documentElement.classList.add('sysfail-on');
        ctrl.pauseDialog();

        // 3. Fade plate in
        if (sysfail) sysfail.classList.add('on');

        // 4. After display hold: fade plate out, restore CRT, resume rain + dialog
        setTimeout(() => {
          if (sysfail) sysfail.classList.remove('on');
          document.documentElement.classList.remove('sysfail-on');
          // Wait for fade-out transition (300ms) before resuming rain
          setTimeout(() => {
            window.dispatchEvent(new CustomEvent('sysfail:end'));
            ctrl.resumeDialog();
          }, 300);
        }, 5000);
      },
    });

    const onVisibility = () => {
      if (document.hidden) ctrl.pauseDialog();
      else ctrl.resumeDialog();
    };
    document.addEventListener('visibilitychange', onVisibility);

    bootCtrl.current = ctrl;
    return () => {
      ctrl.cancel();
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  return (
    <section id="bio" className="hero hero--desktop" ref={sectionRef}>
      <div className="hero__left">
        <div ref={bootRef} className="hero__boot" />
      </div>
      <aside className="hero__bio">
        <h1 className="hero__name">Erik Henrique Alves Cunha</h1>
        <p className="hero__tagline">
          Senior Full-Stack Engineer, Frontend · 8+ yrs in building systems to support business
          operations · fintech (PCI-DSS), healthcare, global e-commerce
        </p>
        <p className="hero__meta">
          <span>
            LOC: <b>Brazil</b>
          </span>
          <span>
            NOW: <b>Betsson</b>
          </span>
          <span>EN/PT/FR/ES</span>
        </p>
        <p className="hero__status">
          <span className="hero__status-dot" aria-hidden="true" />
          OPEN_TO_RELOCATION · WORLDWIDE
        </p>
        <div className="hero__ctas">
          <a
            className="hero__cta hero__cta--primary"
            href="https://www.linkedin.com/in/erikunha/"
            target="_blank"
            rel="noreferrer"
          >
            EXEC HIRE
          </a>
          <a
            className="hero__cta hero__cta--secondary"
            href="https://github.com/erikunha"
            target="_blank"
            rel="noreferrer"
          >
            GITHUB ↗
          </a>
        </div>
      </aside>
      <div ref={sysfailRef} className="hero__headline" aria-hidden="true" aria-live="off">
        <div className="hero__headline-plate">SYSTEM FAILURE</div>
      </div>
    </section>
  );
}

function MobileHero() {
  const bootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const el = bootRef.current;
    if (!el) return;

    if (!readMotion()) {
      for (const s of MOBILE_LINE_SPECS) el.appendChild(buildLine(s));
      el.appendChild(buildStaticCmdLine());
      el.appendChild(buildBlankLine());
      el.appendChild(buildStaticDialogLine('The Matrix has you...'));
      return;
    }

    return runBoot(el, MOBILE_LINE_SPECS, MOBILE_DIALOG, {
      lineMs: 110,
      lineJitter: 50,
      cmdMs: 60,
      cmdJitter: 30,
      typeMs: 75,
      holdMs: 1800,
      backMs: 35,
      interMs: 300,
      startMs: 200,
    }).cancel;
  }, []);

  return (
    <section id="bio" className="hero hero--mobile">
      <div className="hero__inner">
        <div ref={bootRef} className="hero__boot" />

        <h1 className="hero__name">Erik Henrique Alves Cunha</h1>
        <p className="hero__tagline">
          Senior Full-Stack Engineer, Frontend · 8+ yrs in building systems to support business
          operations · fintech (PCI-DSS), healthcare, global e-commerce
        </p>
        <p className="hero__meta">
          <span>
            LOC: <b>Brazil</b>
          </span>
          <span>
            NOW: <b>Betsson</b>
          </span>
          <span>EN/PT/FR/ES</span>
        </p>
        <p className="hero__status">
          <span className="hero__status-dot" aria-hidden="true" />
          OPEN_TO_RELOCATION · WORLDWIDE
        </p>
        <div className="hero__ctas">
          <a
            className="hero__cta hero__cta--primary"
            href="https://www.linkedin.com/in/erikunha/"
            target="_blank"
            rel="noreferrer"
          >
            EXEC HIRE
          </a>
          <a
            className="hero__cta hero__cta--secondary"
            href="https://github.com/erikunha"
            target="_blank"
            rel="noreferrer"
          >
            GITHUB ↗
          </a>
        </div>
      </div>
    </section>
  );
}
