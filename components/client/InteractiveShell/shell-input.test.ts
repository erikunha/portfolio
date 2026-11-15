import { describe, expect, it } from 'vitest';
import SHELL_RESPONSES from '@/content/shell-commands';
import { ShellCommand } from '@/content/shell-ui';
import { PRIVACY_COMMAND_KIND } from './privacy-command';
import { historyStepFor, isCompositionEnter, parseShellInput, ShellInputKind } from './shell-input';
import { ShellKey } from './shell-keys';
import { HISTORY_STEP } from './useCommandHistory';

const KEYSTROKE = { composing: false, modified: false };
const ENTER_KEYCODE = 13;
const COMPOSITION_KEYCODE = 229;

describe('parseShellInput', () => {
  it.each(['', ' ', '   \t  '])('treats %j as empty', (raw) => {
    expect(parseShellInput(raw)).toEqual({ kind: ShellInputKind.Empty });
  });

  it.each([
    ['clear', 'clear'],
    ['  CLEAR ', 'CLEAR'],
    ['Clear', 'Clear'],
  ])('recognises clear from %j', (raw, command) => {
    expect(parseShellInput(raw)).toEqual({ kind: ShellInputKind.Clear, command });
  });

  it('collapses inner whitespace in the recorded command', () => {
    expect(parseShellInput('who  is\tme')).toMatchObject({ command: 'who is me' });
    expect(parseShellInput('  Help  ')).toMatchObject({
      kind: ShellInputKind.Local,
      command: 'Help',
    });
  });

  it.each(
    SHELL_RESPONSES.flatMap((entry) => entry.commands.map((command) => [command, entry] as const)),
  )('matches local command %s case-insensitively', (command, entry) => {
    for (const raw of [command, ` ${command.toUpperCase()} `]) {
      const parsed = parseShellInput(raw);
      expect(parsed.kind).toBe(ShellInputKind.Local);
      if (parsed.kind === ShellInputKind.Local) expect(parsed.response).toBe(entry);
    }
  });

  it.each([
    ['privacy', PRIVACY_COMMAND_KIND.List],
    ['PRIVACY forget --all', PRIVACY_COMMAND_KIND.ForgetAll],
    ['privacy forget', PRIVACY_COMMAND_KIND.ForgetConversation],
    ['privacy nonsense', PRIVACY_COMMAND_KIND.Usage],
  ])('parses privacy command %s', (raw, kind) => {
    const parsed = parseShellInput(raw);
    expect(parsed.kind).toBe(ShellInputKind.Privacy);
    if (parsed.kind === ShellInputKind.Privacy) expect(parsed.privacy.kind).toBe(kind);
  });

  it('sends free text as a question with the trimmed command', () => {
    expect(parseShellInput('  what do you build?  ')).toEqual({
      kind: ShellInputKind.Question,
      command: 'what do you build?',
      question: 'what do you build?',
    });
  });

  it('strips the ask prefix from an explicit question and keeps the typed command', () => {
    expect(parseShellInput('Ask  Why Next?')).toEqual({
      kind: ShellInputKind.Question,
      command: 'Ask Why Next?',
      question: 'Why Next?',
    });
  });

  it('does not treat an explicit ask as a local command', () => {
    expect(parseShellInput(`${ShellCommand.AskPrefix}help`)).toMatchObject({
      kind: ShellInputKind.Question,
      question: 'help',
    });
  });
});

describe('historyStepFor', () => {
  it('maps ArrowUp to older and ArrowDown to newer', () => {
    expect(historyStepFor(ShellKey.Up, KEYSTROKE)).toBe(HISTORY_STEP.Older);
    expect(historyStepFor(ShellKey.Down, KEYSTROKE)).toBe(HISTORY_STEP.Newer);
  });

  it.each([ShellKey.Left, ShellKey.Right, ShellKey.Home, ShellKey.End, ShellKey.Enter, 'a'])(
    'ignores %s',
    (key) => {
      expect(historyStepFor(key, KEYSTROKE)).toBeNull();
    },
  );

  it('ignores arrows while composing or with a modifier held', () => {
    expect(historyStepFor(ShellKey.Up, { composing: true, modified: false })).toBeNull();
    expect(historyStepFor(ShellKey.Down, { composing: false, modified: true })).toBeNull();
  });
});

describe('isCompositionEnter', () => {
  it('flags Enter during composition or with the composition keycode', () => {
    expect(isCompositionEnter(ShellKey.Enter, true, ENTER_KEYCODE)).toBe(true);
    expect(isCompositionEnter(ShellKey.Enter, false, COMPOSITION_KEYCODE)).toBe(true);
  });

  it('lets a plain Enter and other keys through', () => {
    expect(isCompositionEnter(ShellKey.Enter, false, ENTER_KEYCODE)).toBe(false);
    expect(isCompositionEnter('a', true, COMPOSITION_KEYCODE)).toBe(false);
  });
});
