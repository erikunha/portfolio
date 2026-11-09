import type { ReactNode } from 'react';
import { longestCopy } from '@/lib/longest-copy';

interface MeasuredStatusProps {
  message: ReactNode;
  live: boolean;
  reserve: readonly string[];
}

export function MeasuredStatus({ message, live, reserve }: MeasuredStatusProps) {
  return (
    <div className="measured-status-slot" data-reserve={longestCopy(reserve)}>
      {message ? (
        <p className="measured-status" role={live ? 'status' : undefined}>
          {message}
        </p>
      ) : null}
    </div>
  );
}
