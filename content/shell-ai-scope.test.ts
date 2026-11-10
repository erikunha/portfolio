import { describe, expect, it } from 'vitest';
import SHELL_RESPONSES from './shell-commands';
import { ShellCommand, shellUi } from './shell-ui';
import { SITE_LOCALE } from './site-locale';

describe('shell AI scope disclosure', () => {
  it('help tells the visitor that free text goes to Claude and only covers Erik', () => {
    const help = SHELL_RESPONSES.find((entry) => entry.commands.includes(ShellCommand.Help));
    expect(help?.text).toContain('sent to Claude');
    expect(
      help?.text,
      'the ask prompt declines off-topic questions, so help must say the model only answers about Erik',
    ).toMatch(/only (?:answers? )?(?:questions )?about Erik/i);
  });

  it.each([
    [SITE_LOCALE.en, /anything/i],
    [SITE_LOCALE.pt, /qualquer coisa/i],
  ])('the %s placeholder does not invite questions the model declines', (locale, openEnded) => {
    const { placeholder } = shellUi[locale];
    expect(placeholder, `${locale} placeholder promises an open-ended assistant`).not.toMatch(
      openEnded,
    );
    expect(placeholder).toContain('Erik');
  });

  it('help lists the renamed stack command and every local command the shell accepts', () => {
    const help = SHELL_RESPONSES.find((entry) => entry.commands.includes(ShellCommand.Help));
    const text = help?.text ?? '';
    expect(text).toContain(ShellCommand.Stack);
    for (const command of [
      ShellCommand.WhoIs,
      ShellCommand.WhoAmI,
      ShellCommand.WhoIsRecursive,
      ShellCommand.WhoAmIRecursive,
      ShellCommand.Stack,
    ]) {
      expect(text, `${command} is accepted by the shell, so help must name it`).toContain(command);
    }
  });

  it('the stack answer points at the AI engineer direction', () => {
    const stack = SHELL_RESPONSES.find((entry) => entry.commands.includes(ShellCommand.Stack));
    expect(stack?.text).toContain('llm systems');
    expect(stack?.text).toContain('eval harnesses');
    expect(stack?.text).toContain('agent orchestration');
    expect(stack?.text).toContain('mcp servers');
  });
});
