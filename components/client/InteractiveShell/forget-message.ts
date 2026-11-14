import type { ShellStates } from '@/content/shell-states.schema';
import { fillShellState, type ShellUi } from '@/content/shell-ui';
import { FORGET_OUTCOME, type ForgetResult } from '@/lib/forget-request.client';
import { formatRemaining } from './useAskStream';

export function describeForget(result: ForgetResult, ui: ShellUi, states: ShellStates): string {
  switch (result.outcome) {
    case FORGET_OUTCOME.Deleted:
      return ui.forgetDeleted;
    case FORGET_OUTCOME.RateLimited:
      return result.retryAfter === null
        ? ui.forgetFailed
        : fillShellState(ui.forgetRateLimited, {
            left: formatRemaining(result.retryAfter, states),
          });
    case FORGET_OUTCOME.Unavailable:
      return ui.forgetUnavailable;
    case FORGET_OUTCOME.Offline:
      return ui.forgetOffline;
    case FORGET_OUTCOME.TimedOut:
      return ui.forgetTimedOut;
    case FORGET_OUTCOME.Failed:
      return ui.forgetFailed;
    default: {
      result satisfies never;
      return ui.forgetFailed;
    }
  }
}
