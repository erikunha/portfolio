import { SHELL_LIMITS, ShellLineKind, type shellStates } from '@/content/shell-ui';
import { SECONDS_PER_MINUTE } from '@/lib/time';

export type LineKind = (typeof ShellLineKind)[keyof typeof ShellLineKind];
type LineBase = { id: number; text: string };
type PlainKind =
  | typeof ShellLineKind.Prompt
  | typeof ShellLineKind.Loading
  | typeof ShellLineKind.Reference
  | typeof ShellLineKind.Hint;

export type Line =
  | (LineBase & { kind: PlainKind })
  | (LineBase & { kind: typeof ShellLineKind.Output; ai?: true; lang?: string })
  | (LineBase & {
      kind: typeof ShellLineKind.Error;
      prefix?: string;
      retry?: string;
      lang?: string;
    })
  | (LineBase & {
      kind: typeof ShellLineKind.Info;
      prefix?: string;
      retry?: string;
      welcome?: true;
    })
  | (LineBase & { kind: typeof ShellLineKind.RateLimit; retryAfter?: number });

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

export function appendLines(lines: Line[], ...added: Line[]): Line[] {
  return bounded([...lines, ...added]);
}

export const TranscriptAction = {
  Append: 'append',
  Remove: 'remove',
  Settle: 'settle',
  ForgetConversation: 'forgetConversation',
  Clear: 'clear',
} as const;

export type TranscriptAction =
  | { type: typeof TranscriptAction.Append; lines: Line[] }
  | { type: typeof TranscriptAction.Remove; id: number }
  | {
      type: typeof TranscriptAction.Settle;
      loadingId: number;
      dropReferences: boolean;
      lines: Line[];
    }
  | { type: typeof TranscriptAction.ForgetConversation; lines: Line[] }
  | { type: typeof TranscriptAction.Clear; lines: Line[] };

export function transcriptReducer(state: Line[], action: TranscriptAction): Line[] {
  switch (action.type) {
    case TranscriptAction.Append:
      return appendLines(state, ...action.lines);
    case TranscriptAction.Remove:
      return state.filter((line) => line.id !== action.id);
    case TranscriptAction.Settle:
      return appendLines(
        state.filter(
          (line) =>
            line.id !== action.loadingId &&
            !(action.dropReferences && line.kind === ShellLineKind.Reference),
        ),
        ...action.lines,
      );
    case TranscriptAction.ForgetConversation:
      return appendLines(
        state.filter((line) => line.kind !== ShellLineKind.Reference),
        ...action.lines,
      );
    case TranscriptAction.Clear:
      return action.lines;
  }
}
