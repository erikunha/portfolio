import { act, createElement, type Dispatch, type SetStateAction, useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { type MountedClient, mountClient } from '@/__tests__/helpers/render';
import { fillShellState, ShellLineKind, shellStates, shellUi } from '@/content/shell-ui';
import { SITE_LOCALE } from '@/content/site-locale';
import { FORGET_OUTCOME, type ForgetResult } from '@/lib/forget-request.client';
import { PRIVACY_COMMAND_KIND, type PrivacyCommand } from './privacy-command';
import type { Line } from './useAskStream';
import { usePrivacyCommands } from './usePrivacyCommands';

const mocks = vi.hoisted(() => ({
  listRefs: vi.fn<() => readonly string[]>(),
  forgetRequest: vi.fn<(id: string) => Promise<ForgetResult>>(),
  forgetMany: vi.fn(),
}));

vi.mock('@/lib/request-refs.client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/request-refs.client')>()),
  listRefs: mocks.listRefs,
}));
vi.mock('@/lib/forget-request.client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/forget-request.client')>()),
  forgetRequest: mocks.forgetRequest,
  forgetMany: mocks.forgetMany,
}));

const ui = shellUi[SITE_LOCALE.en];
const states = shellStates[SITE_LOCALE.en];
const FIRST = '7f3a9c2e-41b0-4d8e-9a77-3c51d0b2e8aa';
const SECOND = '0b9d11e4-7c2a-4f6e-8e0d-2a6b9f3c1d55';
const DELETED: ForgetResult = { outcome: FORGET_OUTCOME.Deleted };
const FAILED: ForgetResult = { outcome: FORGET_OUTCOME.Failed };

