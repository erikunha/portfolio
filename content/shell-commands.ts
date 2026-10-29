import { NOW_CURRENTLY, WHOIS_TITLE } from './now-currently';
import type { ShellResponse } from './schemas';
import { ShellCommand, ShellLineKind } from './shell-ui';

const SHELL_RESPONSES: ShellResponse[] = [
  {
    commands: [ShellCommand.Help],
    kind: ShellLineKind.Output,
    text: 'commands: help · whois · whois --recursive · ls · cat skills.md · cat ~/.now · contact · face · hire · clear\nanything else → sent to Claude',
  },
  {
    commands: [ShellCommand.WhoIs, ShellCommand.WhoAmI],
    kind: ShellLineKind.Output,
    text: `erik — ${WHOIS_TITLE}`,
  },
  {
    commands: [ShellCommand.WhoIsRecursive, ShellCommand.WhoAmIRecursive],
    kind: ShellLineKind.Output,
    text: 'erik → engineer → builder → student → curious → 9yo with a guitar',
  },
  {
    commands: [ShellCommand.List],
    kind: ShellLineKind.Output,
    text: 'README.md  ~/.now  ~/.guitar_rig  ~/.visa  ~/.unknowns  ~/.community  ~/.credentials  hottest_takes.md  contact',
  },
  {
    commands: [ShellCommand.Skills],
    kind: ShellLineKind.Output,
    text: 'angular, react, next.js, typescript, node, rxjs, ngrx, web components, spec-driven ai tooling',
  },
  {
    commands: [ShellCommand.Now],
    kind: ShellLineKind.Output,
    text: NOW_CURRENTLY,
  },
  {
    commands: [ShellCommand.Contact, ShellCommand.Hire],
    kind: ShellLineKind.Output,
    text: 'mailto: erikhenriquealvescunha@gmail.com',
  },
  {
    commands: [ShellCommand.Face],
    kind: ShellLineKind.Output,
    text: '(•_•) ( •_•)>⌐■-■ (⌐■_■)',
  },
];

export default SHELL_RESPONSES;
