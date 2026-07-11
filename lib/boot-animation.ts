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

export const MOBILE_LINE_SPECS: LinePart[][] = [
  ['[BOOT SEQUENCE INITIATED]'],
  [' '],
  ['kernel modules... ', { cls: 'bootOk', text: 'OK' }],
  ['security... ', { cls: 'bootEnc', text: '[ENCRYPTED]' }],
  [{ cls: 'bootWelcome', text: 'DEV_OS v2.0.4 [user: erik]' }],
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
  pauseDialog: () => void;
  resumeDialog: () => void;
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

    let i = 0;
    function step() {
      if (cancelled) return;
      if (i >= cmdText.length) {
        cursor.remove();
        container.appendChild(buildLine([' '], cls));
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

    let phraseIdx = 0;
    let charIdx = 0;
    let phase: 'type' | 'hold' | 'back' = 'type';
    let firedOnce = false;

    function tick() {
      if (cancelled) return;
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

export function buildDesktopOnFirstLoop(
  el: HTMLElement,
  ctrlRef: { current: BootCtrl | null },
  cls: Pick<BootClasses, 'shake' | 'shake2'>,
): () => void {
  return () => {
    const section = el.closest('section');

    if (section) {
      const r = section.getBoundingClientRect();
      if (r.bottom < 0 || r.top > window.innerHeight) return;
    }

    if (section) {
      section.classList.add(cls.shake);
      setTimeout(() => section.classList.replace(cls.shake, cls.shake2), SYSFAIL_SHAKE_FRAME_1_MS);
      setTimeout(() => section.classList.remove(cls.shake, cls.shake2), SYSFAIL_SHAKE_FRAME_2_MS);
    }

    window.dispatchEvent(new CustomEvent('sysfail:start'));
    document.documentElement.classList.add('sysfail-on');
    ctrlRef.current?.pauseDialog();

    window.dispatchEvent(new CustomEvent('hero:sysfail:show'));

    setTimeout(() => {
      window.dispatchEvent(new CustomEvent('hero:sysfail:hide'));
      document.documentElement.classList.remove('sysfail-on');
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('sysfail:end'));
        ctrlRef.current?.resumeDialog();
      }, SYSFAIL_FADE_TAIL_MS);
    }, SYSFAIL_VISIBLE_MS);
  };
}
