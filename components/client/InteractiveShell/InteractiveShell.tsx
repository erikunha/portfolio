'use client';

import { Fragment, useCallback, useEffect, useRef, useState } from 'react';
import SHELL_RESPONSES from '@/content/shell-commands';
import { WindowChrome } from '@/design-system';
import { readMotion } from '@/lib/motion';
import { parseStreamChunk } from '@/lib/stream-protocol';
import { useBreakpoint } from '@/lib/use-breakpoint.client';

type Line = { id: number; kind: 'prompt' | 'output' | 'error' | 'info' | 'loading'; text: string };

const KIND_CLASS: Record<Line['kind'], string> = {
  prompt: 'text-signal',
  output: 'text-text-body opacity-[0.95]',
  error: 'text-error',
  info: 'text-text-muted',
  loading: 'text-signal opacity-50',
};

const INITIAL_LINES: Omit<Line, 'id'>[] = [
  {
    kind: 'info',
    text: 'Connected. Type help to list commands, or ask me anything about Erik.',
  },
];

const MOBILE_INITIAL: Omit<Line, 'id'>[] = [
  { kind: 'info', text: 'welcome. type help, tap a chip, or ask me anything.' },
];

const COMMANDS: { label: string; cmd: string }[] = [
  { label: 'help', cmd: 'help' },
  { label: 'whois', cmd: 'whois' },
  { label: 'ls', cmd: 'ls' },
  { label: 'cat skills.md', cmd: 'cat skills.md' },
  { label: 'cat ~/.now', cmd: 'cat ~/.now' },
  { label: 'contact', cmd: 'contact' },
  { label: 'face', cmd: 'face' },
  { label: 'hire', cmd: 'hire' },
  { label: 'clear', cmd: 'clear' },
];

function withIds(lines: Omit<Line, 'id'>[], nextId: () => number): Line[] {
  return lines.map((l) => ({ ...l, id: nextId() }));
}

const PLACEHOLDER_SUGGESTIONS = [
  'help',
  'whois',
  'cat skills.md',
  'cat ~/.now',
  'what are your strongest projects?',
  'open to relocation?',
  'hire',
];

function AnimatedPlaceholder() {
  const textRef = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const el = textRef.current;
    if (!el) return;
    const node = el;
    if (!readMotion()) {
      node.textContent = 'type a command or ask anything…';
      return;
    }
    let cancelled = false;
    let idx = 0;
    let charIdx = 0;
    let phase: 'type' | 'hold' | 'back' = 'type';

    function tick() {
      if (cancelled) return;
      const suggestion = PLACEHOLDER_SUGGESTIONS[idx % PLACEHOLDER_SUGGESTIONS.length] ?? '';
      if (phase === 'type') {
        node.textContent = suggestion.slice(0, ++charIdx);
        if (charIdx >= suggestion.length) {
          phase = 'hold';
          setTimeout(tick, 1800);
        } else setTimeout(tick, 60);
      } else if (phase === 'hold') {
        phase = 'back';
        setTimeout(tick, 40);
      } else {
        node.textContent = suggestion.slice(0, --charIdx);
        if (charIdx <= 0) {
          idx++;
          charIdx = 0;
          phase = 'type';
          setTimeout(tick, 300);
        } else setTimeout(tick, 30);
      }
    }
    tick();
    return () => {
      cancelled = true;
    };
  }, []);
  return (
    <span
      className="absolute left-0 top-1/2 -translate-y-1/2 text-text-muted opacity-60 pointer-events-none font-inherit text-[14px] whitespace-nowrap overflow-hidden inline-flex items-center"
      aria-hidden="true"
      data-testid="shell-placeholder"
    >
      <span ref={textRef} />
      <span className="shell-cursor" data-testid="shell-cursor" />
    </span>
  );
}

const DOT_FRAMES = ['...', '..', '.', '..'] as const;

