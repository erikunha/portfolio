import { SYSFAIL_END, SYSFAIL_START } from '@/lib/events';
import { createPauseControl, type PhraseLoop, runPhraseLoop, typeOut } from './typewriter';

export type BootClassKey =
  | 'bootOk'
  | 'bootEnc'
  | 'bootWelcome'
  | 'bootPrompt'
  | 'bootCmd'
  | 'bootMatrixPrefix'
  | 'bootMatrixOut'
  | 'bootCursor'
  | 'bootLine'
  | 'shake'
  | 'shake2';

export type BootClasses = Record<BootClassKey, string>;

export type Span = { cls: BootClassKey; text: string };
export type LinePart = string | Span;

export const DESKTOP_LINE_SPECS: LinePart[][] = [
  ['[SYSTEM BOOT SEQUENCE INITIATED]'],
  [' '],
  ['Initializing kernel modules... ', { cls: 'bootOk', text: 'OK' }],
  ['Mounting local filesystems... ', { cls: 'bootOk', text: 'OK' }],
  ['Starting network services... ', { cls: 'bootOk', text: 'OK' }],
  ['Loading security protocols... ', { cls: 'bootEnc', text: '[ENCRYPTED]' }],
  [{ cls: 'bootWelcome', text: 'Welcome to DEV_OS v2.0.4-stable [user: erik]' }],
  [' '],
];

export const DESKTOP_DIALOG = [
  'Wake up, Neo...',
  'Wake up...',
  'The Matrix has you...',
  'Knock, knock, Neo...',
];
export const MOBILE_DIALOG = ['Wake up, Neo...', 'The Matrix has you...', 'Knock, knock, Neo...'];

const SYSFAIL_SHAKE_FRAME_1_MS = 40;
const SYSFAIL_SHAKE_FRAME_2_MS = 80;
const SYSFAIL_VISIBLE_MS = 5000;
const SYSFAIL_FADE_TAIL_MS = 300;

export function buildLine(parts: LinePart[], cls: BootClasses): HTMLElement {
  const line = document.createElement('span');
  line.className = cls.bootLine;
  line.dataset.testid = 'boot-line';
  for (const p of parts) {
    if (typeof p === 'string') {
      line.appendChild(document.createTextNode(p));
    } else {
      const s = document.createElement('span');
      s.className = cls[p.cls];
      s.textContent = p.text;
      line.appendChild(s);
    }
  }
  return line;
}

export function buildStaticCmdLine(cls: BootClasses): HTMLElement {
  return buildLine(
    [
      { cls: 'bootPrompt', text: 'erik@portfolio:~$' },
      ' ',
      { cls: 'bootCmd', text: 'run bio.exe --verbose' },
    ],
    cls,
  );
}

export function buildStaticDialogLine(text: string, cls: BootClasses): HTMLElement {
  return buildLine(
    [
      { cls: 'bootMatrixPrefix', text: '>' },
      { cls: 'bootMatrixOut', text: text },
    ],
    cls,
  );
}

export type BootCtrl = {
  cancel: () => void;
  pauseDialog: (reason?: string) => void;
  resumeDialog: (reason?: string) => void;
};

