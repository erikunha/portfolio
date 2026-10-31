import type { TerminalChrome, TopbarChrome } from './schemas';

export const shellChrome: TerminalChrome = {
  promptLabel: 'erik@portfolio · /bin/sh',
  rightTag: 'SESSION_ID: 0xDEADBEEF',
  mobileLabel: 'ZSH',
};

export const contactChrome: TerminalChrome = {
  promptLabel: 'erik@portfolio · contact',
  rightTag: 'SECURE_CHANNEL',
};

export const topbarChrome: TopbarChrome = {
  brandMark: '■',
  brandLabel: 'ERIK_CUNHA.SH',
  brandClose: '×',
};