function LoadingDots() {
  const [frame, setFrame] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setFrame((f) => (f + 1) % DOT_FRAMES.length), 380);
    return () => clearInterval(id);
  }, []);
  return (
    <span
      className="m-0 block whitespace-pre-wrap break-words text-signal opacity-50"
      aria-hidden="true"
      data-testid="shell-line-loading"
    >
      {DOT_FRAMES[frame]}
    </span>
  );
}

export function InteractiveShell() {
  const { isMobile } = useBreakpoint();
  const lineIdRef = useRef(0);
  // Memoized for a STABLE identity — nextId appears in the dependency arrays
  // of streamQuestion/runCommand below. The ref read is already stable.
  const nextId = useCallback(() => ++lineIdRef.current, []);
  const [history, setHistory] = useState<Line[]>(() => withIds(INITIAL_LINES, nextId));
  const [input, setInput] = useState('');
  const [inputFocused, setInputFocused] = useState(false);
  const [busy, setBusy] = useState(false);
  // The live streaming answer is its own state field, NOT an entry in
  // `history`: a per-chunk update must re-render only the streaming <span>,
  // never the whole feed. `null` means no stream in flight.
  const [streamingText, setStreamingText] = useState<string | null>(null);
  const feedRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const typingRef = useRef(false);
  const mountedRef = useRef(true);
  // Pending requestAnimationFrame handle for the chunk-coalescing flush.
  const rafRef = useRef<number | null>(null);
  // Pending setTimeout handle for the runWithEffect typing animation.
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      if (typingTimerRef.current !== null) clearTimeout(typingTimerRef.current);
    };
  }, []);
  const initializedRef = useRef(false);

  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;
    if (isMobile) setHistory(withIds(MOBILE_INITIAL, nextId));
  }, [isMobile, nextId]);

  // Re-focus the input on desktop whenever a command finishes (busy: true → false).
  // Skipped on mobile — programmatic focus pops the virtual keyboard after chip taps.
  // wasBusyRef prevents firing on initial mount when busy is already false.
  const wasBusyRef = useRef(false);
  useEffect(() => {
    if (!isMobile && wasBusyRef.current && !busy) {
      inputRef.current?.focus();
    }
    wasBusyRef.current = busy;
  }, [busy, isMobile]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: history + streamingText trigger scroll; feedRef is a stable ref
  useEffect(() => {
    if (feedRef.current) {
      feedRef.current.scrollTop = feedRef.current.scrollHeight;
    }
  }, [history, streamingText]);

  const streamQuestion = useCallback(
    async (question: string) => {
      const loadingId = nextId();
      setHistory((h) => [...h, { id: loadingId, kind: 'loading', text: '' }]);

      const clearRaf = () => {
        if (rafRef.current !== null) {
          cancelAnimationFrame(rafRef.current);
          rafRef.current = null;
        }
      };

      const finalize = (finalText: string, errMsg?: string) => {
        clearRaf();
        // Bail if the component unmounted mid-stream — the unmount effect has
        // already cancelled the rAF; setState here would be a no-op warning.
        if (!mountedRef.current) return;
        setStreamingText(null);
        const lines: Line[] = [];
        if (finalText) lines.push({ id: nextId(), kind: 'output', text: finalText });
        if (errMsg) lines.push({ id: nextId(), kind: 'error', text: `error: ${errMsg}` });
        if (!finalText && !errMsg)
          lines.push({ id: nextId(), kind: 'output', text: '(empty response)' });
        setHistory((h) => [...h.filter((l) => l.id !== loadingId), ...lines]);
      };

      try {
        const res = await fetch('/api/ask', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ question }),
        });
        if (!res.ok) {
          const data = (await res.json().catch(() => null)) as { error?: string } | null;
          finalize('', data?.error ?? `HTTP ${res.status}`);
          return;
        }
        if (!res.body) {
          finalize('', 'response body unavailable');
          return;
        }

        const reader = res.body.getReader();
        const dec = new TextDecoder();
        let accumulated = '';
        let pending = '';
        let loadingCleared = false;

        // Coalesce chunk-driven re-renders to at most one per animation frame:
        // a fast token stream cannot trigger a render storm (INP guard). The
        // streaming text lands in `streamingText` state — isolated from
        // `history` — so the flush re-renders only the streaming <span>.
        const scheduleFlush = () => {
          if (rafRef.current !== null) return;
          rafRef.current = requestAnimationFrame(() => {
            rafRef.current = null;
            if (!loadingCleared) {
              setHistory((h) => h.filter((l) => l.id !== loadingId));
              loadingCleared = true;
            }
            setStreamingText(pending);
          });
        };

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          accumulated += dec.decode(value, { stream: true });
          const { displayText } = parseStreamChunk(accumulated);
          pending = displayText;
          if (pending) scheduleFlush();
        }

        const chunkFinal = parseStreamChunk(accumulated);
        finalize(chunkFinal.displayText, chunkFinal.ok ? undefined : chunkFinal.errorMessage);
      } catch (err) {
        finalize('', err instanceof Error ? err.message : String(err));
      }
    },
    [nextId],
  );

  const runCommand = useCallback(
    async (cmd: string) => {
      window.dispatchEvent(new CustomEvent('shell-cmd-run'));
      setHistory((h) => [...h, { id: nextId(), kind: 'prompt', text: `erik@portfolio:~$ ${cmd}` }]);
      setInput('');
      setBusy(true);

      if (cmd === 'clear') {
        setHistory(withIds(isMobile ? MOBILE_INITIAL : INITIAL_LINES, nextId));
        setBusy(false);
        return;
      }

      // Strip optional "ask " prefix — treat as explicit AI query.
      const explicitQuestion = cmd.startsWith('ask ') ? cmd.slice(4).trim() : null;

      if (!explicitQuestion) {
        // Check local commands first.
        const local = SHELL_RESPONSES.find((r) => r.commands.includes(cmd));
        if (local) {
          setHistory((h) => [...h, { id: nextId(), kind: local.kind, text: local.text }]);
          setBusy(false);
          return;
        }
      }

      // Known command not matched — route to Claude.
      await streamQuestion(explicitQuestion ?? cmd);
      setBusy(false);
    },
    [isMobile, nextId, streamQuestion],
  );

  const runWithEffect = useCallback(
    (cmd: string) => {
      if (typingRef.current || busy) return;
      typingRef.current = true;
      let i = 0;
      function tick() {
        typingTimerRef.current = null;
        if (!mountedRef.current) {
          typingRef.current = false;
          return;
        }
        if (i <= cmd.length) {
          setInput(cmd.slice(0, i));
          i++;
          typingTimerRef.current = setTimeout(tick, 30);
        } else {
          typingTimerRef.current = setTimeout(() => {
            typingTimerRef.current = null;
            if (!mountedRef.current) {
              typingRef.current = false;
              return;
            }
            runCommand(cmd);
            typingRef.current = false;
          }, 300);
        }
      }
      tick();
    },
    [busy, runCommand],
  );

  return (
    <div className="interactive-shell bg-[var(--color-surface-shell)] text-xs font-mono leading-[1.65] -m-[var(--ds-space-pad,14px)]">
      <div className="flex items-center gap-[10px] px-[14px] py-2 border-b border-[var(--color-signal-subtle)] text-text-muted text-xs tracking-[0.14em]">
        <WindowChrome size={10} />
        {isMobile ? (
          <span className="ml-auto">ZSH</span>
        ) : (
          <>
            <span>erik@portfolio · /bin/sh</span>
            <span className="ml-auto">SESSION_ID: 0xDEADBEEF</span>
          </>
        )}
      </div>

      <div
        className="px-4 py-[14px] min-h-[220px] max-h-[400px] overflow-y-auto max-md:min-h-[200px] max-md:max-h-[320px] max-md:text-xs"
        ref={feedRef}
        role="log"
        aria-label="shell output"
        aria-live="polite"
        aria-busy={busy}
      >
        {history.map((l) =>
          l.kind === 'loading' ? (
            <LoadingDots key={l.id} />
          ) : (
            <span
              key={l.id}
              className={`m-0 block whitespace-pre-wrap break-words ${KIND_CLASS[l.kind]}`}
              data-kind={l.kind}
            >
              {l.text}
            </span>
          ),
        )}
        {streamingText !== null && (
          <span
            className="m-0 block whitespace-pre-wrap break-words text-text-body opacity-[0.95]"
            data-kind="output"
          >
            {streamingText}
          </span>
        )}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          const cmd = input.trim();
          if (cmd && !busy) runCommand(cmd);
        }}
        className="flex gap-2 items-center px-4 py-2 pb-3 border-t border-[var(--color-signal-quiet)] max-md:px-3 max-md:pb-[10px]"
        data-testid="shell-form"
      >
        <span className="text-text-muted text-[14px] whitespace-nowrap max-md:text-xs">
          erik@portfolio:~$
        </span>
        <div className="flex-1 relative min-w-0">
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onFocus={() => setInputFocused(true)}
            onBlur={() => setInputFocused(false)}
            disabled={busy}
            autoComplete="off"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            className="w-full bg-transparent border-0 outline-none text-text-body font-inherit text-[14px] caret-signal [caret-shape:block] focus-visible:outline-2 focus-visible:outline-signal focus-visible:outline-offset-2 max-md:text-xs"
            aria-label="shell command"
          />
          {!input && !busy && !inputFocused && <AnimatedPlaceholder />}
        </div>
      </form>

      <p
        className="m-0 px-4 py-2 border-t border-[color-mix(in_oklab,var(--color-signal)_14%,transparent)] text-[0.7rem] leading-[1.5] text-[color-mix(in_oklab,var(--color-text-body)_55%,transparent)] max-md:text-[9px]"
        data-testid="shell-privacy-notice"
      >
        Queries are stored 90 days for product improvement. To request deletion, email{' '}
        <a
          href="mailto:erikhenriquealvescunha@gmail.com"
          className="inherit underline underline-offset-2 hover:text-signal"
        >
          erikhenriquealvescunha@gmail.com
        </a>
        . If you are technical, you can also POST your request ID (in the{' '}
        <code className="font-inherit text-signal opacity-80">X-Request-Id</code> response header)
        directly to <code className="font-inherit text-signal opacity-80">/api/log/forget</code>.
      </p>

      {!isMobile && (
        <div
          className="text-text-muted text-xs tracking-[0.1em] leading-[1.8] px-4 py-2 pb-3 border-t border-dashed border-[var(--color-signal-quiet)] opacity-75 max-md:hidden"
          data-testid="shell-commands"
        >
          {'commands: '}
          {COMMANDS.map(({ label, cmd }, i) => (
            <Fragment key={cmd}>
              {i > 0 && ' · '}
              <button
                type="button"
                className="shell-cmd-hint inline bg-none border-none p-0 cursor-pointer font-inherit text-inherit tracking-inherit color-inherit disabled:cursor-default"
                onClick={() => {
                  if (!busy) {
                    setInput(cmd);
                    inputRef.current?.focus();
                  }
                }}
                disabled={busy}
              >
                {label}
              </button>
            </Fragment>
          ))}
          {' · anything else → Claude'}
        </div>
      )}

      {isMobile && (
        <div
          className="flex gap-[6px] flex-wrap px-3 py-2 pb-[10px] border-t border-dashed border-[var(--color-signal-quiet)]"
          role="toolbar"
          aria-label="quick commands"
          onClick={(e) => {
            const cmd = (e.target as HTMLElement).closest<HTMLElement>('[data-cmd]')?.dataset.cmd;
            if (cmd && !busy) runWithEffect(cmd);
          }}
        >
          {COMMANDS.map(({ label, cmd }) => (
            <button
              key={cmd}
              type="button"
              className="border border-[var(--color-signal-subtle)] text-signal px-2 py-1 font-mono text-xs tracking-[0.1em] rounded-[2px] min-h-[28px] inline-flex items-center cursor-pointer bg-transparent active:bg-[var(--color-signal-quiet)]"
              data-cmd={cmd}
              disabled={busy}
            >
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
