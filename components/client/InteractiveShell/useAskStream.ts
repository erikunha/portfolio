'use client';

import { type Dispatch, useCallback, useEffect, useRef, useState } from 'react';
import {
  fillShellState,
  SHELL_LIMITS,
  ShellLineKind,
  type ShellUi,
  shellStates,
} from '@/content/shell-ui';
import type { SiteLocale } from '@/content/site-locale';
import { conversationIdForAsk, recordConversationRequest } from '@/lib/ask/conversation.client';
import { addRef } from '@/lib/request-refs.client';
import {
  GUARD_ABORT_PREFIX,
  parseStreamChunk,
  REFUSAL_PREFIX,
  RETRY_AFTER_HEADER,
} from '@/lib/stream-protocol';
import { MS_PER_SECOND } from '@/lib/time';
import { createAskRequest } from './ask-request';
import { type FailureDetail, failureForResponse, settledLines } from './settled-lines';
import { TranscriptAction } from './transcript';

type ActiveRequest = { stop: () => void; dispose: () => void };

function streamFailureMessage(errorMessage: string, ui: ShellUi): string {
  if (errorMessage.startsWith(GUARD_ABORT_PREFIX)) return ui.answerWithheld;
  return errorMessage.startsWith(REFUSAL_PREFIX)
    ? errorMessage.slice(REFUSAL_PREFIX.length)
    : errorMessage;
}

type AskStreamOptions = {
  locale: SiteLocale;
  ui: ShellUi;
  nextId: () => number;
  announce: (text: string) => void;
  dispatch: Dispatch<TranscriptAction>;
  restoreInput: (command: string) => void;
  onSettled: () => void;
};

export function useAskStream({
  locale,
  ui,
  nextId,
  announce,
  dispatch,
  restoreInput,
  onSettled,
}: AskStreamOptions) {
  const states = shellStates[locale];
  const [busy, setBusy] = useState(false);
  const [streamingText, setStreamingText] = useState<string | null>(null);
  const activeRequest = useRef<ActiveRequest | null>(null);
  const rafRef = useRef<number | null>(null);

  const clearFrame = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      activeRequest.current?.dispose();
      activeRequest.current = null;
      clearFrame();
    };
  }, [clearFrame]);

  const start = useCallback(
    async (question: string, command: string) => {
      const conversationId = conversationIdForAsk();
      const request = createAskRequest({ question, locale, conversationId });
      const loadingId = nextId();
      let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
      let requestId: string | null = null;
      let logged = false;
      let accumulated = '';
      let displayText = '';
      let receivedText = false;
      let settled = false;
      let timer: ReturnType<typeof setTimeout> | undefined;
      setBusy(true);
      dispatch({
        type: TranscriptAction.Append,
        lines: [{ id: loadingId, kind: ShellLineKind.Loading, text: '' }],
      });
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
      function finish(text: string, message?: string, error = false, detail: FailureDetail = {}) {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        clearFrame();
        if (request.aborted) return;
        activeRequest.current = null;
        const lines = settledLines({
          text,
          message,
          error,
          detail,
          requestId,
          logged,
          ui,
          nextId,
        });
        dispatch({ type: TranscriptAction.Settle, loadingId, dropReferences: logged, lines });
        setStreamingText(null);
        setBusy(false);
        if (message) restoreInput(command);
        announce(message ? [detail.prefix, message].filter(Boolean).join(' ') : ui.complete);
        onSettled();
      }
      function interrupt(message: string, error = false, detail?: FailureDetail) {
        finish(displayText, message, error, detail);
        request.abort();
      }
      activeRequest.current = {
        stop: () => interrupt(displayText ? ui.stoppedPartial : ui.stoppedBefore),
        dispose: () => {
          settled = true;
          clearTimeout(timer);
          request.abort();
        },
      };
      armIdleTimer();

      try {
        const response = await request.send();
        if (settled || request.aborted) {
          void response.body?.cancel().catch(() => undefined);
          return;
        }
        requestId = response.headers.get(ui.requestIdHeader);
        if (requestId) addRef(requestId);
        if (requestId && response.ok) {
          logged = true;
          recordConversationRequest(conversationId, requestId);
        }
        if (!response.ok) {
          const data = (await response.json().catch(() => null)) as {
            error?: unknown;
          } | null;
          const failure = failureForResponse({
            status: response.status,
            errorDetail: typeof data?.error === 'string' ? data.error : '',
            retryAfterHeader: response.headers.get(RETRY_AFTER_HEADER),
            states,
            ui,
          });
          finish('', failure.message, true, failure.detail);
          return;
        }
        reader = request.openReader(response);
        if (!reader) {
          finish('', ui.bodyUnavailable, true);
          return;
        }
        const decoder = new TextDecoder();
        const flushFrame = () => {
          rafRef.current = null;
          if (!settled && !request.aborted) {
            setStreamingText(displayText);
          }
        };
        while (!settled) {
          const { done, value } = await reader.read();
          if (settled) return;
          armIdleTimer();
          accumulated += done ? decoder.decode() : decoder.decode(value, { stream: true });
          const parsed = parseStreamChunk(accumulated);
          displayText = parsed.displayText;
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
              dispatch({ type: TranscriptAction.Remove, id: loadingId });
              announce(ui.started);
            }
            if (rafRef.current === null) {
              rafRef.current = requestAnimationFrame(flushFrame);
            }
          }
        }
      } catch {
        if (settled) return;
        const message = navigator.onLine ? ui.networkError : ui.offline;
        finish(displayText, message, true);
      } finally {
        reader?.releaseLock();
      }
    },
    [announce, clearFrame, nextId, onSettled, dispatch, restoreInput, states, ui, locale],
  );

  const stop = useCallback(() => activeRequest.current?.stop(), []);
  const isActive = useCallback(() => activeRequest.current !== null, []);

  return { busy, streamingText, start, stop, isActive };
}
