import { ASK_FAILURE_REASON, type AskFailureReason } from '@/lib/ask/failure-reason';
import type { AskInteractionStatus } from '@/lib/ask/types';

const FINISH_REASON_LENGTH = 'length' as const;

const FINISH_REASON_INTERRUPTED = 'interrupted' as const;

const FINISH_REASON_REFUSED = 'content-filter' as const;

export type GuardAbortReason = 'leak' | 'length';

export type FinishObservation =
  | { source: 'stream-end'; upstreamFailed: boolean; finishReason: unknown }
  | { source: 'guard-abort'; reason: GuardAbortReason }
  | { source: 'stream-error'; midStreamTimeout: boolean };

export type ClientEnding =
  | { kind: 'none' }
  | { kind: 'truncation' }
  | { kind: 'refusal' }
  | { kind: 'interrupted' }
  | { kind: 'guard-abort'; reason: GuardAbortReason };

export type FinishOutcome = {
  status: AskInteractionStatus;
  failureReason: AskFailureReason | null;
  truncated: boolean;
  ending: ClientEnding;
};

const COMPLETED_OUTCOME: FinishOutcome = {
  status: 'completed',
  failureReason: null,
  truncated: false,
  ending: { kind: 'none' },
};

function errored(failureReason: AskFailureReason, ending: ClientEnding): FinishOutcome {
  return { status: 'errored', failureReason, truncated: false, ending };
}

function classifyStreamEnd(upstreamFailed: boolean, finishReason: unknown): FinishOutcome {
  if (upstreamFailed) return errored(ASK_FAILURE_REASON.upstream, { kind: 'interrupted' });
  if (finishReason === FINISH_REASON_LENGTH) {
    return { ...COMPLETED_OUTCOME, truncated: true, ending: { kind: 'truncation' } };
  }
  if (finishReason === FINISH_REASON_REFUSED) {
    return { ...COMPLETED_OUTCOME, status: 'refused', ending: { kind: 'refusal' } };
  }
  if (finishReason === FINISH_REASON_INTERRUPTED) {
    return errored(ASK_FAILURE_REASON.interrupted, { kind: 'interrupted' });
  }
  return COMPLETED_OUTCOME;
}

export function classifyFinish(observation: FinishObservation): FinishOutcome {
  switch (observation.source) {
    case 'stream-end':
      return classifyStreamEnd(observation.upstreamFailed, observation.finishReason);
    case 'guard-abort':
      return errored(ASK_FAILURE_REASON.outputGuard, {
        kind: 'guard-abort',
        reason: observation.reason,
      });
    case 'stream-error':
      return errored(
        observation.midStreamTimeout
          ? ASK_FAILURE_REASON.midStreamTimeout
          : ASK_FAILURE_REASON.streamError,
        { kind: 'interrupted' },
      );
  }
}

export function statusAfterClose(
  status: AskInteractionStatus,
  clientGone: boolean,
): AskInteractionStatus {
  return clientGone && status === 'completed' ? 'aborted' : status;
}
