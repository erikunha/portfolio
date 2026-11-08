import { act, createElement } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { type MountedClient, mountClient } from '@/__tests__/helpers/render';
import { SHELL_LIMITS } from '@/content/shell-ui';
import { HISTORY_STEP, useCommandHistory } from './useCommandHistory';

type History = ReturnType<typeof useCommandHistory>;

describe('useCommandHistory', () => {
  let mounted: MountedClient | undefined;

  afterEach(() => {
    mounted?.unmount();
    mounted = undefined;
  });

  async function mountHistory(): Promise<History> {
    const captured: { history?: History } = {};
    function Probe() {
      captured.history = useCommandHistory();
      return null;
    }
    mounted = await mountClient(createElement(Probe));
    return captured.history as History;
  }

  function older(history: History, current: string): string {
    let recalled = '';
    act(() => {
      recalled = history.recall(HISTORY_STEP.Older, current);
    });
    return recalled;
  }

  function newer(history: History, current: string): string {
    let recalled = '';
    act(() => {
      recalled = history.recall(HISTORY_STEP.Newer, current);
    });
    return recalled;
  }

  it('returns the current text when nothing has been recorded', async () => {
    const history = await mountHistory();
    expect(older(history, 'typing')).toBe('typing');
    expect(newer(history, 'typing')).toBe('typing');
  });

  it('walks back through recorded commands and stops at the oldest', async () => {
    const history = await mountHistory();
    history.record('help');
    history.record('whois');
    expect(older(history, '')).toBe('whois');
    expect(older(history, 'whois')).toBe('help');
    expect(older(history, 'help')).toBe('help');
  });

  it('restores the unsent draft after walking forward past the newest command', async () => {
    const history = await mountHistory();
    history.record('help');
    history.record('whois');
    expect(older(history, 'unsent draft')).toBe('whois');
    expect(older(history, 'whois')).toBe('help');
    expect(newer(history, 'help')).toBe('whois');
    expect(newer(history, 'whois')).toBe('unsent draft');
    expect(newer(history, 'unsent draft')).toBe('unsent draft');
  });

  it('starts over from the newest command after an edit', async () => {
    const history = await mountHistory();
    history.record('help');
    history.record('whois');
    expect(older(history, '')).toBe('whois');
    expect(older(history, 'whois')).toBe('help');
    history.noteEdit();
    expect(older(history, 'help2')).toBe('whois');
    expect(newer(history, 'whois')).toBe('help2');
  });

  it('starts over from the newest command after recording another', async () => {
    const history = await mountHistory();
    history.record('help');
    expect(older(history, '')).toBe('help');
    history.record('whois');
    expect(older(history, '')).toBe('whois');
  });

  it('keeps only the newest commands up to the shell limit', async () => {
    const history = await mountHistory();
    const total = SHELL_LIMITS.commandHistory + 5;
    for (let index = 0; index < total; index++) history.record(`cmd-${index}`);
    let oldest = '';
    for (let step = 0; step < total; step++) oldest = older(history, oldest);
    expect(oldest).toBe('cmd-5');
  });
});
