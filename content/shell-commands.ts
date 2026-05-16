// content/shell-commands.ts
import { type ShellResponse, ShellCommandsSchema } from './schemas';

const SHELL_RESPONSES: ShellResponse[] = ShellCommandsSchema.parse([
  {
    commands: ['help'],
    kind: 'output',
    text: 'commands: help · whoami · whoami --recursive · ls · cat skills.md · cat ~/.now · contact · face · hire · clear\nanything else → sent to Claude',
  },
  {
    commands: ['whoami'],
    kind: 'output',
    text: 'erik — senior frontend engineer',
  },
  {
    commands: ['whoami --recursive'],
    kind: 'output',
    text: 'erik → engineer → builder → student → curious → 9yo with a guitar',
  },
  {
    commands: ['ls'],
    kind: 'output',
    text: 'README.md  ~/.now  ~/.guitar_rig  ~/.visa  ~/.unknowns  ~/.community  ~/.credentials  hottest_takes.md  contact',
  },
  {
    commands: ['cat skills.md'],
    kind: 'output',
    text: 'angular, react, next.js, typescript, node, rxjs, ngrx, web components, ai tooling',
  },
  {
    commands: ['cat ~/.now'],
    kind: 'output',
    text: 'shipping multi-currency settlement · Betsson cashier (PCI-DSS)',
  },
  {
    commands: ['contact', 'hire'],
    kind: 'output',
    text: 'mailto: erikhenriquealvescunha@gmail.com',
  },
  {
    commands: ['face'],
    kind: 'output',
    text: '(•_•) ( •_•)>⌐■-■ (⌐■_■)',
  },
]);

export default SHELL_RESPONSES;
