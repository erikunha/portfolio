'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import type { TerminalChrome } from '@/content/schemas';
import SHELL_RESPONSES from '@/content/shell-commands';
import { SHELL_LIMITS, ShellCommand, ShellLineKind, type ShellUi } from '@/content/shell-ui';
import type { SiteLocale } from '@/content/site-locale';
import { WindowChrome } from '@/design-system';
import { readMotion } from '@/lib/motion';
import { ASK_LOCALE_HEADER, parseStreamChunk } from '@/lib/stream-protocol';
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
  Enter: 'Enter',
} as const;
const CopyState = { Idle: 'idle', Pending: 'pending', Copied: 'copied', Failed: 'failed' } as const;
const PlaceholderPhase = { Type: 'type', Hold: 'hold', Back: 'back' } as const;
const ASK_ENDPOINT = '/api/ask';
const SHELL_COMMAND_EVENT = 'shell-cmd-run';
const RATE_LIMIT_STATUS = 429;
const COMPOSITION_KEYCODE = 229;
const WINDOW_DOT_SIZE = 10;

function bounded(lines: Line[]): Line[] {
  return lines.slice(-SHELL_LIMITS.logEntries);
}

function AnimatedPlaceholder({ ui }: { ui: ShellUi }) {
  const textRef = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const node = textRef.current;
    if (!node) return;
    if (!readMotion()) {
      node.textContent = ui.placeholder;
      return;
    }
    let index = 0;
    let character = 0;
    let phase: (typeof PlaceholderPhase)[keyof typeof PlaceholderPhase] = PlaceholderPhase.Type;
    let timer: ReturnType<typeof setTimeout>;
    function tick() {
      if (!node) return;
      const suggestion = ui.suggestions[index % ui.suggestions.length] ?? '';
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
  }, [ui]);
  return (
    <span className="shell-placeholder" aria-hidden="true" data-testid="shell-placeholder">
      <span ref={textRef} />
      <span className="shell-cursor" data-testid="shell-cursor" />
    </span>
  );
}

function StaticPlaceholder({ ui }: { ui: ShellUi }) {
  return (
    <span className="shell-placeholder" aria-hidden="true" data-testid="shell-placeholder">
      {ui.placeholder}
    </span>
  );
}

function ResponseReference({
  ui,
  requestId,
  announce,
}: {
  ui: ShellUi;
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
      announce(ui.copiedAnnouncement);
    } catch {
      if (!mounted.current) return;
      setState(CopyState.Failed);
      announce(ui.copyFailedAnnouncement);
    } finally {
      copying.current = false;
    }
  }
  const label =
    state === CopyState.Copied ? ui.copied : state === CopyState.Failed ? ui.copyFailed : ui.copy;
  return (
    <span className="shell-reference" data-testid="shell-reference">
      <span>
        {ui.referencePrefix} <code>{requestId}</code>
      </span>
      <button
        type="button"
        className="shell-control"
        aria-label={`${label} ${ui.referencePrefix} ${requestId}`}
        aria-disabled={state === CopyState.Pending}
        onClick={copy}
      >
        {label}
      </button>
    </span>
  );
}

