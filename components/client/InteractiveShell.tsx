'use client';

import SHELL_RESPONSES from '@/content/shell-commands';
import { STREAM_ERR_SENTINEL } from '@/lib/stream-protocol';
import { useBreakpoint } from '@/lib/use-breakpoint';
import { useCallback, useEffect, useRef, useState } from 'react';

type Line = { id: number; kind: 'prompt' | 'output' | 'error' | 'info'; text: string };

const INITIAL_LINES: Omit<Line, 'id'>[] = [
  {
    kind: 'info',
    text: `Connected. Type help to list commands. Try ask "what's your strongest project?" for an LLM answer.`,
  },
];

const MOBILE_INITIAL: Omit<Line, 'id'>[] = [
  { kind: 'info', text: 'welcome. type help or tap a chip below.' },
];

const CHIPS: { label: string; cmd: string }[] = [
  { label: 'whoami', cmd: 'whoami' },
  { label: 'ls', cmd: 'ls' },
  { label: 'skills', cmd: 'cat skills.md' },
  { label: '.now', cmd: 'cat ~/.now' },
  { label: 'contact', cmd: 'contact' },
  { label: 'hire', cmd: 'hire' },
  { label: 'help', cmd: 'help' },
  { label: 'clear', cmd: 'clear' },
];

function withIds(lines: Omit<Line, 'id'>[], nextId: () => number): Line[] {
  return lines.map((l) => ({ ...l, id: nextId() }));
}

export function InteractiveShell() {
  const { isMobile } = useBreakpoint();
  const lineIdRef = useRef(0);
  const nextId = useCallback(() => ++lineIdRef.current, []);
  // Always seed with INITIAL_LINES (SSR-safe). Swap to mobile variant once the
  // client knows the breakpoint — avoids hydration mismatch from reading
  // isMobile during the initializer (which only runs once on mount).
  const [history, setHistory] = useState<Line[]>(() => withIds(INITIAL_LINES, nextId));
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const feedRef = useRef<HTMLDivElement>(null);
  const initializedRef = useRef(false);

  // Swap initial content when breakpoint resolves on client.
  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;
    if (isMobile) setHistory(withIds(MOBILE_INITIAL, nextId));
  }, [isMobile, nextId]);

  useEffect(() => {
    if (feedRef.current) {
      feedRef.current.scrollTop = feedRef.current.scrollHeight;
    }
  });

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

    if (cmd.startsWith('ask ')) {
      const question = cmd.slice(4).trim();
      try {
        const res = await fetch('/api/ask', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ question }),
        });
        if (!res.ok) {
          const data = (await res.json().catch(() => null)) as { error?: string } | null;
          const msg = data?.error ?? `HTTP ${res.status}`;
          setHistory((h) => [...h, { id: nextId(), kind: 'error', text: `error: ${msg}` }]);
        } else if (res.body) {
          // Progressive stream reading — each token appends to the same line.
          // The server appends STREAM_ERR_SENTINEL if Anthropic throws mid-stream;
          // strip it from the live display and surface an error line on close.
          const streamId = nextId();
          setHistory((h) => [...h, { id: streamId, kind: 'output', text: '' }]);
          const reader = res.body.getReader();
          const dec = new TextDecoder();
          let accumulated = '';
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            accumulated += dec.decode(value, { stream: true });
            // Strip any trailing sentinel so it never surfaces in the live output.
            const sentinelIdx = accumulated.indexOf(STREAM_ERR_SENTINEL);
            const displayText = sentinelIdx !== -1 ? accumulated.slice(0, sentinelIdx) : accumulated;
            setHistory((h) => {
              const idx = h.findIndex((l) => l.id === streamId);
              if (idx === -1) return h;
              const next = [...h];
              const item = next[idx];
              if (!item) return h;
              next[idx] = { ...item, text: displayText.trim() || '...' };
              return next;
            });
          }
          // Post-stream: distinguish a clean close from a mid-stream failure.
          const sentinelIdx = accumulated.indexOf(STREAM_ERR_SENTINEL);
          if (sentinelIdx !== -1) {
            const cleanText = accumulated.slice(0, sentinelIdx).trim();
            const errMsg =
              accumulated.slice(sentinelIdx + STREAM_ERR_SENTINEL.length).trim() || 'upstream error';
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
        } else {
          setHistory((h) => [...h, { id: nextId(), kind: 'error', text: 'error: response body unavailable' }]);
        }
      } catch (err) {
        setHistory((h) => [...h, { id: nextId(), kind: 'error', text: `error: ${(err as Error).message}` }]);
      }
    } else {
      setHistory((h) => [...h, ...withIds(localCommand(cmd), nextId)]);
    }
    setBusy(false);
  }, [isMobile, nextId]);

  return (
    <div className="shell">
      <div className="shell__bar">
        <div className="shell__bar-dots" aria-hidden="true">
          <span className="shell__bar-dot" style={{ background: '#FF5F57' }} />
          <span className="shell__bar-dot" style={{ background: '#FEBC2E' }} />
          <span className="shell__bar-dot" style={{ background: '#28C840' }} />
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

      <div className="shell__feed" ref={feedRef} role="log" aria-live="polite">
        {history.map((l) => (
          <span key={l.id} className={`shell__line shell__line--${l.kind}`}>
            {l.text}
          </span>
        ))}
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
          placeholder="type a command…"
          className="shell__input"
          aria-label="shell command"
        />
      </form>

      {isMobile && (
        <div className="shell__chips" role="toolbar" aria-label="quick commands">
          {CHIPS.map(({ label, cmd }) => (
            <button
              key={cmd}
              type="button"
              className="shell__chip"
              onClick={() => !busy && runCommand(cmd)}
            >
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function localCommand(cmd: string): Omit<Line, 'id'>[] {
  const entry = SHELL_RESPONSES.find((r) => r.commands.includes(cmd));
  if (entry) return [{ kind: entry.kind, text: entry.text }];
  return [{ kind: 'error', text: `command not found: ${cmd}. type 'help'` }];
}
