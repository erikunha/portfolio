'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import SHELL_RESPONSES from '@/content/shell-commands';
import { SHELL_LIMITS, ShellCommand, ShellLineKind, shellUi } from '@/content/shell-ui';
import { shellChrome } from '@/content/terminal-chrome';
import { WindowChrome } from '@/design-system';
import { readMotion } from '@/lib/motion';
import { parseStreamChunk } from '@/lib/stream-protocol';
import { useBreakpoint } from '@/lib/use-breakpoint.client';

type LineKind = (typeof ShellLineKind)[keyof typeof ShellLineKind];
type Line = { id: number; kind: LineKind; text: string; ai?: boolean };
type ActiveRequest = { stop: () => void; dispose: () => void };

const KIND_CLASS: Record<LineKind, string> = {
  [ShellLineKind.Prompt]: 'shell-line-prompt',
  [ShellLineKind.Output]: 'shell-line-output',
  [ShellLineKind.Error]: 'shell-line-error',
  [ShellLineKind.Info]: 'shell-line-info',
  [ShellLineKind.Loading]: 'shell-line-loading',
  [ShellLineKind.Reference]: 'shell-line-reference',
};
const Key = {
  Up: 'ArrowUp',
  Down: 'ArrowDown',
  Left: 'ArrowLeft',
  Right: 'ArrowRight',
  Home: 'Home',
  End: 'End',
} as const;
const CopyState = { Idle: 'idle', Pending: 'pending', Copied: 'copied', Failed: 'failed' } as const;
const PlaceholderPhase = { Type: 'type', Hold: 'hold', Back: 'back' } as const;
const ASK_ENDPOINT = '/api/ask';
const SHELL_COMMAND_EVENT = 'shell-cmd-run';
const RATE_LIMIT_STATUS = 429;
const TIMEOUT_ERROR_NAME = 'TimeoutError';
const WINDOW_DOT_SIZE = 10;

function bounded(lines: Line[]): Line[] {
  return lines.slice(-SHELL_LIMITS.logEntries);
}

function AnimatedPlaceholder() {
  const textRef = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const node = textRef.current;
    if (!node) return;
    if (!readMotion()) {
      node.textContent = shellUi.placeholder;
      return;
    }
    let index = 0;
    let character = 0;
    let phase: (typeof PlaceholderPhase)[keyof typeof PlaceholderPhase] = PlaceholderPhase.Type;
    let timer: ReturnType<typeof setTimeout>;
    function tick() {
      if (!node) return;
      const suggestion = shellUi.suggestions[index % shellUi.suggestions.length] ?? '';
      if (phase === PlaceholderPhase.Type) {
        node.textContent = suggestion.slice(0, ++character);
        if (character >= suggestion.length) phase = PlaceholderPhase.Hold;
        timer = setTimeout(
          tick,
          phase === PlaceholderPhase.Hold
            ? SHELL_LIMITS.placeholderHoldMs
            : SHELL_LIMITS.placeholderTypeMs,
        );
      } else if (phase === PlaceholderPhase.Hold) {
        phase = PlaceholderPhase.Back;
        timer = setTimeout(tick, SHELL_LIMITS.placeholderBackMs);
      } else {
        node.textContent = suggestion.slice(0, --character);
        if (character <= 0) {
          index++;
          phase = PlaceholderPhase.Type;
        }
        timer = setTimeout(
          tick,
          character <= 0 ? SHELL_LIMITS.placeholderPauseMs : SHELL_LIMITS.placeholderBackMs,
        );
      }
    }
    tick();
    return () => clearTimeout(timer);
  }, []);
  return (
    <span className="shell-placeholder" aria-hidden="true" data-testid="shell-placeholder">
      <span ref={textRef} />
      <span className="shell-cursor" data-testid="shell-cursor" />
    </span>
  );
}

function ResponseReference({
  requestId,
  announce,
}: {
  requestId: string;
  announce: (text: string) => void;
}) {
  const [state, setState] = useState<(typeof CopyState)[keyof typeof CopyState]>(CopyState.Idle);
  const mounted = useRef(true);
  const copying = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  async function copy() {
    if (copying.current) return;
    copying.current = true;
    setState(CopyState.Pending);
    try {
      await navigator.clipboard.writeText(requestId);
      if (!mounted.current) return;
      setState(CopyState.Copied);
      announce(shellUi.copiedAnnouncement);
    } catch {
      if (!mounted.current) return;
      setState(CopyState.Failed);
      announce(shellUi.copyFailedAnnouncement);
    } finally {
      copying.current = false;
    }
  }
  const label =
    state === CopyState.Copied
      ? shellUi.copied
      : state === CopyState.Failed
        ? shellUi.copyFailed
        : shellUi.copy;
  return (
    <span className="shell-reference" data-testid="shell-reference">
      <span>
        {shellUi.referencePrefix} <code>{requestId}</code>
      </span>
      <button
        type="button"
        className="shell-control"
        aria-label={`${shellUi.copyLabel} ${requestId}`}
        aria-disabled={state === CopyState.Pending}
        onClick={copy}
      >
        {label}
      </button>
    </span>
  );
}

