import type { ShellStates } from '@/content/shell-states.schema';
import { fillShellState, ShellLineKind, type ShellUi } from '@/content/shell-ui';
import { HTTP_STATUS } from '@/lib/http-status';
import { parseRetryAfter } from '@/lib/stream-protocol';
import { formatRemaining, type Line } from './transcript';

export type FailureDetail = {
  prefix?: string;
  hint?: boolean;
  retryAfter?: number;
  retry?: string;
};

type SettledInput = {
  text: string;
  message?: string | undefined;
  error: boolean;
  detail: FailureDetail;
  requestId: string | null;
  logged: boolean;
  ui: ShellUi;
  nextId: () => number;
};

export function settledLines({
  text,
  message,
  error,
  detail,
  requestId,
  logged,
  ui,
  nextId,
}: SettledInput): Line[] {
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
  if (requestId && logged) {
    lines.push({ id: nextId(), kind: ShellLineKind.Reference, text: requestId });
  }
  return lines;
}

type ResponseFailureInput = {
  status: number;
  errorDetail: string;
  retryAfterHeader: string | null;
  states: ShellStates;
  ui: ShellUi;
};

export function failureForResponse({
  status,
  errorDetail,
  retryAfterHeader,
  states,
  ui,
}: ResponseFailureInput): { message: string; detail: FailureDetail } {
  const retryAfter =
    status === HTTP_STATUS.tooManyRequests ? parseRetryAfter(retryAfterHeader) : null;
  if (retryAfter) {
    const left = formatRemaining(retryAfter, states);
    return {
      message: `${fillShellState(states.slowDown, { left })}. ${states.localCommands}`,
      detail: { retryAfter },
    };
  }
  const message =
    errorDetail || (status === HTTP_STATUS.payloadTooLarge ? ui.requestTooLarge : ui.serverError);
  return {
    message: status === HTTP_STATUS.tooManyRequests ? `${message}. ${ui.localAvailable}` : message,
    detail: {
      prefix: `${states.stderrCommand} ${status}`,
      hint: status >= HTTP_STATUS.internalServerError,
    },
  };
}
