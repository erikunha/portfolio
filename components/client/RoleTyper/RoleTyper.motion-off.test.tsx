import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mountClient } from '@/__tests__/helpers/render';
import { MOTION_CHANGE_EVENT } from '@/lib/motion-change';
import { RoleTyper } from './RoleTyper';

const ROLE = 'Senior';
const TYPED_MS = 160;

vi.mock('@/lib/motion', () => ({ readMotion: vi.fn(() => true) }));

function setMotion(on: boolean) {
  window.dispatchEvent(new CustomEvent(MOTION_CHANGE_EVENT, { detail: { on } }));
}

describe('RoleTyper: MOTION switched off while typing', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows the full role at once instead of freezing on a partial word', async () => {
    const mounted = await mountClient(<RoleTyper role={ROLE} />);
    const pill = mounted.container.querySelector('[data-role-pill]');

    await act(async () => {
      await vi.advanceTimersByTimeAsync(TYPED_MS);
    });
    expect(pill?.textContent, 'typing is under way').not.toBe(`[${ROLE}]`);

    await act(async () => {
      setMotion(false);
    });
    expect(pill?.textContent).toBe(`[${ROLE}]`);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });
    expect(pill?.textContent, 'the stopped typer must not rewrite the pill').toBe(`[${ROLE}]`);

    mounted.unmount();
  });
});
