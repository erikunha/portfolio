'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import type { TerminalChrome } from '@/content/schemas';
import SHELL_RESPONSES from '@/content/shell-commands';
import {
  fillShellState,
  SHELL_LIMITS,
  ShellCommand,
  ShellLineKind,
  type ShellUi,
  shellStates,
} from '@/content/shell-ui';
import type { SiteLocale } from '@/content/site-locale';
import { useBreakpoint } from '@/lib/use-breakpoint.client';
import { TerminalChromeBar } from '../TerminalChromeBar';
import { AnimatedPlaceholder, StaticPlaceholder } from './AnimatedPlaceholder.client';
import { ResponseReference } from './ResponseReference.client';
import { bounded, type Line, type LineKind, useAskStream } from './useAskStream';

const KIND_CLASS: Record<LineKind, string> = {
  [ShellLineKind.Prompt]: 'shell-line-prompt',
  [ShellLineKind.Output]: 'shell-line-output',
  [ShellLineKind.Error]: 'shell-line-error',
  [ShellLineKind.Info]: 'shell-line-info',
  [ShellLineKind.Loading]: 'shell-line-loading',
  [ShellLineKind.Reference]: 'shell-line-reference',
  [ShellLineKind.Hint]: 'shell-line-hint',
};
const Key = {
  Up: 'ArrowUp',
  Down: 'ArrowDown',
  Left: 'ArrowLeft',
  Right: 'ArrowRight',
  Home: 'Home',
  End: 'End',
  Enter: 'Enter',
  Escape: 'Escape',
} as const;
const SHELL_COMMAND_EVENT = 'shell-cmd-run';
const COMPOSITION_KEYCODE = 229;
const WINDOW_DOT_SIZE = 10;
const THINKING_TICK_MS = 100;
const MS_PER_SECOND = 1000;
const STREAM_CARET = '█';

function ThinkingLine({ template }: { template: string }) {
  const [elapsedMs, setElapsedMs] = useState(0);
  useEffect(() => {
    const startedAt = Date.now();
    const id = setInterval(() => setElapsedMs(Date.now() - startedAt), THINKING_TICK_MS);
    return () => clearInterval(id);
  }, []);
  return fillShellState(template, { seconds: (elapsedMs / MS_PER_SECOND).toFixed(1) });
}

function LineText({ text, ui }: { text: string; ui: ShellUi }) {
  const at = text.indexOf(ui.email);
  if (at < 0) return text;
  return (
    <>
      {text.slice(0, at)}
      <a href={ui.emailHref}>{ui.email}</a>
      {text.slice(at + ui.email.length)}
    </>
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
  const states = shellStates[locale];
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
  const [announcement, setAnnouncement] = useState({ id: 0, text: '' });
  const [toolbarIndex, setToolbarIndex] = useState(0);
  const stopRef = useRef<HTMLButtonElement>(null);
  const followOutputRef = useRef(true);
  const feedRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const toolbarButtons = useRef<(HTMLButtonElement | null)[]>([]);
  const commands = useRef<string[]>([]);
  const historyIndex = useRef(0);
  const draft = useRef('');
  const initializedRef = useRef(false);

  const announce = useCallback((text: string) => {
    setAnnouncement((previous) => ({ id: previous.id + 1, text }));
  }, []);
  const focusInput = useCallback(() => inputRef.current?.focus({ preventScroll: true }), []);
  const refocusAfterStream = useCallback(() => {
    if (stopRef.current === document.activeElement) focusInput();
  }, [focusInput]);
  const {
    busy,
    streamingText,
    start: streamQuestion,
    stop: stopStream,
    isActive,
  } = useAskStream({
    locale,
    ui,
    nextId,
    announce,
    setHistory,
    setInput,
    onSettled: refocusAfterStream,
  });

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

  const runCommand = useCallback(
    (raw: string) => {
      if (isActive()) {
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
    [announce, focusInput, initialLines, isActive, nextId, streamQuestion, ui],
  );

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: Escape bubbles from the focusable controls inside; the wrapper has no role, and scoping the stop key here keeps it out of a global keydown listener
    <div
      className="interactive-shell"
      onKeyDown={(event) => {
        if (event.key !== Key.Escape || event.nativeEvent.isComposing || !isActive()) return;
        event.preventDefault();
        stopStream();
      }}
    >
      <TerminalChromeBar
        chrome={chrome}
        className="shell-chrome"
        tagClassName="shell-chrome-tag"
        dotSize={WINDOW_DOT_SIZE}
        compact={isMobile}
      />
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
              <span className="shell-stream-meta">
                <ThinkingLine template={states.thinkingElapsed} />
              </span>
              <span className="shell-stream-meta shell-esc-hint">{states.escStop}</span>
            </span>
          ) : (
            <span
              key={line.id}
              className={`shell-line ${KIND_CLASS[line.kind]}`}
              data-kind={line.kind}
            >
              {line.kind === ShellLineKind.Reference ? (
                <ResponseReference ui={ui} requestId={line.text} announce={announce} />
              ) : line.kind === ShellLineKind.Hint ? (
                <>
                  {states.tryPrefix} <code>{states.tryCommand}</code> {states.trySuffix}{' '}
                  <a href={ui.emailHref}>{ui.email}</a>
                </>
              ) : (
                <>
                  {line.ai && <span className="shell-ai-label">{ui.aiLabel}: </span>}
                  {line.prefix && <strong className="shell-stderr-command">{line.prefix}</strong>}
                  {line.prefix && ' '}
                  <LineText text={line.text} ui={ui} />
                </>
              )}
            </span>
          ),
        )}
        {streamingText !== null && (
          <span className="shell-line shell-line-output" data-kind={ShellLineKind.Output}>
            <span className="shell-ai-label">{ui.aiLabel}: </span>
            {streamingText}
            <span className="shell-caret" aria-hidden="true">
              {STREAM_CARET}
            </span>
          </span>
        )}
        {streamingText !== null && (
          <span className="shell-line shell-stream-meta shell-esc-hint" aria-hidden="true">
            {states.escStop}
          </span>
        )}
      </div>
      <form
        className="shell-form"
        data-testid="shell-form"
        onSubmit={(event) => {
          event.preventDefault();
          runCommand(input);
        }}
      >
        <span className="shell-prompt">{ui.prompt}</span>
        <div className="shell-input-wrap" data-busy={busy || undefined}>
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
          {busy && (
            <button
              ref={stopRef}
              className="shell-control shell-stop"
              type="button"
              aria-label={ui.stopLabel}
              onClick={stopStream}
            >
              {ui.stop}
            </button>
          )}
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
