'use client';

import { type Dispatch, type SetStateAction, useCallback, useRef } from 'react';
import type { ShellStates } from '@/content/shell-states.schema';
import { fillShellState, ShellLineKind, type ShellUi } from '@/content/shell-ui';
import {
  conversationQuestions,
  forgetWithConversation,
  holdForget,
  inConversation,
  latestConversationRequest,
} from '@/lib/ask-conversation.client';
import { type ForgetResult, forgetMany, wasForgotten } from '@/lib/forget-request.client';
import { listRefs } from '@/lib/request-refs.client';
import { describeForget } from './forget-message';
import { PRIVACY_COMMAND_KIND, type PrivacyCommand } from './privacy-command';
import { bounded, type Line, type LineKind } from './useAskStream';

type Entry = { kind: LineKind; text: string };

function forgetTarget(command: PrivacyCommand, refs: readonly string[]): string | undefined {
  if (command.kind === PRIVACY_COMMAND_KIND.ForgetNumber) return refs[command.number - 1];
  if (command.kind === PRIVACY_COMMAND_KIND.ForgetId) return command.id;
  if (command.kind === PRIVACY_COMMAND_KIND.ForgetConversation) {
    return latestConversationRequest() ?? undefined;
  }
  return undefined;
}

function forgetAllTargets(refs: readonly string[]): string[] {
  const latest = latestConversationRequest();
  const others = refs.filter((id) => !inConversation(id));
  return latest === null ? others : [latest, ...others];
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
  onConversationForgotten,
}: {
  ui: ShellUi;
  states: ShellStates;
  nextId: () => number;
  setHistory: Dispatch<SetStateAction<Line[]>>;
  announce: (text: string) => void;
  focusInput: () => void;
  onConversationForgotten: (questions: number) => void;
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
      const allTargets = forgetAll ? forgetAllTargets(refs) : [];
      if (forgetAll && allTargets.length === 0) {
        push([{ kind: ShellLineKind.Info, text: ui.privacyEmpty }]);
        return finish();
      }
      if (command.kind === PRIVACY_COMMAND_KIND.ForgetConversation && target === undefined) {
        push([{ kind: ShellLineKind.Info, text: ui.privacyNoConversation }]);
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
      const releaseForget = holdForget();
      announce(ui.forgetting);
      const questions = conversationQuestions();
      let endedConversation = false;
      const forgetOne = async (id: string) => {
        const outcome = await forgetWithConversation(id);
        endedConversation ||= outcome.endedConversation;
        return outcome.result;
      };
      try {
        if (forgetAll) {
          const batch = await forgetMany(allTargets, forgetOne);
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
          push([forgetLines(target, await forgetOne(target))]);
        }
      } finally {
        forgetBusyRef.current = false;
        releaseForget();
      }
      if (endedConversation) {
        onConversationForgotten(questions);
        return;
      }
      finish();
    },
    [announce, focusInput, nextId, onConversationForgotten, setHistory, states, ui],
  );
}
