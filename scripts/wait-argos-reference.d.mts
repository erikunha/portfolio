type ReferenceState = 'ready' | 'pending' | 'absent' | 'timeout';

export const REFERENCE_STATE: {
  readonly ready: 'ready';
  readonly pending: 'pending';
  readonly absent: 'absent';
  readonly timeout: 'timeout';
};
export const VISUAL_JOB_PREFIX: string;
export const CI_WORKFLOW_FILE: string;
export const POLL_INTERVAL_MS: number;
export const WAIT_DEADLINE_MS: number;
export const REQUEST_TIMEOUT_MS: number;
export function referenceState(
  run: { status: string } | undefined,
  jobs: Array<{ name: string; status: string }>,
): ReferenceState;
export function waitForReference(options: {
  readState: () => Promise<ReferenceState>;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
  intervalMs?: number;
  deadlineMs?: number;
  log?: (message: string) => void;
}): Promise<ReferenceState>;
export function githubReader(options: {
  repository: string;
  token: string;
  baseRef: string;
  headSha: string;
}): () => Promise<ReferenceState>;
