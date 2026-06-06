// content/terminal-chrome.ts
// Terminal-window chrome labels (header prompt + right-side tag, plus an
// optional short mobile label) for the interactive shell and the contact form's
// ContactShell. Pure typed data — imported by client components, so NO Zod
// runtime here (keeps Zod's Function-constructor codegen out of the client
// bundle / CSP). Validated at build time via content/_validate-client-content.ts.
import type { TerminalChrome } from './schemas';

export const shellChrome: TerminalChrome = {
  promptLabel: 'erik@portfolio · /bin/sh',
  rightTag: 'SESSION_ID: 0xDEADBEEF',
  mobileLabel: 'ZSH',
};

export const contactChrome: TerminalChrome = {
  promptLabel: 'erik@portfolio · contact',
  rightTag: 'SECURE_CHANNEL',
};
