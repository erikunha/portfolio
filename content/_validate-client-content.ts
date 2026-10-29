import { z } from 'zod';
import { dmesgLines } from './dmesg';
import { errorsContent } from './errors';
import { NAVIGATION } from './navigation';
import {
  createNavigationSchema,
  DmesgLineSchema,
  ErrorsContentSchema,
  SectionRegistrySchema,
  ShellCommandsSchema,
  TerminalChromeSchema,
} from './schemas';
import { SECTION_REGISTRY } from './section-registry';
import SHELL_RESPONSES from './shell-commands';
import { contactChrome, shellChrome } from './terminal-chrome';

z.array(DmesgLineSchema).parse(dmesgLines);
ShellCommandsSchema.parse(SHELL_RESPONSES);
TerminalChromeSchema.parse(shellChrome);
TerminalChromeSchema.parse(contactChrome);
SectionRegistrySchema.parse(SECTION_REGISTRY);
createNavigationSchema(SECTION_REGISTRY.map(({ id }) => id)).parse(NAVIGATION);
ErrorsContentSchema.parse(errorsContent);
