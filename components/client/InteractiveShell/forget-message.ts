import type { ShellStates } from '@/content/shell-states.schema';
import { fillShellState } from '@/content/shell-ui';
import { FORGET_OUTCOME, type ForgetResult } from '@/lib/forget-request.client';
import { formatRemaining } from './useAskStream';

export function describeForget(result: ForgetResult, states: ShellStates): string {
  switch (result.outcome) {
    case FORGET_OUTCOME.Deleted:
      return states.forgetDeleted;
    case FORGET_OUTCOME.NotFound:
      return states.forgetNotFound;
    case FORGET_OUTCOME.RateLimited:
      return result.retryAfter === null
        ? states.forgetFailed
        : fillShellState(states.forgetRateLimited, {
            left: formatRemaining(result.retryAfter, states),
          });
    default:
      return states.forgetFailed;
  }
}

export function isForgotten(result: ForgetResult): boolean {
  return result.outcome === FORGET_OUTCOME.Deleted || result.outcome === FORGET_OUTCOME.NotFound;
}
