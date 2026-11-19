'use client';

import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useReducer,
  useRef,
  useState,
} from 'react';
import type { TerminalChrome } from '@/content/schemas';
import { SHELL_RESPONSE_LANG } from '@/content/shell-commands';
import {
  fillShellState,
  ShellCommand,
  ShellLineKind,
  type ShellUi,
  shellStates,
} from '@/content/shell-ui';
import type { SiteLocale } from '@/content/site-locale';
import { forgetInFlight } from '@/lib/ask/conversation.client';
import { hasModifier } from '@/lib/dom/has-modifier';
import { SHELL_COMMAND_EVENT } from '@/lib/events';
import { useAnnouncer } from '@/lib/use-announcer.client';
import { useBreakpoint } from '@/lib/use-breakpoint.client';
import { TerminalChromeBar } from '../TerminalChromeBar';
import { AnimatedPlaceholder, StaticPlaceholder } from './AnimatedPlaceholder.client';
import { revealShell, SHELL_LIVE_PROPS } from './reveal-shell';
import { ShellLine, StopElapsed } from './ShellLines.client';
import { ShellToolbar } from './ShellToolbar.client';
import { historyStepFor, isCompositionEnter, parseShellInput, ShellInputKind } from './shell-input';
import { ShellKey } from './shell-keys';
import { type Line, TranscriptAction, transcriptReducer } from './transcript';
import { useAskStream } from './useAskStream';
import { useCommandHistory } from './useCommandHistory';
import { usePrivacyCommands } from './usePrivacyCommands';

