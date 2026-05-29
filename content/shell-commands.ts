// content/shell-commands.ts
import type { ShellResponse } from './schemas';

const SHELL_RESPONSES: ShellResponse[] = [
  {
    commands: ['help'],
    kind: 'output',
    text: 'commands: help · whois · whois --recursive · ls · cat skills.md · cat ~/.now · contact · face · hire · clear\nanything else → sent to Claude',
  },
  {
    commands: ['whois'],
    kind: 'output',
    text: 'erik — full-stack engineer (frontend-heavy)',
  },
  {
    commands: ['whois --recursive'],
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
    text: 'angular, react, next.js, typescript, node, rxjs, ngrx, web components, spec-driven ai tooling',
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
];

export default SHELL_RESPONSES;
