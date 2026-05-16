'use client';

import SHELL_RESPONSES from '@/content/shell-commands';
import { STREAM_ERR_SENTINEL } from '@/lib/stream-protocol';
import { useBreakpoint } from '@/lib/use-breakpoint';
import { Fragment, useCallback, useEffect, useRef, useState } from 'react';

type Line = { id: number; kind: 'prompt' | 'output' | 'error' | 'info' | 'loading'; text: string };

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
  { label: 'help',               cmd: 'help' },
  { label: 'whoami',             cmd: 'whoami' },
  { label: 'whoami --recursive', cmd: 'whoami --recursive' },
  { label: 'ls',                 cmd: 'ls' },
  { label: 'cat skills.md',      cmd: 'cat skills.md' },
  { label: 'cat ~/.now',         cmd: 'cat ~/.now' },
  { label: 'contact',            cmd: 'contact' },
  { label: 'face',               cmd: 'face' },
  { label: 'hire',               cmd: 'hire' },
  { label: 'clear',              cmd: 'clear' },
];

function withIds(lines: Omit<Line, 'id'>[], nextId: () => number): Line[] {
  return lines.map((l) => ({ ...l, id: nextId() }));
}

const DOT_FRAMES = ['...', '..', '.', '..'] as const;

function LoadingDots() {
  const [frame, setFrame] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setFrame((f) => (f + 1) % DOT_FRAMES.length), 380);
    return () => clearInterval(id);
  }, []);
  return <span className="shell__line shell__line--loading" aria-hidden="true">{DOT_FRAMES[frame]}</span>;
}

export function InteractiveShell() {
  const { isMobile } = useBreakpoint();
  const lineIdRef = useRef(0);
  const nextId = useCallback(() => ++lineIdRef.current, []);
  const [history, setHistory] = useState<Line[]>(() => withIds(INITIAL_LINES, nextId));
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const feedRef = useRef<HTMLDivElement>(null);
  const typingRef = useRef(false);
  const initializedRef = useRef(false);

  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;
    if (isMobile) setHistory(withIds(MOBILE_INITIAL, nextId));
  }, [isMobile, nextId]);

  useEffect(() => {
    if (feedRef.current) {
      feedRef.current.scrollTop = feedRef.current.scrollHeight;
    }
  }, [history]);

  const streamQuestion = useCallback(async (question: string) => {
    // Insert loading line immediately — before the fetch — so dots appear on Enter.
    const streamId = nextId();
    setHistory((h) => [...h, { id: streamId, kind: 'loading', text: '' }]);

    const replaceWithError = (msg: string) => {
      setHistory((h) => h.map((l) => l.id === streamId ? { ...l, kind: 'error' as const, text: `error: ${msg}` } : l));
    };

    try {
      const res = await fetch('/api/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        replaceWithError(data?.error ?? `HTTP ${res.status}`);
        return;
      }
      if (!res.body) {
        replaceWithError('response body unavailable');
        return;
      }
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let accumulated = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        accumulated += dec.decode(value, { stream: true });
        const sentinelIdx = accumulated.indexOf(STREAM_ERR_SENTINEL);
        const displayText = (sentinelIdx !== -1 ? accumulated.slice(0, sentinelIdx) : accumulated).trim();
        setHistory((h) => {
          const idx = h.findIndex((l) => l.id === streamId);
          if (idx === -1) return h;
          const next = [...h];
          const item = next[idx];
          if (!item) return h;
          next[idx] = { ...item, kind: displayText ? 'output' : 'loading', text: displayText };
          return next;
        });
      }

      const sentinelIdx = accumulated.indexOf(STREAM_ERR_SENTINEL);
      if (sentinelIdx !== -1) {
        const cleanText = accumulated.slice(0, sentinelIdx).trim();
        const errMsg = accumulated.slice(sentinelIdx + STREAM_ERR_SENTINEL.length).trim() || 'upstream error';
        setHistory((h) => {
          const idx = h.findIndex((l) => l.id === streamId);
          if (idx === -1) return h;
          const next = [...h];
          const item = next[idx];
          if (!item) return h;
          next[idx] = { ...item, text: cleanText || '(truncated)' };
          return next;
        });
        setHistory((h) => [...h, { id: nextId(), kind: 'error', text: `error: ${errMsg}` }]);
      } else if (!accumulated.trim()) {
        setHistory((h) => {
          const idx = h.findIndex((l) => l.id === streamId);
          if (idx === -1) return h;
          const next = [...h];
          const item = next[idx];
          if (!item) return h;
          next[idx] = { ...item, text: '(empty response)' };
          return next;
        });
      }
    } catch (err) {
      replaceWithError((err as Error).message);
    }
  }, [nextId]);

  const runCommand = useCallback(async (cmd: string) => {
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
  }, [isMobile, nextId, streamQuestion]);

  const runWithEffect = useCallback((cmd: string) => {
    if (typingRef.current || busy) return;
    typingRef.current = true;
    let i = 0;
    function tick() {
      if (i <= cmd.length) {
        setInput(cmd.slice(0, i));
        i++;
        setTimeout(tick, 30);
      } else {
        setTimeout(() => {
          runCommand(cmd);
          typingRef.current = false;
        }, 300);
      }
    }
    tick();
  }, [busy, runCommand]);

  return (
    <div className="shell">
      <div className="shell__bar">
        <div className="shell__bar-dots" aria-hidden="true">
          <span className="shell__bar-dot shell__bar-dot--red" />
          <span className="shell__bar-dot shell__bar-dot--yellow" />
          <span className="shell__bar-dot shell__bar-dot--green" />
        </div>
        {isMobile ? (
          <span className="shell__bar-title">ZSH</span>
        ) : (
          <>
            <span>erik@portfolio · /bin/sh</span>
            <span className="shell__bar-title">SESSION_ID: 0xDEADBEEF</span>
          </>
        )}
      </div>

      <div className="shell__feed" ref={feedRef} role="log" aria-label="shell output" aria-live="polite" aria-busy={busy}>
        {history.map((l) =>
          l.kind === 'loading' ? (
            <LoadingDots key={l.id} />
          ) : (
            <span key={l.id} className={`shell__line shell__line--${l.kind}`}>
              {l.text}
            </span>
          ),
        )}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          const cmd = input.trim();
          if (cmd && !busy) runCommand(cmd);
        }}
        className="shell__form"
      >
        <span className="shell__prompt">erik@portfolio:~$</span>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={busy}
          autoComplete="off"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          placeholder="type a command or ask anything…"
          className="shell__input"
          aria-label="shell command"
        />
      </form>

      {!isMobile && (
        <div className="shell__commands">
          <span className="shell__commands-prefix">{'commands: '}</span>
          {COMMANDS.map(({ label, cmd }, i) => (
            <Fragment key={cmd}>
              {i > 0 && <span className="shell__commands-sep">{' · '}</span>}
              <button
                type="button"
                className="shell__cmd-hint"
                onClick={() => { if (!busy) runWithEffect(cmd); }}
                disabled={busy}
              >
                {label}
              </button>
            </Fragment>
          ))}
          <span className="shell__commands-tail">{' · anything else → Claude'}</span>
        </div>
      )}

      {isMobile && (
        <div
          className="shell__chips"
          role="toolbar"
          aria-label="quick commands"
          onClick={(e) => {
            const cmd = (e.target as HTMLElement).closest<HTMLElement>('[data-cmd]')?.dataset.cmd;
            if (cmd && !busy) runWithEffect(cmd);
          }}
        >
          {COMMANDS.map(({ label, cmd }) => (
            <button key={cmd} type="button" className="shell__chip" data-cmd={cmd}>
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
