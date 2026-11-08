'use client';

import { useMemo, useRef } from 'react';
import { SHELL_LIMITS } from '@/content/shell-ui';

export const HISTORY_STEP = { Older: -1, Newer: 1 } as const;

type HistoryStep = (typeof HISTORY_STEP)[keyof typeof HISTORY_STEP];

export function useCommandHistory() {
  const commands = useRef<string[]>([]);
  const position = useRef(0);
  const draft = useRef('');
  return useMemo(
    () => ({
      record(command: string) {
        commands.current = [...commands.current, command].slice(-SHELL_LIMITS.commandHistory);
        position.current = commands.current.length;
      },
      noteEdit() {
        position.current = commands.current.length;
      },
      recall(step: HistoryStep, current: string): string {
        if (position.current === commands.current.length) draft.current = current;
        position.current = Math.max(0, Math.min(commands.current.length, position.current + step));
        return commands.current[position.current] ?? draft.current;
      },
    }),
    [],
  );
}
