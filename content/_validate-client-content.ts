import { z } from 'zod';
import { dmesgLines } from './dmesg';
import { DmesgLineSchema, ShellCommandsSchema, TerminalChromeSchema } from './schemas';
import SHELL_RESPONSES from './shell-commands';
import { contactChrome, shellChrome } from './terminal-chrome';

z.array(DmesgLineSchema).parse(dmesgLines);
ShellCommandsSchema.parse(SHELL_RESPONSES);
TerminalChromeSchema.parse(shellChrome);
TerminalChromeSchema.parse(contactChrome);
