import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildLogPayload } from '@/lib/error-bridge.client';

const MESSAGE = 'boom';
const MOTION_VALUE = 'reduce';

describe('buildLogPayload before the document body exists', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    document.body.removeAttribute('data-motion');
  });

  it('leaves the motion flag undefined when the body is null', () => {
    vi.spyOn(document, 'body', 'get').mockReturnValue(null as unknown as HTMLElement);
    const payload = buildLogPayload(MESSAGE, undefined);
    expect(payload.motion).toBeUndefined();
    expect(payload.message).toBe(MESSAGE);
  });

  it('reads the motion flag when the body exists', () => {
    document.body.dataset.motion = MOTION_VALUE;
    expect(buildLogPayload(MESSAGE, undefined).motion).toBe(MOTION_VALUE);
  });
});
