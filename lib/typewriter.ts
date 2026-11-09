export type PhraseLoopTiming = {
  typeMs: number;
  holdMs: number;
  backMs: number;
  pauseMs: number;
};

type TypeOutOptions = {
  stepMs: number | (() => number);
  onText: (text: string) => void;
  onDone?: () => void;
};

type PhraseLoopOptions = {
  phrases: readonly string[];
  timing: PhraseLoopTiming;
  onText: (text: string) => void;
  onWrap?: () => void;
  startPaused?: boolean;
};

export type PhraseLoop = {
  cancel: () => void;
  pause: () => void;
  resume: () => void;
};

export const DEFAULT_PAUSE_REASON = 'default';

export type PauseControl = {
  pause: (reason?: string) => void;
  resume: (reason?: string) => void;
  isPaused: () => boolean;
};

export function createPauseControl(apply: (paused: boolean) => void): PauseControl {
  const reasons = new Set<string>();
  return {
    pause: (reason = DEFAULT_PAUSE_REASON) => {
      reasons.add(reason);
      apply(true);
    },
    resume: (reason = DEFAULT_PAUSE_REASON) => {
      reasons.delete(reason);
      if (reasons.size === 0) apply(false);
    },
    isPaused: () => reasons.size > 0,
  };
}

const PHRASE_PHASE = { Type: 'type', Hold: 'hold', Back: 'back' } as const;

type PhrasePhase = (typeof PHRASE_PHASE)[keyof typeof PHRASE_PHASE];

export function typeOut(text: string, { stepMs, onText, onDone }: TypeOutOptions): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let length = 0;
  let cancelled = false;

  function step() {
    if (cancelled) return;
    length++;
    onText(text.slice(0, length));
    if (length >= text.length) {
      onDone?.();
      return;
    }
    timer = setTimeout(step, typeof stepMs === 'function' ? stepMs() : stepMs);
  }

  if (text.length === 0) onDone?.();
  else step();

  return () => {
    cancelled = true;
    clearTimeout(timer);
  };
}

export function runPhraseLoop({
  phrases,
  timing,
  onText,
  onWrap,
  startPaused = false,
}: PhraseLoopOptions): PhraseLoop {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let cancelled = false;
  let paused = startPaused;
  let resumeTick: (() => void) | null = null;
  let phraseIndex = 0;
  let length = 0;
  let phase: PhrasePhase = PHRASE_PHASE.Type;

  function later(delayMs: number) {
    timer = setTimeout(tick, delayMs);
  }

  function tick() {
    if (cancelled) return;
    if (paused) {
      resumeTick = tick;
      return;
    }
    const phrase = phrases[phraseIndex] ?? '';
    if (phase === PHRASE_PHASE.Type) {
      length++;
      onText(phrase.slice(0, length));
      if (length >= phrase.length) {
        phase = PHRASE_PHASE.Hold;
        later(timing.holdMs);
      } else later(timing.typeMs);
    } else if (phase === PHRASE_PHASE.Hold) {
      phase = PHRASE_PHASE.Back;
      later(timing.backMs);
    } else {
      length--;
      onText(phrase.slice(0, length));
      if (length <= 0) {
        phraseIndex = (phraseIndex + 1) % phrases.length;
        if (phraseIndex === 0) onWrap?.();
        phase = PHRASE_PHASE.Type;
        later(timing.pauseMs);
      } else later(timing.backMs);
    }
  }

  if (phrases.length > 0) tick();

  return {
    cancel: () => {
      cancelled = true;
      resumeTick = null;
      clearTimeout(timer);
    },
    pause: () => {
      paused = true;
    },
    resume: () => {
      paused = false;
      const pending = resumeTick;
      resumeTick = null;
      pending?.();
    },
  };
}
