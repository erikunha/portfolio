'use client';

import {
  type Dispatch,
  type SetStateAction,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  fillShellState,
  SHELL_LIMITS,
  ShellLineKind,
  type ShellUi,
  shellStates,
} from '@/content/shell-ui';
import type { SiteLocale } from '@/content/site-locale';
import { addRef } from '@/lib/request-refs.client';
import {
  ASK_LOCALE_HEADER,
  GUARD_ABORT_PREFIX,
  parseRetryAfter,
  parseStreamChunk,
  RETRY_AFTER_HEADER,
} from '@/lib/stream-protocol';

export type LineKind = (typeof ShellLineKind)[keyof typeof ShellLineKind];
export type Line = {
  id: number;
  kind: LineKind;
  text: string;
  ai?: boolean;
  prefix?: string;
  retryAfter?: number;
  retry?: string;
};
type FailureDetail = { prefix?: string; hint?: boolean; retryAfter?: number; retry?: string };
type ActiveRequest = { stop: () => void; dispose: () => void };

const ASK_ENDPOINT = '/api/ask';
const RATE_LIMIT_STATUS = 429;
const SERVER_ERROR_STATUS = 500;
const PAYLOAD_TOO_LARGE_STATUS = 413;
const SECONDS_PER_MINUTE = 60;
const MS_PER_SECOND = 1000;

export function formatRemaining(
  seconds: number,
  states: Pick<(typeof shellStates)['en'], 'minutesUnit' | 'secondsUnit'>,
): string {
  return seconds >= SECONDS_PER_MINUTE
    ? `${Math.ceil(seconds / SECONDS_PER_MINUTE)} ${states.minutesUnit}`
    : `${seconds} ${states.secondsUnit}`;
}

function streamFailureMessage(errorMessage: string, ui: ShellUi): string {
  return errorMessage.startsWith(GUARD_ABORT_PREFIX) ? ui.answerWithheld : errorMessage;
}

export function bounded(lines: Line[]): Line[] {
  return lines.slice(-SHELL_LIMITS.logEntries);
}

type AskStreamOptions = {
  locale: SiteLocale;
  ui: ShellUi;
  nextId: () => number;
  announce: (text: string) => void;
  setHistory: Dispatch<SetStateAction<Line[]>>;
  setInput: Dispatch<SetStateAction<string>>;
  onSettled: () => void;
};

export function useAskStream({
  locale,
  ui,
  nextId,
  announce,
  setHistory,
  setInput,
  onSettled,
}: AskStreamOptions) {
  const states = shellStates[locale];
  const [busy, setBusy] = useState(false);
  const [streamingText, setStreamingText] = useState<string | null>(null);
  const activeRequest = useRef<ActiveRequest | null>(null);
  const mountedRef = useRef(true);
  const rafRef = useRef<number | null>(null);

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

  const start = useCallback(
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
        timer = setTimeout(
          () =>
            interrupt(
              fillShellState(states.timeoutBody, {
                seconds: String(SHELL_LIMITS.requestTimeoutMs / MS_PER_SECOND),
              }),
              true,
              { prefix: `${states.stderrCommand} ${states.timeoutName}`, retry: command },
            ),
          SHELL_LIMITS.requestTimeoutMs,
        );
      }
      function releaseTransport() {
        controller.abort();
        void reader?.cancel().catch(() => undefined);
      }
      function finish(text: string, message?: string, error = false, detail: FailureDetail = {}) {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        clearFrame();
        if (!mountedRef.current) return;
        activeRequest.current = null;
        const lines: Line[] = [];
        if (text) lines.push({ id: nextId(), kind: ShellLineKind.Output, text, ai: true });
        if (message && detail.retryAfter) {
          lines.push({
            id: nextId(),
            kind: ShellLineKind.RateLimit,
            text: message,
            retryAfter: detail.retryAfter,
          });
        } else if (message) {
          lines.push({
            id: nextId(),
            kind: error ? ShellLineKind.Error : ShellLineKind.Info,
            text: error && !detail.prefix ? `${ui.errorPrefix} ${message}` : message,
            ...(detail.prefix ? { prefix: detail.prefix } : {}),
            ...(detail.retry ? { retry: detail.retry } : {}),
          });
          if (detail.hint) lines.push({ id: nextId(), kind: ShellLineKind.Hint, text: '' });
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
        announce(message ? [detail.prefix, message].filter(Boolean).join(' ') : ui.complete);
        onSettled();
      }
      function interrupt(message: string, error = false, detail?: FailureDetail) {
        const text = parseStreamChunk(accumulated).displayText;
        finish(text, message, error, detail);
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
            error?: unknown;
          } | null;
          const detail = typeof data?.error === 'string' ? data.error : '';
          const retryAfter =
            response.status === RATE_LIMIT_STATUS
              ? parseRetryAfter(response.headers.get(RETRY_AFTER_HEADER))
              : null;
          if (retryAfter) {
            const left = formatRemaining(retryAfter, states);
            finish(
              '',
              `${fillShellState(states.slowDown, { left })}. ${states.localCommands}`,
              true,
              { retryAfter },
            );
            return;
          }
          const message =
            detail ||
            (response.status === PAYLOAD_TOO_LARGE_STATUS ? ui.requestTooLarge : ui.serverError);
          finish(
            '',
            response.status === RATE_LIMIT_STATUS ? `${message}. ${ui.localAvailable}` : message,
            true,
            {
              prefix: `${states.stderrCommand} ${response.status}`,
              hint: response.status >= SERVER_ERROR_STATUS,
            },
          );
          return;
        }
        if (requestId) addRef(requestId);
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
            finish(
              parsed.displayText,
              parsed.ok ? undefined : streamFailureMessage(parsed.errorMessage, ui),
              !parsed.ok,
            );
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
      } catch {
        if (settled) return;
        const message = navigator.onLine ? ui.networkError : ui.offline;
        finish(parseStreamChunk(accumulated).displayText, message, true);
      } finally {
        reader?.releaseLock();
      }
    },
    [announce, clearFrame, nextId, onSettled, setHistory, setInput, states, ui, locale],
  );

  const stop = useCallback(() => activeRequest.current?.stop(), []);
  const isActive = useCallback(() => activeRequest.current !== null, []);

  return { busy, streamingText, start, stop, isActive };
}
