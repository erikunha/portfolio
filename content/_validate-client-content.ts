import { z } from 'zod';
import { ContactContentSchema } from './contact';
import { contactCopy } from './contact-copy';
import { dmesgLines } from './dmesg';
import { errorsContent } from './errors';
import { NAVIGATION } from './navigation';
import {
  createNavigationSchema,
  DmesgLineSchema,
  ErrorsContentSchema,
  SectionRegistrySchema,
  ShellCommandsSchema,
  ShellUiSchema,
  TerminalChromeSchema,
} from './schemas';
import { SECTION_REGISTRY } from './section-registry';
import SHELL_RESPONSES from './shell-commands';
import { shellUi } from './shell-ui';
import { EMAIL_ADDRESS, LINKEDIN_URL } from './social-urls';
import { contactChrome, shellChrome } from './terminal-chrome';

z.array(DmesgLineSchema).parse(dmesgLines);
ShellCommandsSchema.parse(SHELL_RESPONSES);
ShellUiSchema.parse(shellUi);
TerminalChromeSchema.parse(shellChrome);
TerminalChromeSchema.parse(contactChrome);
SectionRegistrySchema.parse(SECTION_REGISTRY);
createNavigationSchema(SECTION_REGISTRY.map(({ id }) => id)).parse(NAVIGATION);
ContactContentSchema.parse(contactCopy);
z.object({ email: z.email(), linkedin: z.url() }).parse({
  email: EMAIL_ADDRESS,
  linkedin: LINKEDIN_URL,
});
ErrorsContentSchema.parse(errorsContent);
