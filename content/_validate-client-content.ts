// Build-time-only validator for content modules that are imported by client
// components (Footer → dmesg, InteractiveShell → shell-commands).
//
// Those modules are now pure typed data with no Zod runtime, so the client
// bundle no longer pulls Zod's Function-constructor codegen path (which would
// otherwise trigger CSP eval violations under script-src 'strict-dynamic').
//
// scripts/validate-content.mjs imports this file via tsx in a child process,
// so it never enters the app's static module graph.

import { z } from 'zod';
import { dmesgLines } from './dmesg';
import { DmesgLineSchema, ShellCommandsSchema } from './schemas';
import SHELL_RESPONSES from './shell-commands';

z.array(DmesgLineSchema).parse(dmesgLines);
ShellCommandsSchema.parse(SHELL_RESPONSES);
