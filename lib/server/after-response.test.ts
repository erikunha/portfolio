import { beforeEach, describe, expect, it, vi } from 'vitest';

const afterMock = vi.hoisted(() => vi.fn());
const logError = vi.hoisted(() => vi.fn());

const registeredTask = (): Promise<void> => {
  const [task] = afterMock.mock.calls[0] as [() => Promise<void>];
  return task();
};

vi.mock('next/server', () => ({ after: afterMock }));
vi.mock('@/lib/log', () => ({ log: { error: logError, info: vi.fn(), warn: vi.fn() } }));

describe('afterResponse', () => {
  beforeEach(() => {
    afterMock.mockReset();
    logError.mockClear();
  });

  it('hands the task to after() instead of running it inline', async () => {
    const task = vi.fn(async () => undefined);
    const { afterResponse } = await import('./after-response');

    afterResponse(task);

    expect(afterMock).toHaveBeenCalledOnce();
    expect(task).not.toHaveBeenCalled();
    await registeredTask();
    expect(task).toHaveBeenCalledOnce();
  });

  it('runs the task directly when there is no request scope to attach it to', async () => {
    afterMock.mockImplementation(() => {
      throw new Error('`after` was called outside a request scope');
    });
    const task = vi.fn(async () => undefined);
    const { afterResponse } = await import('./after-response');

    afterResponse(task);

    expect(task).toHaveBeenCalledOnce();
  });

  it('logs a failing task instead of raising it', async () => {
    const { afterResponse } = await import('./after-response');
    afterResponse(async () => {
      throw new Error('boom');
    });

    await registeredTask();
    expect(logError).toHaveBeenCalledWith('after-response task failed', expect.anything());
  });
});
