import { describe, expect, it } from 'vitest';
import { PRIVACY_COMMAND_KIND, parsePrivacyCommand } from './privacy-command';

const ID = '7f3a9c2e-41b0-4d8e-9a77-3c51d0b2e8aa';

describe('parsePrivacyCommand', () => {
  it.each(['help', 'whois', 'privacyx', 'privacy-forget', 'forget privacy', '', 'ask privacy'])(
    'ignores %j because it is not the privacy command',
    (input) => {
      expect(parsePrivacyCommand(input)).toBeNull();
    },
  );

  it('parses the bare command as a list', () => {
    expect(parsePrivacyCommand('privacy')).toEqual({ kind: PRIVACY_COMMAND_KIND.List });
  });

  it('parses forget --all', () => {
    expect(parsePrivacyCommand('privacy forget --all')).toEqual({
      kind: PRIVACY_COMMAND_KIND.ForgetAll,
    });
  });

  it('parses forget with a 1-based list number', () => {
    expect(parsePrivacyCommand('privacy forget 2')).toEqual({
      kind: PRIVACY_COMMAND_KIND.ForgetNumber,
      number: 2,
    });
  });

  it('parses forget with a full id, lowercased', () => {
    expect(parsePrivacyCommand(`privacy forget ${ID.toUpperCase()}`)).toEqual({
      kind: PRIVACY_COMMAND_KIND.ForgetId,
      id: ID,
    });
  });

  it.each([
    'privacy forget',
    'privacy forget 0',
    'privacy forget -1',
    'privacy forget 1 2',
    'privacy forget abc',
    'privacy forget --every',
    'privacy delete 1',
    'privacy 1',
  ])('answers %j with usage', (input) => {
    expect(parsePrivacyCommand(input)).toEqual({ kind: PRIVACY_COMMAND_KIND.Usage });
  });

  it('tolerates extra spaces', () => {
    expect(parsePrivacyCommand('privacy   forget   --all')).toEqual({
      kind: PRIVACY_COMMAND_KIND.ForgetAll,
    });
  });
});
