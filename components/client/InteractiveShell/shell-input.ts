import type { ShellResponse } from '@/content/schemas';
import SHELL_RESPONSES from '@/content/shell-commands';
import { ShellCommand } from '@/content/shell-ui';
import { type PrivacyCommand, parsePrivacyCommand } from './privacy-command';
import { ShellKey } from './shell-keys';
import { HISTORY_STEP } from './useCommandHistory';

const COMPOSITION_KEYCODE = 229;
const WHITESPACE_RUN = /\s+/g;

export const ShellInputKind = {
  Empty: 'empty',
  Clear: 'clear',
  Privacy: 'privacy',
  Local: 'local',
  Question: 'question',
} as const;

export type ShellInput =
  | { kind: typeof ShellInputKind.Empty }
  | { kind: typeof ShellInputKind.Clear; command: string }
  | { kind: typeof ShellInputKind.Privacy; command: string; privacy: PrivacyCommand }
  | { kind: typeof ShellInputKind.Local; command: string; response: ShellResponse }
  | { kind: typeof ShellInputKind.Question; command: string; question: string };

export function parseShellInput(raw: string): ShellInput {
  const command = raw.trim().replace(WHITESPACE_RUN, ' ');
  if (!command) return { kind: ShellInputKind.Empty };
  const key = command.toLowerCase();
  if (key === ShellCommand.Clear) return { kind: ShellInputKind.Clear, command };
  const privacy = parsePrivacyCommand(key);
  if (privacy) return { kind: ShellInputKind.Privacy, command, privacy };
  const explicitQuestion = key.startsWith(ShellCommand.AskPrefix)
    ? command.slice(ShellCommand.AskPrefix.length).trim()
    : null;
  if (explicitQuestion === null) {
    const response = SHELL_RESPONSES.find((entry) => entry.commands.includes(key));
    if (response) return { kind: ShellInputKind.Local, command, response };
  }
  return { kind: ShellInputKind.Question, command, question: explicitQuestion ?? command };
}

export function historyStepFor(
  key: string,
  keystroke: { composing: boolean; modified: boolean },
): (typeof HISTORY_STEP)[keyof typeof HISTORY_STEP] | null {
  if (keystroke.composing || keystroke.modified) return null;
  if (key === ShellKey.Up) return HISTORY_STEP.Older;
  if (key === ShellKey.Down) return HISTORY_STEP.Newer;
  return null;
}

export function isCompositionEnter(key: string, composing: boolean, keyCode: number): boolean {
  return key === ShellKey.Enter && (composing || keyCode === COMPOSITION_KEYCODE);
}
