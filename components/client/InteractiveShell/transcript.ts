import { SHELL_LIMITS, type ShellLineKind, type shellStates } from '@/content/shell-ui';
import { SECONDS_PER_MINUTE } from '@/lib/time';

export type LineKind = (typeof ShellLineKind)[keyof typeof ShellLineKind];
export type Line = {
  id: number;
  kind: LineKind;
  text: string;
  ai?: boolean;
  prefix?: string;
  retryAfter?: number;
  retry?: string;
  welcome?: true;
  lang?: string;
};

export function formatRemaining(
  seconds: number,
  states: Pick<(typeof shellStates)['en'], 'minutesUnit' | 'secondsUnit'>,
): string {
  return seconds >= SECONDS_PER_MINUTE
    ? `${Math.ceil(seconds / SECONDS_PER_MINUTE)} ${states.minutesUnit}`
    : `${seconds} ${states.secondsUnit}`;
}

export function bounded(lines: Line[]): Line[] {
  return lines.slice(-SHELL_LIMITS.logEntries);
}
