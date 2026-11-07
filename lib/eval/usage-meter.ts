import { type AskUsageEvent, onAskUsage } from '@/lib/ask/usage';

export type UsageMeter = {
  take(requestId: string, timeoutMs: number): Promise<AskUsageEvent | null>;
  dispose(): void;
};

export function createUsageMeter(): UsageMeter {
  const seen = new Map<string, AskUsageEvent>();
  const waiters = new Map<string, (event: AskUsageEvent) => void>();
  const off = onAskUsage((event) => {
    const waiter = waiters.get(event.requestId);
    if (waiter) {
      waiters.delete(event.requestId);
      waiter(event);
      return;
    }
    seen.set(event.requestId, event);
  });
  return {
    take(requestId, timeoutMs) {
      const hit = seen.get(requestId);
      if (hit) {
        seen.delete(requestId);
        return Promise.resolve(hit);
      }
      return new Promise((resolve) => {
        const timer = setTimeout(() => {
          waiters.delete(requestId);
          resolve(null);
        }, timeoutMs);
        waiters.set(requestId, (event) => {
          clearTimeout(timer);
          resolve(event);
        });
      });
    },
    dispose: off,
  };
}
