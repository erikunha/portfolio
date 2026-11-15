import type { ContactMessage } from './outbox';

export type SubmitOutcome = 'sent' | 'queued' | 'storage_failed' | 'outbox_failed';

export interface SubmitInput {
  msgId: string;
  requestId: string;
  name: string;
  email: string;
  message: string;
  ipHash: string;
}

export interface SubmitDeps {
  saveMessage: (msgId: string, payload: ContactMessage) => Promise<void>;
  deleteMessage: (msgId: string) => Promise<void>;
  enqueue: (msgId: string, receivedAt: string) => Promise<boolean>;
  deliver: (msgId: string, payload: ContactMessage, requestId: string) => Promise<boolean>;
  now: () => number;
  log: {
    warn: (message: string, fields: Record<string, unknown>) => void;
    error: (message: string, fields: Record<string, unknown>) => void;
  };
}

export async function submitContact(input: SubmitInput, deps: SubmitDeps): Promise<SubmitOutcome> {
  const { msgId, requestId, name, email, message, ipHash } = input;
  const payload: ContactMessage = {
    name,
    email,
    message,
    receivedAt: new Date(deps.now()).toISOString(),
    ipHash,
  };

  try {
    await deps.saveMessage(msgId, payload);
  } catch {
    deps.log.error('KV write failed', { requestId, msgId });
    return 'storage_failed';
  }

  if (await deps.deliver(msgId, payload, requestId)) return 'sent';

  let queued = false;
  try {
    queued = await deps.enqueue(msgId, payload.receivedAt);
    if (!queued) deps.log.warn('contact outbox full', { requestId, msgId });
  } catch {
    deps.log.error('contact outbox write failed', { requestId, msgId });
  }
  if (queued) return 'queued';

  try {
    await deps.deleteMessage(msgId);
  } catch {
    deps.log.error('contact message cleanup failed', { requestId, msgId });
  }
  return 'outbox_failed';
}
