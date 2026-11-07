import type { ShellStates } from '@/content/shell-states.schema';
import { fillShellState, type ShellUi } from '@/content/shell-ui';
import { FORGET_OUTCOME, type ForgetResult } from '@/lib/forget-request.client';
import { formatRemaining } from './useAskStream';

export function describeForget(result: ForgetResult, ui: ShellUi, states: ShellStates): string {
  if (result.outcome === FORGET_OUTCOME.Deleted) return ui.forgetDeleted;
  if (result.outcome === FORGET_OUTCOME.RateLimited && result.retryAfter !== null) {
    return fillShellState(ui.forgetRateLimited, {
      left: formatRemaining(result.retryAfter, states),
    });
  }
  return ui.forgetFailed;
}
