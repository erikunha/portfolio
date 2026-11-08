'use client';

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import type { TerminalChrome } from '@/content/schemas';
import SHELL_RESPONSES from '@/content/shell-commands';
import { ShellCommand, ShellLineKind, type ShellUi, shellStates } from '@/content/shell-ui';
import type { SiteLocale } from '@/content/site-locale';
import { SHELL_COMMAND_EVENT } from '@/lib/events';
import { useBreakpoint } from '@/lib/use-breakpoint.client';
import { TerminalChromeBar } from '../TerminalChromeBar';
import { AnimatedPlaceholder, StaticPlaceholder } from './AnimatedPlaceholder.client';
import { parsePrivacyCommand } from './privacy-command';
import { ShellLine } from './ShellLines.client';
import { ShellToolbar } from './ShellToolbar.client';
import { ShellKey } from './shell-keys';
import { bounded, type Line, useAskStream } from './useAskStream';
import { HISTORY_STEP, useCommandHistory } from './useCommandHistory';
import { usePrivacyCommands } from './usePrivacyCommands';

const COMMAND_FIELD = 'command';
const COMPOSITION_KEYCODE = 229;
const WINDOW_DOT_SIZE = 10;
const STREAM_CARET = '█';

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
    (): Line[] => [{ id: nextId(), kind: ShellLineKind.Info, text: ui.welcome, welcome: true }],
    [nextId, ui],
  );
  const [history, setHistory] = useState<Line[]>(initialLines);
  const [input, setInput] = useState('');
  const [inputFocused, setInputFocused] = useState(false);
  const [announcement, setAnnouncement] = useState({ id: 0, text: '' });
  const stopRef = useRef<HTMLButtonElement>(null);
  const followOutputRef = useRef(true);
  const feedRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const commandHistory = useCommandHistory();

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
  const runPrivacy = usePrivacyCommands({ ui, states, nextId, setHistory, announce, focusInput });

  useLayoutEffect(() => {
    const typed = inputRef.current?.value;
    if (typed) setInput(typed);
  }, []);

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
      commandHistory.record(command);
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
      const privacy = parsePrivacyCommand(key);
      if (privacy) {
        void runPrivacy(privacy);
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
    [
      announce,
      commandHistory,
      focusInput,
      initialLines,
      isActive,
      nextId,
      runPrivacy,
      streamQuestion,
      ui,
    ],
  );

  const activateToolbarCommand = useCallback(
    (command: string) => {
      if (command === ShellCommand.Clear || busy) {
        runCommand(command);
        return;
      }
      setInput(command);
      focusInput();
    },
    [busy, focusInput, runCommand],
  );

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: Escape bubbles from the focusable controls inside; the wrapper has no role, and scoping the stop key here keeps it out of a global keydown listener
    <div
      className="interactive-shell"
      onKeyDown={(event) => {
        if (event.key !== ShellKey.Escape || event.nativeEvent.isComposing || !isActive()) return;
        event.preventDefault();
        stopStream();
      }}
    >
      <TerminalChromeBar
        chrome={chrome}
        className="shell-chrome"
        tagClassName="shell-chrome-tag"
        dotSize={WINDOW_DOT_SIZE}
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
        {history.map((line) => (
          <ShellLine
            key={line.id}
            line={line}
            ui={ui}
            states={states}
            isMobile={isMobile}
            announce={announce}
            onRetry={runCommand}
          />
        ))}
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
        action={(data) => {
          const queued = data.get(COMMAND_FIELD);
          if (typeof queued === 'string') runCommand(queued);
        }}
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
            name={COMMAND_FIELD}
            enterKeyHint="send"
            value={input}
            onChange={(event) => {
              setInput(event.target.value);
              commandHistory.noteEdit();
            }}
            onFocus={() => setInputFocused(true)}
            onBlur={() => setInputFocused(false)}
            onKeyDown={(event) => {
              if (
                event.key === ShellKey.Enter &&
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
                (event.key !== ShellKey.Up && event.key !== ShellKey.Down)
              ) {
                return;
              }
              event.preventDefault();
              const step = event.key === ShellKey.Up ? HISTORY_STEP.Older : HISTORY_STEP.Newer;
              setInput(commandHistory.recall(step, input));
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
      <ShellToolbar ui={ui} busy={busy} onActivate={activateToolbarCommand} />
    </div>
  );
}
