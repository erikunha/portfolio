import { z } from 'zod';
import { dmesgLines } from './dmesg';
import { errorsContent } from './errors';
import {
  DmesgLineSchema,
  ErrorsContentSchema,
  ShellCommandsSchema,
  ShellUiSchema,
  TerminalChromeSchema,
} from './schemas';
import SHELL_RESPONSES from './shell-commands';
import { shellUi } from './shell-ui';
import { contactChrome, shellChrome } from './terminal-chrome';

z.array(DmesgLineSchema).parse(dmesgLines);
ShellCommandsSchema.parse(SHELL_RESPONSES);
ShellUiSchema.parse(shellUi);
TerminalChromeSchema.parse(shellChrome);
TerminalChromeSchema.parse(contactChrome);
ErrorsContentSchema.parse(errorsContent);
