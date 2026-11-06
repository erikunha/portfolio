import { describe, expect, it } from 'vitest';
import { GUARD_ABORT_PREFIX as FROM_GUARD } from '@/lib/ask/output-guard';
import { GUARD_ABORT_PREFIX as FROM_PROTOCOL } from '@/lib/stream-protocol';

describe('GUARD_ABORT_PREFIX', () => {
  it('is defined once, in the client-safe stream protocol, so the shell can recognise a guard abort', () => {
    expect(FROM_PROTOCOL).toBe(FROM_GUARD);
  });
});
