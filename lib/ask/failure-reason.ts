export const ASK_FAILURE_REASON = {
  upstream: 'upstream',
  interrupted: 'interrupted',
  outputGuard: 'output-guard',
  streamError: 'stream-error',
  midStreamTimeout: 'mid-stream-timeout',
} as const;

export type AskFailureReason = (typeof ASK_FAILURE_REASON)[keyof typeof ASK_FAILURE_REASON];
