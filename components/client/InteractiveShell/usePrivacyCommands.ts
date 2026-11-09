'use client';

import { type Dispatch, type SetStateAction, useCallback, useRef } from 'react';
import type { ShellStates } from '@/content/shell-states.schema';
import { fillShellState, ShellLineKind, type ShellUi } from '@/content/shell-ui';
import {
  type ForgetResult,
  forgetMany,
  forgetRequest,
  wasForgotten,
} from '@/lib/forget-request.client';
import { listRefs } from '@/lib/request-refs.client';
import { describeForget } from './forget-message';
import { PRIVACY_COMMAND_KIND, type PrivacyCommand } from './privacy-command';
import { bounded, type Line, type LineKind } from './useAskStream';

type Entry = { kind: LineKind; text: string };

function forgetTarget(command: PrivacyCommand, refs: readonly string[]): string | undefined {
  if (command.kind === PRIVACY_COMMAND_KIND.ForgetNumber) return refs[command.number - 1];
  if (command.kind === PRIVACY_COMMAND_KIND.ForgetId) return command.id;
  return undefined;
}

function unknownTarget(command: PrivacyCommand): string {
  return command.kind === PRIVACY_COMMAND_KIND.ForgetNumber ? String(command.number) : '';
}

export function usePrivacyCommands({
  ui,
  states,
  nextId,
  setHistory,
  announce,
  focusInput,
}: {
  ui: ShellUi;
  states: ShellStates;
  nextId: () => number;
  setHistory: Dispatch<SetStateAction<Line[]>>;
  announce: (text: string) => void;
  focusInput: () => void;
}) {
  const forgetBusyRef = useRef(false);
  return useCallback(
    async (command: PrivacyCommand) => {
      const push = (entries: Entry[]) =>
        setHistory((lines) =>
          bounded([...lines, ...entries.map((entry) => ({ id: nextId(), ...entry }))]),
        );
      const forgetLines = (id: string, result: ForgetResult): Entry => ({
        kind: wasForgotten(result) ? ShellLineKind.Output : ShellLineKind.Error,
        text: `${id} ${describeForget(result, ui, states)}`,
      });
      const finish = () => {
        announce(ui.commandComplete);
        focusInput();
      };
      const refs = listRefs();
      if (command.kind === PRIVACY_COMMAND_KIND.Usage) {
        push([{ kind: ShellLineKind.Info, text: ui.privacyUsage }]);
        return finish();
      }
      if (command.kind === PRIVACY_COMMAND_KIND.List) {
        push(
          refs.length === 0
            ? [{ kind: ShellLineKind.Info, text: ui.privacyEmpty }]
            : [
                {
                  kind: ShellLineKind.Info,
                  text: fillShellState(ui.privacyHeader, { count: String(refs.length) }),
                },
                ...refs.map((id, index) => ({
                  kind: ShellLineKind.Output,
                  text: `${index + 1}. ${id}`,
                })),
              ],
        );
        return finish();
      }
      if (forgetBusyRef.current) {
        announce(ui.forgetting);
        return;
      }
      const forgetAll = command.kind === PRIVACY_COMMAND_KIND.ForgetAll;
      const target = forgetTarget(command, refs);
      if (forgetAll && refs.length === 0) {
        push([{ kind: ShellLineKind.Info, text: ui.privacyEmpty }]);
        return finish();
      }
      if (!forgetAll && target === undefined) {
        push([
          {
            kind: ShellLineKind.Error,
            text: fillShellState(ui.privacyUnknown, { target: unknownTarget(command) }),
          },
        ]);
        return finish();
      }
      forgetBusyRef.current = true;
      announce(ui.forgetting);
      try {
        if (forgetAll) {
          const batch = await forgetMany(refs);
          const notAttempted: Entry[] =
            batch.unattempted.length > 0
              ? [
                  {
                    kind: ShellLineKind.Info,
                    text: fillShellState(ui.privacyNotAttempted, {
                      count: String(batch.unattempted.length),
                    }),
                  },
                ]
              : [];
          push([
            ...batch.results.map(({ id, result }) => forgetLines(id, result)),
            ...notAttempted,
          ]);
        } else if (target !== undefined) {
          push([forgetLines(target, await forgetRequest(target))]);
        }
      } finally {
        forgetBusyRef.current = false;
      }
      finish();
    },
    [announce, focusInput, nextId, setHistory, states, ui],
  );
}
