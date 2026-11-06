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
});