describe('usePrivacyCommands', () => {
  let mounted: MountedClient | undefined;
  let lines: Line[];
  const announce = vi.fn();
  const focusInput = vi.fn();
  let run: (command: PrivacyCommand) => Promise<void>;

  beforeEach(() => {
    lines = [];
    announce.mockReset();
    focusInput.mockReset();
    mocks.listRefs.mockReset().mockReturnValue([]);
    mocks.forgetRequest.mockReset();
    mocks.forgetMany.mockReset();
  });

  afterEach(() => {
    mounted?.unmount();
    mounted = undefined;
  });

  async function mountPrivacy() {
    let counter = 0;
    const nextId = () => ++counter;
    function Probe() {
      const [history, setHistory] = useState<Line[]>([]);
      lines = history;
      run = usePrivacyCommands({
        ui,
        states,
        nextId,
        setHistory: setHistory as Dispatch<SetStateAction<Line[]>>,
        announce,
        focusInput,
      });
      return null;
    }
    mounted = await mountClient(createElement(Probe));
  }

  async function dispatch(command: PrivacyCommand) {
    await act(async () => {
      await run(command);
    });
  }

  const texts = () => lines.map((line) => ({ kind: line.kind, text: line.text }));
  const completed = () => {
    expect(announce).toHaveBeenLastCalledWith(ui.commandComplete);
    expect(focusInput).toHaveBeenCalledTimes(1);
  };

  it('prints the usage line', async () => {
    await mountPrivacy();
    await dispatch({ kind: PRIVACY_COMMAND_KIND.Usage });
    expect(texts()).toEqual([{ kind: ShellLineKind.Info, text: ui.privacyUsage }]);
    completed();
  });

  it('says so when the session has logged no request', async () => {
    await mountPrivacy();
    await dispatch({ kind: PRIVACY_COMMAND_KIND.List });
    expect(texts()).toEqual([{ kind: ShellLineKind.Info, text: ui.privacyEmpty }]);
    completed();
  });

  it('lists the logged requests under a count header', async () => {
    mocks.listRefs.mockReturnValue([FIRST, SECOND]);
    await mountPrivacy();
    await dispatch({ kind: PRIVACY_COMMAND_KIND.List });
    expect(texts()).toEqual([
      { kind: ShellLineKind.Info, text: fillShellState(ui.privacyHeader, { count: '2' }) },
      { kind: ShellLineKind.Output, text: `1. ${FIRST}` },
      { kind: ShellLineKind.Output, text: `2. ${SECOND}` },
    ]);
    completed();
  });

  it('reports a number with no logged request and sends nothing', async () => {
    mocks.listRefs.mockReturnValue([FIRST]);
    await mountPrivacy();
    await dispatch({ kind: PRIVACY_COMMAND_KIND.ForgetNumber, number: 4 });
    expect(texts()).toEqual([
      { kind: ShellLineKind.Error, text: fillShellState(ui.privacyUnknown, { target: '4' }) },
    ]);
    expect(mocks.forgetRequest).not.toHaveBeenCalled();
    completed();
  });

  it('forgets the request at a listed number', async () => {
    mocks.listRefs.mockReturnValue([FIRST, SECOND]);
    mocks.forgetRequest.mockResolvedValue(DELETED);
    await mountPrivacy();
    await dispatch({ kind: PRIVACY_COMMAND_KIND.ForgetNumber, number: 2 });
    expect(mocks.forgetRequest).toHaveBeenCalledWith(SECOND);
    expect(texts()).toEqual([
      { kind: ShellLineKind.Output, text: `${SECOND} ${ui.forgetDeleted}` },
    ]);
    expect(announce).toHaveBeenNthCalledWith(1, ui.forgetting);
    completed();
  });

  it('forgets an id and shows a failure as an error line', async () => {
    mocks.forgetRequest.mockResolvedValue(FAILED);
    await mountPrivacy();
    await dispatch({ kind: PRIVACY_COMMAND_KIND.ForgetId, id: FIRST });
    expect(mocks.forgetRequest).toHaveBeenCalledWith(FIRST);
    expect(texts()).toEqual([{ kind: ShellLineKind.Error, text: `${FIRST} ${ui.forgetFailed}` }]);
    completed();
  });

  it('says so when forgetting everything with nothing logged', async () => {
    await mountPrivacy();
    await dispatch({ kind: PRIVACY_COMMAND_KIND.ForgetAll });
    expect(texts()).toEqual([{ kind: ShellLineKind.Info, text: ui.privacyEmpty }]);
    expect(mocks.forgetMany).not.toHaveBeenCalled();
    completed();
  });

  it('forgets every request and reports the ones left unattempted', async () => {
    mocks.listRefs.mockReturnValue([FIRST, SECOND]);
    mocks.forgetMany.mockResolvedValue({
      results: [{ id: FIRST, result: DELETED }],
      unattempted: [SECOND],
    });
    await mountPrivacy();
    await dispatch({ kind: PRIVACY_COMMAND_KIND.ForgetAll });
    expect(mocks.forgetMany).toHaveBeenCalledWith([FIRST, SECOND]);
    expect(texts()).toEqual([
      { kind: ShellLineKind.Output, text: `${FIRST} ${ui.forgetDeleted}` },
      { kind: ShellLineKind.Info, text: fillShellState(ui.privacyNotAttempted, { count: '1' }) },
    ]);
    completed();
  });

  it('refuses a second forget while one is in flight, then accepts the next', async () => {
    mocks.listRefs.mockReturnValue([FIRST]);
    let release: (result: ForgetResult) => void = () => undefined;
    mocks.forgetRequest.mockImplementationOnce(
      () =>
        new Promise<ForgetResult>((resolve) => {
          release = resolve;
        }),
    );
    await mountPrivacy();
    let first: Promise<void> = Promise.resolve();
    await act(async () => {
      first = run({ kind: PRIVACY_COMMAND_KIND.ForgetId, id: FIRST });
    });
    await dispatch({ kind: PRIVACY_COMMAND_KIND.ForgetId, id: SECOND });
    expect(mocks.forgetRequest).toHaveBeenCalledTimes(1);
    expect(announce).toHaveBeenCalledTimes(2);
    expect(announce).toHaveBeenLastCalledWith(ui.forgetting);
    expect(focusInput).not.toHaveBeenCalled();
    await act(async () => {
      release(DELETED);
      await first;
    });
    completed();
    mocks.forgetRequest.mockResolvedValue(DELETED);
    await dispatch({ kind: PRIVACY_COMMAND_KIND.ForgetId, id: SECOND });
    expect(mocks.forgetRequest).toHaveBeenCalledTimes(2);
  });
});
