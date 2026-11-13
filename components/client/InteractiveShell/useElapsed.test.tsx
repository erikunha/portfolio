import { act, createElement, Fragment } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { type MountedClient, mountClient } from '@/__tests__/helpers/render';
import { shellStates, shellUi } from '@/content/shell-ui';
import { SITE_LOCALE } from '@/content/site-locale';
import { MOTION_BODY_STATE } from '@/lib/motion-change';

const ui = shellUi[SITE_LOCALE.en];
const states = shellStates[SITE_LOCALE.en];
const TENTH_MS = 100;

describe('the elapsed time shown while an answer is pending', () => {
  let mounted: MountedClient | undefined;

  async function mountBoth() {
    vi.resetModules();
    const { StopElapsed, ThinkingLine } = await import('./ShellLines.client');
    mounted = await mountClient(
      createElement(
        Fragment,
        null,
        createElement(
          'span',
          { 'data-testid': 'thinking' },
          createElement(ThinkingLine, { template: states.thinkingElapsed }),
        ),
        createElement(
          'span',
          { 'data-testid': 'stop' },
          createElement(StopElapsed, { template: ui.stopPill }),
        ),
      ),
    );
    const text = (id: string) =>
      mounted?.container.querySelector(`[data-testid="${id}"]`)?.textContent ?? '';
    return { text };
  }

  beforeEach(() => {
    vi.useFakeTimers({
      toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'],
    });
    delete document.body.dataset.motion;
  });
  afterEach(() => {
    mounted?.unmount();
    mounted = undefined;
    vi.useRealTimers();
    delete document.body.dataset.motion;
  });

  it('counts up in tenths of a second, so two readings differ', async () => {
    const { text } = await mountBoth();
    const first = text('stop');
    expect(first).toBe('■ stop · 0.0s');
    await act(async () => {
      vi.advanceTimersByTime(TENTH_MS * 12);
    });
    expect(text('stop')).toBe('■ stop · 1.2s');
    expect(text('stop')).not.toBe(first);
  });

  it('shows the same time in the thinking line and the stop pill', async () => {
    const { text } = await mountBoth();
    await act(async () => {
      vi.advanceTimersByTime(TENTH_MS * 25);
    });
    expect(text('thinking')).toBe('[ thinking 2.5s ]');
    expect(text('stop')).toBe('■ stop · 2.5s');
  });

  it('runs one timer for both readouts, and none once they are gone', async () => {
    await mountBoth();
    expect(vi.getTimerCount()).toBe(1);
    mounted?.unmount();
    mounted = undefined;
    expect(vi.getTimerCount()).toBe(0);
  });

  it('starts from zero again for the next answer', async () => {
    const first = await mountBoth();
    await act(async () => {
      vi.advanceTimersByTime(TENTH_MS * 30);
    });
    expect(first.text('stop')).toBe('■ stop · 3.0s');
    mounted?.unmount();
    mounted = undefined;
    const second = await mountBoth();
    expect(second.text('stop')).toBe('■ stop · 0.0s');
  });

  it('shows whole seconds only, and wakes once a second, while motion is off', async () => {
    document.body.dataset.motion = MOTION_BODY_STATE.reduce;
    const { text } = await mountBoth();
    expect(text('stop')).toBe('■ stop · 0s');
    await act(async () => {
      vi.advanceTimersByTime(TENTH_MS * 5);
    });
    expect(text('stop')).toBe('■ stop · 0s');
    await act(async () => {
      vi.advanceTimersByTime(TENTH_MS * 6);
    });
    expect(text('stop')).toBe('■ stop · 1s');
    expect(text('thinking')).toBe('[ thinking 1s ]');
    expect(vi.getTimerCount()).toBe(1);
  });
});