export function InteractiveShell() {
  const { isMobile } = useBreakpoint();
  const accuracyId = useId();
  const lineId = useRef(0);
  const nextId = useCallback(() => ++lineId.current, []);
  const initialLines = useCallback(
    (): Line[] => [
      {
        id: nextId(),
        kind: ShellLineKind.Info,
        text: isMobile ? shellUi.mobileWelcome : shellUi.welcome,
      },
    ],
    [isMobile, nextId],
  );
  const [history, setHistory] = useState<Line[]>(initialLines);
  const [input, setInput] = useState('');
  const [inputFocused, setInputFocused] = useState(false);
  const [busy, setBusy] = useState(false);
  const [streamingText, setStreamingText] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState({ id: 0, text: '' });
  const [toolbarIndex, setToolbarIndex] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const feedRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const toolbarButtons = useRef<(HTMLButtonElement | null)[]>([]);
  const activeRequest = useRef<ActiveRequest | null>(null);
  const mountedRef = useRef(true);
  const rafRef = useRef<number | null>(null);
  const commands = useRef<string[]>([]);
  const historyIndex = useRef(0);
  const draft = useRef('');
  const initializedRef = useRef(false);

  const announce = useCallback((text: string) => {
    setAnnouncement((previous) => ({ id: previous.id + 1, text }));
  }, []);
  const focusInput = useCallback(() => inputRef.current?.focus({ preventScroll: true }), []);
  const clearFrame = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      activeRequest.current?.dispose();
      activeRequest.current = null;
      clearFrame();
    };
  }, [clearFrame]);

  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;
    if (isMobile) setHistory(initialLines());
  }, [isMobile, initialLines]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: history and streamingText trigger scroll on the stable feed ref
  useEffect(() => {
    if (feedRef.current) feedRef.current.scrollTop = feedRef.current.scrollHeight;
  }, [history, streamingText]);

  const streamQuestion = useCallback(
    async (question: string, command: string) => {
      const controller = new AbortController();
      const loadingId = nextId();
      let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
      let requestId: string | null = null;
      let accumulated = '';
      let receivedText = false;
      let settled = false;
      let timer: ReturnType<typeof setTimeout> | undefined;
      setBusy(true);
      setHistory((lines) =>
        bounded([...lines, { id: loadingId, kind: ShellLineKind.Loading, text: '' }]),
      );
      announce(shellUi.thinking);

      function releaseTransport() {
        controller.abort();
        void reader?.cancel().catch(() => undefined);
      }
      function finish(text: string, message?: string, error = false) {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        clearFrame();
        if (!mountedRef.current) return;
        activeRequest.current = null;
        const lines: Line[] = [];
        if (text) lines.push({ id: nextId(), kind: ShellLineKind.Output, text, ai: true });
        if (message) {
          lines.push({
            id: nextId(),
            kind: error ? ShellLineKind.Error : ShellLineKind.Info,
            text: error ? `${shellUi.errorPrefix} ${message}` : message,
          });
        }
        if (!text && !message) {
          lines.push({ id: nextId(), kind: ShellLineKind.Output, text: shellUi.empty });
        }
        if (requestId) lines.push({ id: nextId(), kind: ShellLineKind.Reference, text: requestId });
        setHistory((previous) =>
          bounded([...previous.filter((line) => line.id !== loadingId), ...lines]),
        );
        setStreamingText(null);
        setBusy(false);
        if (error || (message && !text)) setInput((value) => value || command);
        announce(message ?? shellUi.complete);
        if (rootRef.current?.contains(document.activeElement)) focusInput();
      }
      function interrupt(message: string, error = false) {
        const text = parseStreamChunk(accumulated).displayText;
        finish(text, message, error);
        releaseTransport();
      }
      activeRequest.current = {
        stop: () =>
          interrupt(
            parseStreamChunk(accumulated).displayText ? shellUi.stoppedPartial : shellUi.stoppedBefore,
          ),
        dispose: () => {
          settled = true;
          clearTimeout(timer);
          releaseTransport();
        },
      };
      timer = setTimeout(() => interrupt(shellUi.timeout, true), SHELL_LIMITS.requestTimeoutMs);

      try {
        const response = await fetch(ASK_ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ question }),
          signal: controller.signal,
        });
        if (settled) {
          void response.body?.cancel().catch(() => undefined);
          return;
        }
        requestId = response.headers.get(shellUi.requestIdHeader);
        if (!response.ok) {
          const data = (await response.json().catch(() => null)) as {
            error?: string | { message?: string };
          } | null;
          const detail = typeof data?.error === 'string' ? data.error : data?.error?.message;
          const message = detail || `${shellUi.httpErrorPrefix} ${response.status}`;
          finish(
            '',
            response.status === RATE_LIMIT_STATUS ? `${message}. ${shellUi.localAvailable}` : message,
            true,
          );
          return;
        }
        if (!response.body) {
          finish('', shellUi.bodyUnavailable, true);
          return;
        }
        reader = response.body.getReader();
        const decoder = new TextDecoder();
        while (!settled) {
          const { done, value } = await reader.read();
          if (settled) return;
          accumulated += done ? decoder.decode() : decoder.decode(value, { stream: true });
          const parsed = parseStreamChunk(accumulated);
          if (done) {
            finish(parsed.displayText, parsed.ok ? undefined : parsed.errorMessage, !parsed.ok);
            return;
          }
          if (parsed.displayText) {
            if (!receivedText) {
              receivedText = true;
              setHistory((lines) => lines.filter((line) => line.id !== loadingId));
              announce(shellUi.started);
            }
            if (rafRef.current === null) {
              rafRef.current = requestAnimationFrame(() => {
                rafRef.current = null;
                if (!settled && mountedRef.current) {
                  setStreamingText(parseStreamChunk(accumulated).displayText);
                }
              });
            }
          }
        }
      } catch (error) {
        if (settled) return;
        const message = !navigator.onLine
          ? shellUi.offline
          : error instanceof Error && error.name === TIMEOUT_ERROR_NAME
            ? shellUi.timeout
            : error instanceof TypeError
              ? shellUi.networkError
              : error instanceof Error
                ? error.message
                : String(error);
        finish(parseStreamChunk(accumulated).displayText, message, true);
      } finally {
        reader?.releaseLock();
      }
    },
    [announce, clearFrame, focusInput, nextId],
  );

  const runCommand = useCallback(
    (raw: string) => {
      if (activeRequest.current) {
        announce(shellUi.busy);
        return;
      }
      const command = raw.trim().replace(/\s+/g, ' ');
      if (!command) return;
      commands.current = [...commands.current, command].slice(-SHELL_LIMITS.commandHistory);
      historyIndex.current = commands.current.length;
      draft.current = '';
      window.dispatchEvent(new CustomEvent(SHELL_COMMAND_EVENT));
      setHistory((lines) =>
        bounded([
          ...lines,
          { id: nextId(), kind: ShellLineKind.Prompt, text: `${shellUi.prompt} ${command}` },
        ]),
      );
      setInput('');
      const key = command.toLowerCase();
      if (key === ShellCommand.Clear) {
        setHistory(initialLines());
        announce(shellUi.cleared);
        focusInput();
        return;
      }
      const explicitQuestion = key.startsWith(ShellCommand.AskPrefix)
        ? command.slice(ShellCommand.AskPrefix.length).trim()
        : null;
      const local =
        !explicitQuestion && SHELL_RESPONSES.find((entry) => entry.commands.includes(key));
      if (local) {
        setHistory((lines) =>
          bounded([...lines, { id: nextId(), kind: local.kind, text: local.text }]),
        );
        announce(shellUi.commandComplete);
        focusInput();
        return;
      }
      void streamQuestion(explicitQuestion ?? command, command);
    },
    [announce, focusInput, initialLines, nextId, streamQuestion],
  );

  return (
    <div ref={rootRef} className="interactive-shell">
      <div className="shell-chrome">
        <WindowChrome size={WINDOW_DOT_SIZE} />
        {isMobile ? (
          <span className="shell-chrome-tag">
            {shellChrome.mobileLabel ?? shellChrome.rightTag}
          </span>
        ) : (
          <>
            <span>{shellChrome.promptLabel}</span>
            <span className="shell-chrome-tag">{shellChrome.rightTag}</span>
          </>
        )}
      </div>
      <div
        ref={feedRef}
        className="shell-feed"
        role="log"
        aria-label={shellUi.outputLabel}
        aria-live="polite"
        aria-busy={busy}
        tabIndex={0}
      >
        {history.map((line) =>
          line.kind === ShellLineKind.Loading ? (
            <span
              key={line.id}
              className="shell-line shell-line-loading"
              aria-hidden="true"
              data-testid="shell-line-loading"
            >
              {shellUi.aiLabel}: {shellUi.thinking}
            </span>
          ) : (
            <span
              key={line.id}
              className={`shell-line ${KIND_CLASS[line.kind]}`}
              data-kind={line.kind}
            >
              {line.kind === ShellLineKind.Reference ? (
                <ResponseReference requestId={line.text} announce={announce} />
              ) : (
                <>
                  {line.ai && <span className="shell-ai-label">{shellUi.aiLabel}: </span>}
                  {line.text}
                </>
              )}
            </span>
          ),
        )}
        {streamingText !== null && (
          <span className="shell-line shell-line-output" data-kind={ShellLineKind.Output}>
            <span className="shell-ai-label">{shellUi.aiLabel}: </span>
            {streamingText}
          </span>
        )}
      </div>
      {busy && (
        <div className="shell-progress">
          <span aria-hidden="true">
            {shellUi.aiLabel}
            <span className="shell-cursor" />
          </span>
          <button
            className="shell-control"
            type="button"
            aria-label={shellUi.stopLabel}
            onClick={() => {
              activeRequest.current?.stop();
              focusInput();
            }}
          >
            {shellUi.stop}
          </button>
        </div>
      )}
      <form
        className="shell-form"
        data-testid="shell-form"
        onSubmit={(event) => {
          event.preventDefault();
          runCommand(input);
        }}
      >
        <span className="shell-prompt">{shellUi.prompt}</span>
        <div className="shell-input-wrap">
          <input
            ref={inputRef}
            className="shell-input"
            name="command"
            enterKeyHint="send"
            value={input}
            onChange={(event) => {
              setInput(event.target.value);
              historyIndex.current = commands.current.length;
              draft.current = event.target.value;
            }}
            onFocus={() => setInputFocused(true)}
            onBlur={() => setInputFocused(false)}
            onKeyDown={(event) => {
              if (
                event.nativeEvent.isComposing ||
                event.altKey ||
                event.ctrlKey ||
                event.metaKey ||
                event.shiftKey ||
                (event.key !== Key.Up && event.key !== Key.Down)
              ) {
                return;
              }
              event.preventDefault();
              if (historyIndex.current === commands.current.length) draft.current = input;
              historyIndex.current = Math.max(
                0,
                Math.min(
                  commands.current.length,
                  historyIndex.current + (event.key === Key.Up ? -1 : 1),
                ),
              );
              setInput(commands.current[historyIndex.current] ?? draft.current);
            }}
            autoComplete="off"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            aria-label={shellUi.inputLabel}
            aria-describedby={accuracyId}
          />
          {!input && !busy && !inputFocused && <AnimatedPlaceholder />}
        </div>
      </form>
      <p id={accuracyId} className="shell-ai-notice">
        {shellUi.accuracy}
      </p>
      <p className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        <span key={announcement.id}>{announcement.text}</span>
      </p>
      <div className="shell-privacy-notice" data-testid="shell-privacy-notice">
        <p>
          {shellUi.privacy} <a href={shellUi.emailHref}>{shellUi.email}</a>.
        </p>
        <p>
          {shellUi.technicalPrivacy} <code>{shellUi.requestIdHeader}</code>{' '}
          {shellUi.technicalPrivacySuffix} <code>{shellUi.forgetEndpoint}</code>.
        </p>
      </div>
      <div
        className="shell-toolbar"
        role="toolbar"
        aria-label={shellUi.toolbarLabel}
        data-testid="shell-commands"
      >
        {shellUi.commands.map((command, index) => (
          <button
            key={command}
            ref={(node) => {
              toolbarButtons.current[index] = node;
            }}
            type="button"
            className="shell-control shell-cmd-hint"
            data-cmd={command}
            tabIndex={index === toolbarIndex ? 0 : -1}
            aria-disabled={busy}
            onFocus={() => setToolbarIndex(index)}
            onClick={() => runCommand(command)}
            onKeyDown={(event) => {
              if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
              let target = index;
              if (event.key === Key.Home) target = 0;
              else if (event.key === Key.End) target = shellUi.commands.length - 1;
              else if (event.key === Key.Right) target = (index + 1) % shellUi.commands.length;
              else if (event.key === Key.Left) {
                target = (index - 1 + shellUi.commands.length) % shellUi.commands.length;
              } else return;
              event.preventDefault();
              setToolbarIndex(target);
              toolbarButtons.current[target]?.focus();
            }}
          >
            {command}
          </button>
        ))}
        <span className="shell-command-hint">{shellUi.commandHint}</span>
      </div>
    </div>
  );
}
