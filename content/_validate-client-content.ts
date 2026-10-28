import { z } from 'zod';
import { ContactContentSchema } from './contact';
import { contactCopy } from './contact-copy';
import { dmesgLines } from './dmesg';
import { DmesgLineSchema, ShellCommandsSchema, TerminalChromeSchema } from './schemas';
import SHELL_RESPONSES from './shell-commands';
import { EMAIL_ADDRESS, LINKEDIN_URL } from './social-urls';
import { contactChrome, shellChrome } from './terminal-chrome';

z.array(DmesgLineSchema).parse(dmesgLines);
ShellCommandsSchema.parse(SHELL_RESPONSES);
TerminalChromeSchema.parse(shellChrome);
TerminalChromeSchema.parse(contactChrome);
ContactContentSchema.parse(contactCopy);
z.object({ email: z.email(), linkedin: z.url() }).parse({
  email: EMAIL_ADDRESS,
  linkedin: LINKEDIN_URL,
});
