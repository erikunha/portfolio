'use client';

import {
  type Dispatch,
  type SetStateAction,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import { SHELL_LIMITS, ShellLineKind, type ShellUi, shellStates } from '@/content/shell-ui';
import type { SiteLocale } from '@/content/site-locale';
import { ASK_LOCALE_HEADER, parseStreamChunk } from '@/lib/stream-protocol';

export type LineKind = (typeof ShellLineKind)[keyof typeof ShellLineKind];
export type Line = {
  id: number;
  kind: LineKind;
  text: string;
  ai?: boolean;
  prefix?: string;
};
type FailureDetail = { prefix?: string; hint?: boolean };
type ActiveRequest = { stop: () => void; dispose: () => void };

const ASK_ENDPOINT = '/api/ask';
const RATE_LIMIT_STATUS = 429;
const SERVER_ERROR_STATUS = 500;

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
        timer = setTimeout(() => interrupt(ui.timeout, true), SHELL_LIMITS.requestTimeoutMs);
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
        if (message) {
          lines.push({
            id: nextId(),
            kind: error ? ShellLineKind.Error : ShellLineKind.Info,
            text: error && !detail.prefix ? `${ui.errorPrefix} ${message}` : message,
            prefix: detail.prefix,
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
          const message = detail || response.statusText || ui.httpErrorPrefix;
          finish(
            '',
            response.status === RATE_LIMIT_STATUS ? `${message}. ${ui.localAvailable}` : message,
            true,
            {
              prefix: `${states.stderrCommand} ${response.status}`,
              hint: response.status >= SERVER_ERROR_STATUS && !message.includes(ui.email),
            },
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
    [announce, clearFrame, nextId, onSettled, setHistory, setInput, states, ui, locale],
  );

  const stop = useCallback(() => activeRequest.current?.stop(), []);
  const isActive = useCallback(() => activeRequest.current !== null, []);

  return { busy, streamingText, start, stop, isActive };
}