const COMMAND_FIELD = 'command';
const STREAM_CARET = '█';
const ANNOUNCER_REGION_ATTRIBUTES = { 'aria-live': 'polite', 'aria-atomic': true } as const;

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
  const [history, dispatch] = useReducer(transcriptReducer, undefined, initialLines);
  const [input, setInput] = useState('');
  const [inputFocused, setInputFocused] = useState(false);
  const { announce, region: announcerRegion } = useAnnouncer(ANNOUNCER_REGION_ATTRIBUTES);
  const stopRef = useRef<HTMLButtonElement>(null);
  const followOutputRef = useRef(true);
  const feedRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const commandHistory = useCommandHistory();
  const promptEditedRef = useRef(false);
  const revealedHistoryRef = useRef(history);

  const editInput = useCallback((value: string) => {
    promptEditedRef.current = true;
    setInput(value);
  }, []);
  const restoreInput = useCallback((command: string) => {
    if (!promptEditedRef.current) setInput((value) => value || command);
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
    dispatch,
    restoreInput,
    onSettled: refocusAfterStream,
  });
  const stopAndReturnFocus = useCallback(() => {
    stopStream();
    focusInput();
  }, [stopStream, focusInput]);
  const onConversationForgotten = useCallback(
    (questions: number) => {
      dispatch({
        type: TranscriptAction.ForgetConversation,
        lines: [
          { id: nextId(), kind: ShellLineKind.Output, text: ui.conversationForgotten },
          {
            id: nextId(),
            kind: ShellLineKind.Info,
            text:
              questions === 1
                ? ui.conversationForgottenOne
                : fillShellState(ui.conversationForgottenMany, { count: String(questions) }),
          },
        ],
      });
      focusInput();
    },
    [focusInput, nextId, ui],
  );
  const runPrivacy = usePrivacyCommands({
    ui,
    states,
    nextId,
    dispatch,
    announce,
    focusInput,
    onConversationForgotten,
  });

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

  useEffect(() => {
    if (revealedHistoryRef.current === history) return;
    revealedHistoryRef.current = history;
    revealShell(feedRef.current);
  }, [history]);

  const runCommand = useCallback(
    (raw: string) => {
      if (isActive()) {
        announce(ui.busy);
        return;
      }
      const parsed = parseShellInput(raw);
      if (parsed.kind === ShellInputKind.Empty) return;
      const { command } = parsed;
      if (parsed.kind === ShellInputKind.Question && forgetInFlight()) {
        announce(ui.forgetting);
        return;
      }
      followOutputRef.current = true;
      commandHistory.record(command);
      window.dispatchEvent(new CustomEvent(SHELL_COMMAND_EVENT));
      dispatch({
        type: TranscriptAction.Append,
        lines: [{ id: nextId(), kind: ShellLineKind.Prompt, text: `${ui.prompt} ${command}` }],
      });
      promptEditedRef.current = false;
      setInput('');
      if (parsed.kind === ShellInputKind.Clear) {
        dispatch({ type: TranscriptAction.Clear, lines: initialLines() });
        announce(ui.cleared);
        focusInput();
        return;
      }
      if (parsed.kind === ShellInputKind.Privacy) {
        void runPrivacy(parsed.privacy);
        return;
      }
      if (parsed.kind === ShellInputKind.Local) {
        const { response } = parsed;
        dispatch({
          type: TranscriptAction.Append,
          lines: [
            { id: nextId(), kind: response.kind, text: response.text, lang: SHELL_RESPONSE_LANG },
          ],
        });
        announce(ui.commandComplete);
        focusInput();
        return;
      }
      void streamQuestion(parsed.question, command);
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
      editInput(command);
      focusInput();
    },
    [busy, editInput, focusInput, runCommand],
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
      <TerminalChromeBar chrome={chrome} className="shell-chrome" tagClassName="shell-chrome-tag" />
      <div {...SHELL_LIVE_PROPS}>
        <div className="shell-feed-wrap">
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
                busy={busy}
                onConversationForgotten={onConversationForgotten}
              />
            ))}
            {streamingText !== null && (
              <span
                className="shell-line shell-line-output"
                data-kind={ShellLineKind.Output}
                aria-hidden="true"
              >
                <span className="shell-ai-label">{ui.aiLabel}: </span>
                {streamingText}
                <span className="shell-caret" aria-hidden="true">
                  {STREAM_CARET}
                </span>
              </span>
            )}
          </div>
          {busy ? (
            <button
              ref={stopRef}
              className="shell-stop-pill"
              type="button"
              aria-label={ui.stopLabel}
              onClick={stopAndReturnFocus}
            >
              <span className="shell-stop-elapsed" aria-hidden="true">
                <StopElapsed template={ui.stopPill} />
              </span>
              <kbd className="shell-stop-key">{ui.escKey}</kbd>
            </button>
          ) : null}
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
          <div className="shell-input-wrap">
            <input
              ref={inputRef}
              className="shell-input"
              name={COMMAND_FIELD}
              enterKeyHint="send"
              value={input}
              onChange={(event) => {
                editInput(event.target.value);
                commandHistory.noteEdit();
              }}
              onFocus={() => setInputFocused(true)}
              onBlur={() => setInputFocused(false)}
              onKeyDown={(event) => {
                const composing = event.nativeEvent.isComposing;
                if (isCompositionEnter(event.key, composing, event.keyCode)) {
                  event.preventDefault();
                  return;
                }
                const step = historyStepFor(event.key, {
                  composing,
                  modified: hasModifier(event),
                });
                if (step === null) return;
                event.preventDefault();
                editInput(commandHistory.recall(step, input));
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
                <StaticPlaceholder ui={ui} compact={isMobile} />
              ) : (
                <AnimatedPlaceholder ui={ui} compact={isMobile} />
              ))}
          </div>
        </form>
      </div>
      <p id={accuracyId} className="shell-ai-notice">
        {ui.accuracy}
      </p>
      {announcerRegion}
      <div className="shell-privacy-notice" data-testid="shell-privacy-notice">
        <p>
          {ui.privacy}{' '}
          <span className="shell-privacy-email">
            <a href={ui.emailHref}>{ui.email}</a>.
          </span>
        </p>
        <p>
          {ui.technicalPrivacy} <code>{ui.requestIdHeader}</code> {ui.technicalPrivacySuffix}{' '}
          <code>{ui.forgetEndpoint}</code>. {ui.technicalPrivacyScope}
        </p>
      </div>
      <ShellToolbar ui={ui} busy={busy} onActivate={activateToolbarCommand} />
    </div>
  );
}