export function InteractiveShell({
  locale,
  ui,
  chrome,
}: {
  locale: SiteLocale;
  ui: ShellUi;
  chrome: TerminalChrome;
}) {
  const { isMobile } = useBreakpoint();
  const accuracyId = useId();
  const lineId = useRef(0);
  const nextId = useCallback(() => ++lineId.current, []);
  const initialLines = useCallback(
    (): Line[] => [
      {
        id: nextId(),
        kind: ShellLineKind.Info,
        text: isMobile ? ui.mobileWelcome : ui.welcome,
      },
    ],
    [isMobile, nextId, ui],
  );
  const [history, setHistory] = useState<Line[]>(initialLines);
  const [input, setInput] = useState('');
  const [inputFocused, setInputFocused] = useState(false);
  const [busy, setBusy] = useState(false);
  const [streamingText, setStreamingText] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState({ id: 0, text: '' });
  const [toolbarIndex, setToolbarIndex] = useState(0);
  const stopRef = useRef<HTMLButtonElement>(null);
  const followOutputRef = useRef(true);
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
    if (feedRef.current && followOutputRef.current) {
      feedRef.current.scrollTop = feedRef.current.scrollHeight;
    }
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
      announce(ui.thinking);

      function armIdleTimer() {
        clearTimeout(timer);
        timer = setTimeout(() => interrupt(ui.timeout, true), SHELL_LIMITS.requestTimeoutMs);
      }
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
            text: error ? `${ui.errorPrefix} ${message}` : message,
          });
        }
        if (!text && !message) {
          lines.push({ id: nextId(), kind: ShellLineKind.Output, text: ui.empty });
        }
        if (requestId) lines.push({ id: nextId(), kind: ShellLineKind.Reference, text: requestId });
        setHistory((previous) =>
          bounded([...previous.filter((line) => line.id !== loadingId), ...lines]),
        );
        setStreamingText(null);
        setBusy(false);
        if (message) setInput((value) => value || command);
        announce(message ?? ui.complete);
        if (stopRef.current === document.activeElement) focusInput();
      }
      function interrupt(message: string, error = false) {
        const text = parseStreamChunk(accumulated).displayText;
        finish(text, message, error);
        releaseTransport();
      }
      activeRequest.current = {
        stop: () =>
          interrupt(
            parseStreamChunk(accumulated).displayText ? ui.stoppedPartial : ui.stoppedBefore,
          ),
        dispose: () => {
          settled = true;
          clearTimeout(timer);
          releaseTransport();
        },
      };
      armIdleTimer();

      try {
        const response = await fetch(ASK_ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', [ASK_LOCALE_HEADER]: locale },
          body: JSON.stringify({ question, locale }),
          signal: controller.signal,
        });
        if (settled) {
          void response.body?.cancel().catch(() => undefined);
          return;
        }
        requestId = response.headers.get(ui.requestIdHeader);
        if (!response.ok) {
          const data = (await response.json().catch(() => null)) as {
            error?: string | { message?: string };
          } | null;
          const detail = typeof data?.error === 'string' ? data.error : data?.error?.message;
          const message = detail || `${ui.httpErrorPrefix} ${response.status}`;
          finish(
            '',
            response.status === RATE_LIMIT_STATUS ? `${message}. ${ui.localAvailable}` : message,
            true,
          );
          return;
        }
        if (!response.body) {
          finish('', ui.bodyUnavailable, true);
          return;
        }
        reader = response.body.getReader();
        const decoder = new TextDecoder();
        while (!settled) {
          const { done, value } = await reader.read();
          if (settled) return;
          armIdleTimer();
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
              announce(ui.started);
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
          ? ui.offline
          : error instanceof TypeError
            ? ui.networkError
            : error instanceof Error
              ? error.message
              : String(error);
        finish(parseStreamChunk(accumulated).displayText, message, true);
      } finally {
        reader?.releaseLock();
      }
    },
    [announce, clearFrame, focusInput, nextId, ui, locale],
  );

  const runCommand = useCallback(
    (raw: string) => {
      if (activeRequest.current) {
        announce(ui.busy);
        return;
      }
      const command = raw.trim().replace(/\s+/g, ' ');
      if (!command) return;
      followOutputRef.current = true;
      commands.current = [...commands.current, command].slice(-SHELL_LIMITS.commandHistory);
      historyIndex.current = commands.current.length;
      draft.current = '';
      window.dispatchEvent(new CustomEvent(SHELL_COMMAND_EVENT));
      setHistory((lines) =>
        bounded([
          ...lines,
          { id: nextId(), kind: ShellLineKind.Prompt, text: `${ui.prompt} ${command}` },
        ]),
      );
      setInput('');
      const key = command.toLowerCase();
      if (key === ShellCommand.Clear) {
        setHistory(initialLines());
        announce(ui.cleared);
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
        announce(ui.commandComplete);
        focusInput();
        return;
      }
      void streamQuestion(explicitQuestion ?? command, command);
    },
    [announce, focusInput, initialLines, nextId, streamQuestion, ui],
  );

  return (
    <div className="interactive-shell">
      <div className="shell-chrome">
        <WindowChrome size={WINDOW_DOT_SIZE} />
        {isMobile ? (
          <span className="shell-chrome-tag">{chrome.mobileLabel ?? chrome.rightTag}</span>
        ) : (
          <>
            <span>{chrome.promptLabel}</span>
            <span className="shell-chrome-tag">{chrome.rightTag}</span>
          </>
        )}
      </div>
      <div
        ref={feedRef}
        onScroll={(event) => {
          const feed = event.currentTarget;
          const lineHeight = Number.parseFloat(getComputedStyle(feed).lineHeight);
          followOutputRef.current =
            feed.scrollHeight - feed.scrollTop - feed.clientHeight <= lineHeight;
        }}
        className="shell-feed"
        role="log"
        aria-label={ui.outputLabel}
        aria-live="polite"
        aria-busy={busy}
        // biome-ignore lint/a11y/noNoninteractiveTabindex: the vertically scrollable log must be keyboard-focusable so arrow keys can scroll it (WCAG 2.1.1, axe scrollable-region-focusable)
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
              {ui.aiLabel}: {ui.thinking}
            </span>
          ) : (
            <span
              key={line.id}
              className={`shell-line ${KIND_CLASS[line.kind]}`}
              data-kind={line.kind}
            >
              {line.kind === ShellLineKind.Reference ? (
                <ResponseReference ui={ui} requestId={line.text} announce={announce} />
              ) : (
                <>
                  {line.ai && <span className="shell-ai-label">{ui.aiLabel}: </span>}
                  {line.text}
                </>
              )}
            </span>
          ),
        )}
        {streamingText !== null && (
          <span className="shell-line shell-line-output" data-kind={ShellLineKind.Output}>
            <span className="shell-ai-label">{ui.aiLabel}: </span>
            {streamingText}
          </span>
        )}
      </div>
      {busy && (
        <div className="shell-progress">
          <span aria-hidden="true">
            {ui.aiLabel}
            <span className="shell-cursor" />
          </span>
          <button
            ref={stopRef}
            className="shell-control"
            type="button"
            aria-label={ui.stopLabel}
            onClick={() => activeRequest.current?.stop()}
          >
            {ui.stop}
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
        <span className="shell-prompt">{ui.prompt}</span>
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
                event.key === Key.Enter &&
                (event.nativeEvent.isComposing || event.keyCode === COMPOSITION_KEYCODE)
              ) {
                event.preventDefault();
                return;
              }
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
            aria-label={ui.inputLabel}
            aria-describedby={accuracyId}
          />
          {!input &&
            (inputFocused || busy ? (
              <StaticPlaceholder ui={ui} />
            ) : (
              <AnimatedPlaceholder ui={ui} />
            ))}
        </div>
      </form>
      <p id={accuracyId} className="shell-ai-notice">
        {ui.accuracy}
      </p>
      <p className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        <span key={announcement.id}>{announcement.text}</span>
      </p>
      <div className="shell-privacy-notice" data-testid="shell-privacy-notice">
        <p>
          {ui.privacy} <a href={ui.emailHref}>{ui.email}</a>.
        </p>
        <p>
          {ui.technicalPrivacy} <code>{ui.requestIdHeader}</code> {ui.technicalPrivacySuffix}{' '}
          <code>{ui.forgetEndpoint}</code>.
        </p>
      </div>
      <div
        className="shell-toolbar"
        role="toolbar"
        aria-label={ui.toolbarLabel}
        data-testid="shell-commands"
      >
        {ui.commands.map((command, index) => (
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
            onClick={() => {
              if (command === ShellCommand.Clear || busy) {
                runCommand(command);
                return;
              }
              setInput(command);
              focusInput();
            }}
            onKeyDown={(event) => {
              if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
              let target = index;
              if (event.key === Key.Home) target = 0;
              else if (event.key === Key.End) target = ui.commands.length - 1;
              else if (event.key === Key.Right) target = (index + 1) % ui.commands.length;
              else if (event.key === Key.Left) {
                target = (index - 1 + ui.commands.length) % ui.commands.length;
              } else return;
              event.preventDefault();
              setToolbarIndex(target);
              toolbarButtons.current[target]?.focus();
            }}
          >
            {command}
          </button>
        ))}
        <span className="shell-command-hint">{ui.commandHint}</span>
      </div>
    </div>
  );
}
