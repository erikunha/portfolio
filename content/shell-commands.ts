import { NOW_CURRENTLY, WHOIS_TITLE } from './now-currently';
import type { ShellResponse } from './schemas';
import { ShellCommand, ShellLineKind } from './shell-ui';
import { SITE_LOCALE } from './site-locale';
import { EMAIL_ADDRESS } from './social-urls';

export const SHELL_RESPONSE_LANG = SITE_LOCALE.en;

const SHELL_RESPONSES: ShellResponse[] = [
  {
    commands: [ShellCommand.Help],
    kind: ShellLineKind.Output,
    text: 'commands: help · whois · whois --recursive · cat skills.md · cat ~/.now · contact · privacy [forget <n|--all>] · clear\nanything else → sent to Claude, which only answers questions about Erik',
  },
  {
    commands: [ShellCommand.WhoIs, ShellCommand.WhoAmI],
    kind: ShellLineKind.Output,
    text: `erik · ${WHOIS_TITLE}`,
  },
  {
    commands: [ShellCommand.WhoIsRecursive, ShellCommand.WhoAmIRecursive],
    kind: ShellLineKind.Output,
    text: 'erik → engineer → builder → student → curious → 9yo with a guitar',
  },
  {
    commands: [ShellCommand.Skills],
    kind: ShellLineKind.Output,
    text: 'react, next.js, typescript, angular, node, fastify, web components, design systems, vercel ai sdk, agent orchestration, eval harnesses, spec-driven ai tooling',
  },
  {
    commands: [ShellCommand.Now],
    kind: ShellLineKind.Output,
    text: NOW_CURRENTLY,
  },
  {
    commands: [ShellCommand.Contact],
    kind: ShellLineKind.Output,
    text: `mailto: ${EMAIL_ADDRESS}`,
  },
];

export default SHELL_RESPONSES;
