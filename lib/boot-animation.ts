// lib/boot-animation.ts
// Pure animation driver — no React dependency.
// Extracted from HeroBootAnimation.tsx so it can be unit-tested and reused
// without pulling in any client-island machinery.

// ── Typed line-spec data ──────────────────────────────────────────────────────
export type Span = { cls: string; text: string };
export type LinePart = string | Span;

export const DESKTOP_LINE_SPECS: LinePart[][] = [
  ['[SYSTEM BOOT SEQUENCE INITIATED]'],
  [' '],
  ['Initializing kernel modules... ', { cls: 'boot__ok', text: 'OK' }],
  ['Mounting local filesystems... ', { cls: 'boot__ok', text: 'OK' }],
  ['Starting network services... ', { cls: 'boot__ok', text: 'OK' }],
  ['Loading security protocols... ', { cls: 'boot__enc', text: '[ENCRYPTED]' }],
  [{ cls: 'boot__welcome', text: 'Welcome to DEV_OS v2.0.4-stable [user: erik]' }],
  [' '],
];

export const MOBILE_LINE_SPECS: LinePart[][] = [
  ['[BOOT SEQUENCE INITIATED]'],
  [' '],
  ['kernel modules... ', { cls: 'boot__ok', text: 'OK' }],
  ['mount fs... ', { cls: 'boot__ok', text: 'OK' }],
  ['network... ', { cls: 'boot__ok', text: 'OK' }],
  ['security... ', { cls: 'boot__enc', text: '[ENCRYPTED]' }],
  [{ cls: 'boot__welcome', text: 'DEV_OS v2.0.4 [user: erik]' }],
  [' '],
];

export const DESKTOP_DIALOG = [
  'Wake up, Neo...',
  'Wake up...',
  'The Matrix has you...',
  'Knock, knock, Neo...',
];
export const MOBILE_DIALOG = ['Wake up, Neo...', 'The Matrix has you...', 'Knock, knock, Neo...'];

// ── Sysfail timing constants (Fix 4: replaces bare magic numbers) ─────────────
// Timeline: shake at 0ms → shake-2 at 40ms → clear at 80ms → hide at 5000ms → rain resumes at 5300ms
const SYSFAIL_SHAKE_FRAME_1_MS = 40;
const SYSFAIL_SHAKE_FRAME_2_MS = 80;
const SYSFAIL_VISIBLE_MS = 5000;
const SYSFAIL_FADE_TAIL_MS = 300;

// ── Safe DOM builders (no innerHTML) ─────────────────────────────────────────
export function buildLine(parts: LinePart[]): HTMLElement {
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

// buildBlankLine removed (Fix 5): call sites use buildLine([' ']) directly.

export function buildStaticCmdLine(): HTMLElement {
  return buildLine([
    { cls: 'boot__prompt', text: 'erik@portfolio:~$' },
    ' ',
    { cls: 'boot__cmd', text: 'run bio.exe --verbose' },
  ]);
}

export function buildStaticDialogLine(text: string): HTMLElement {
  return buildLine([
    { cls: 'boot__matrix-prefix', text: '>' },
    { cls: 'boot__matrix-out', text: text },
  ]);
}

// ── Boot animation (DOM mutations, no per-char useState — matches proto) ──────
export type BootCtrl = {
  cancel: () => void;
  pauseDialog: () => void;
  resumeDialog: () => void;
};

// Exported for unit-testing (sysfail-loop.test.ts). Not used by RSC consumers.
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
        // Fix 5: was buildBlankLine()
        container.appendChild(buildLine([' ']));
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

// ── onFirstLoop builder (Fix 2: eliminates ctrl temporal dead zone) ───────────
// The onFirstLoop callback must call ctrl.pauseDialog() / ctrl.resumeDialog(),
// but it is passed as an argument to runBoot — which means ctrl is not yet
// assigned when the closure is created.
//
// Fix: accept a ctrlRef (MutableRefObject<BootCtrl | null>) so the closure
// looks up ctrlRef.current at invocation time (seconds later, always assigned)
// rather than capturing a pre-assignment binding.
//
// Used exclusively by HeroBootAnimation.tsx; kept here so it lives next to
// runBoot and the sysfail timing constants it references.
export function buildDesktopOnFirstLoop(
  el: HTMLElement,
  ctrlRef: { current: BootCtrl | null },
): () => void {
  return () => {
    // Find the parent <section> via DOM traversal — works since el is mounted
    // inside .hero--desktop > .hero__left.
    const section = el.closest('section');

    // Skip if hero is off-screen.
    if (section) {
      const r = section.getBoundingClientRect();
      if (r.bottom < 0 || r.top > window.innerHeight) return;
    }

    // 1. Shake hero panel: shake at 0ms → shake-2 at FRAME_1_MS → clear at FRAME_2_MS
    if (section) {
      section.classList.add('shake');
      setTimeout(() => section.classList.replace('shake', 'shake-2'), SYSFAIL_SHAKE_FRAME_1_MS);
      setTimeout(() => section.classList.remove('shake', 'shake-2'), SYSFAIL_SHAKE_FRAME_2_MS);
    }

    // 2. Pause rain + CRT effects + dialog.
    // ctrlRef.current is guaranteed assigned by invocation time (fires seconds after
    // runBoot returns); looking it up here avoids the temporal dead zone.
    window.dispatchEvent(new CustomEvent('sysfail:start'));
    document.documentElement.classList.add('sysfail-on');
    ctrlRef.current?.pauseDialog();

    // 3. Signal HeroSystemFailure to show the overlay via DOM event.
    // HeroSystemFailure listens on 'hero:sysfail:show' and toggles .on.
    window.dispatchEvent(new CustomEvent('hero:sysfail:show'));

    // 4. After display hold: hide overlay, restore CRT, resume rain + dialog.
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent('hero:sysfail:hide'));
      document.documentElement.classList.remove('sysfail-on');
      // Wait for fade-out transition before resuming rain.
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('sysfail:end'));
        ctrlRef.current?.resumeDialog();
      }, SYSFAIL_FADE_TAIL_MS);
    }, SYSFAIL_VISIBLE_MS);
  };
}
