export type AskResult =
  | { kind: 'answer'; text: string; requestId: string | null }
  | { kind: 'rejected'; status: number; detail: string };

export const STREAM_ERROR_STATUS = 0;

export const ASK_TRANSPORT_RETRIES = 2;

export const ASK_RETRY_BACKOFF_MS = 500;

const RATE_LIMITED_STATUS = 429;

const SERVER_ERROR_STATUS_FLOOR = 500;

export function isTransportFailure(result: AskResult): boolean {
  if (result.kind !== 'rejected') return false;
  return (
    result.status === STREAM_ERROR_STATUS ||
    result.status === RATE_LIMITED_STATUS ||
    result.status >= SERVER_ERROR_STATUS_FLOOR
  );
}

function sleepFor(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function thrownAsRejection(err: unknown): AskResult {
  return {
    kind: 'rejected',
    status: STREAM_ERROR_STATUS,
    detail: `ask feature threw: ${err instanceof Error ? err.message : String(err)}`,
  };
}

export async function withTransportRetry(
  attempt: () => Promise<AskResult>,
  options: { sleep?: (ms: number) => Promise<void> } = {},
): Promise<{ result: AskResult; retried: number }> {
  const sleep = options.sleep ?? sleepFor;
  let retried = 0;
  for (;;) {
    let result: AskResult;
    try {
      result = await attempt();
    } catch (err) {
      result = thrownAsRejection(err);
    }
    if (!isTransportFailure(result) || retried >= ASK_TRANSPORT_RETRIES) {
      return { result, retried };
    }
    await sleep(ASK_RETRY_BACKOFF_MS * 2 ** retried);
    retried += 1;
  }
}
