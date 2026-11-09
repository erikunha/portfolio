import 'server-only';
import { after } from 'next/server';
import { log } from '@/lib/log';
import { describeError } from '@/lib/log-error';

function runGuarded(task: () => Promise<void>): Promise<void> {
  return task().catch((taskErr: unknown) => {
    log.error('after-response task failed', { error: describeError(taskErr) });
  });
}

export function afterResponse(task: () => Promise<void>): void {
  try {
    after(() => runGuarded(task));
  } catch {
    void runGuarded(task);
  }
}
