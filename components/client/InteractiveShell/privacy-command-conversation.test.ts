import { describe, expect, it } from 'vitest';
import { PRIVACY_COMMAND_KIND, parsePrivacyCommand } from './privacy-command';

describe('privacy forget with no target', () => {
  it.each(['privacy forget', 'PRIVACY FORGET', '  privacy   forget  '])(
    'parses %j as forgetting this conversation',
    (input) => {
      expect(parsePrivacyCommand(input)).toEqual({ kind: PRIVACY_COMMAND_KIND.ForgetConversation });
    },
  );
});