export function runBoot(
  container: HTMLElement,
  specs: LinePart[][],
  dialog: string[],
  cls: BootClasses,
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
  let dialogLoop: PhraseLoop | undefined;
  const dialogPause = createPauseControl((paused) => {
    if (paused) dialogLoop?.pause();
    else dialogLoop?.resume();
  });
  let cancelTyping: (() => void) | undefined;
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
    container.appendChild(buildLine(spec, cls));
    later(() => revealLines(idx + 1), opts.lineMs + Math.random() * opts.lineJitter);
  }

  function typeCmd() {
    if (cancelled) return;
    const cmdText = 'run bio.exe --verbose';

    const line = document.createElement('span');
    line.className = cls.bootLine;
    line.dataset.testid = 'boot-line';
    const prompt = document.createElement('span');
    prompt.className = cls.bootPrompt;
    prompt.textContent = 'erik@portfolio:~$';
    const cmdEl = document.createElement('span');
    cmdEl.className = cls.bootCmd;
    const cursor = document.createElement('span');
    cursor.className = cls.bootCursor;
    cursor.dataset.testid = 'boot-cursor';
    line.appendChild(prompt);
    line.appendChild(document.createTextNode(' '));
    line.appendChild(cmdEl);
    line.appendChild(cursor);
    container.appendChild(line);

    cancelTyping = typeOut(cmdText, {
      stepMs: () => opts.cmdMs + Math.random() * opts.cmdJitter,
      onText: (text) => {
        cmdEl.textContent = text;
      },
      onDone: () => {
        cursor.remove();
        container.appendChild(buildLine([' '], cls));
        later(startDialog, 350);
      },
    });
  }

  function startDialog() {
    if (cancelled) return;

    const line = document.createElement('span');
    line.className = cls.bootLine;
    line.dataset.testid = 'boot-line';
    const prefix = document.createElement('span');
    prefix.className = cls.bootMatrixPrefix;
    prefix.textContent = '>';
    const out = document.createElement('span');
    out.className = cls.bootMatrixOut;
    const cur = document.createElement('span');
    cur.className = cls.bootCursor;
    cur.dataset.testid = 'boot-cursor';
    line.appendChild(prefix);
    line.appendChild(out);
    line.appendChild(cur);
    container.appendChild(line);

    let firedOnce = false;
    dialogLoop = runPhraseLoop({
      phrases: dialog,
      timing: {
        typeMs: opts.typeMs,
        holdMs: opts.holdMs,
        backMs: opts.backMs,
        pauseMs: opts.interMs,
      },
      onText: (text) => {
        out.textContent = text;
      },
      startPaused: dialogPause.isPaused(),
      onWrap: () => {
        if (firedOnce) return;
        firedOnce = true;
        opts.onFirstLoop?.();
      },
    });
  }

  later(() => revealLines(0), opts.startMs);

  return {
    cancel: () => {
      cancelled = true;
      timers.forEach(clearTimeout);
      cancelTyping?.();
      dialogLoop?.cancel();
    },
    pauseDialog: dialogPause.pause,
    resumeDialog: dialogPause.resume,
  };
}

export type SysfailBeat = (() => void) & { settle: () => void };

export function buildDesktopOnFirstLoop(
  el: HTMLElement,
  ctrlRef: { current: BootCtrl | null },
  cls: Pick<BootClasses, 'shake' | 'shake2'>,
): SysfailBeat {
  const timers = new Set<ReturnType<typeof setTimeout>>();
  let shaken: Element | null = null;
  let active = false;

  function later(fn: () => void, ms: number) {
    const timer = setTimeout(() => {
      timers.delete(timer);
      fn();
    }, ms);
    timers.add(timer);
  }

  function hidePlate() {
    window.dispatchEvent(new CustomEvent('hero:sysfail:hide'));
    document.documentElement.classList.remove('sysfail-on');
  }

  function release() {
    active = false;
    window.dispatchEvent(new CustomEvent(SYSFAIL_END));
    ctrlRef.current?.resumeDialog();
  }

  const beat = () => {
    const section = el.closest('section');

    if (section) {
      const r = section.getBoundingClientRect();
      if (r.bottom < 0 || r.top > window.innerHeight) return;
    }

    active = true;
    if (section) {
      shaken = section;
      section.classList.add(cls.shake);
      later(() => section.classList.replace(cls.shake, cls.shake2), SYSFAIL_SHAKE_FRAME_1_MS);
      later(() => section.classList.remove(cls.shake, cls.shake2), SYSFAIL_SHAKE_FRAME_2_MS);
    }

    window.dispatchEvent(new CustomEvent(SYSFAIL_START));
    document.documentElement.classList.add('sysfail-on');
    ctrlRef.current?.pauseDialog();

    window.dispatchEvent(new CustomEvent('hero:sysfail:show'));

    later(() => {
      hidePlate();
      later(release, SYSFAIL_FADE_TAIL_MS);
    }, SYSFAIL_VISIBLE_MS);
  };

  beat.settle = () => {
    if (!active) return;
    for (const timer of timers) clearTimeout(timer);
    timers.clear();
    shaken?.classList.remove(cls.shake, cls.shake2);
    hidePlate();
    release();
  };

  return beat;
}
