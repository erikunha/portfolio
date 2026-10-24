import { z } from 'zod';
import { type ContactContent, contactContent } from './contact';
import { dmesgLines } from './dmesg';
import { DmesgLineSchema, ShellCommandsSchema, TerminalChromeSchema } from './schemas';
import SHELL_RESPONSES from './shell-commands';
import { contactChrome, shellChrome } from './terminal-chrome';

z.array(DmesgLineSchema).parse(dmesgLines);
ShellCommandsSchema.parse(SHELL_RESPONSES);
TerminalChromeSchema.parse(shellChrome);
TerminalChromeSchema.parse(contactChrome);

const ContactContentSchema: z.ZodType<ContactContent> = z.object({
  success: z.object({ title: z.string().min(1), message: z.string().min(1) }),
  queued: z.object({
    title: z.string().min(1),
    message: z.string().min(1),
    linkLabel: z.string().min(1),
    linkHref: z.url(),
  }),
  form: z.object({
    nameLabel: z.string().min(1),
    emailLabel: z.string().min(1),
    messageLabel: z.string().min(1),
    requiredPlaceholder: z.string().min(1),
    messagePlaceholder: z.string().min(1),
    submit: z.string().min(1),
    submitting: z.string().min(1),
    waiting: z.string().min(1),
    errorPrefix: z.string().min(1),
  }),
  errors: z.object({
    storageUnavailable: z.string().min(1),
    retryUnavailable: z.string().min(1),
    rateLimited: z.string().min(1),
    requestFailed: z.string().min(1),
  }),
});

ContactContentSchema.parse(contactContent);
