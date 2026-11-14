import { describe, expect, it } from 'vitest';
import { settleTestBodies, trackTestBody } from './settled-it';

const BODY_MS = 30;
const STUCK_MS = 1_000;

const later = <T>(value: T, fail = false) =>
  new Promise<T>((resolve, reject) =>
    setTimeout(() => (fail ? reject(new Error('body failed')) : resolve(value)), BODY_MS),
  );

describe('settleTestBodies', () => {
  it('waits for a tracked body that is still running', async () => {
    let finished = false;
    void trackTestBody(async () => {
      await later(null);
      finished = true;
    })();
    expect(finished).toBe(false);
    await settleTestBodies();
    expect(finished).toBe(true);
  });

  it('settles when a tracked body rejects, without rethrowing', async () => {
    const failing = trackTestBody(() => later(null, true))();
    failing.catch(() => undefined);
    await expect(settleTestBodies()).resolves.toBeUndefined();
  });

  it('forgets a body once it settles', async () => {
    await trackTestBody(() => later('done'))();
    const stuck = new Promise<string>((resolve) => setTimeout(() => resolve('waited'), STUCK_MS));
    const first = await Promise.race([settleTestBodies().then(() => 'settled'), stuck]);
    expect(first).toBe('settled');
  });
});
