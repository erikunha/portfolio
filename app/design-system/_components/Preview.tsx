import type { ReactNode } from 'react';
import { TerminalPanel } from '@/design-system';

type PreviewProps = {
  id?: string;
  source?: string;
  children: ReactNode;
};

export function Preview({ id, source, children }: PreviewProps) {
  return (
    <div id={id} data-testid="ds-preview">
      <TerminalPanel className="my-4">
        <div className="p-6 flex flex-wrap gap-3 items-start">{children}</div>
        {source != null && (
          <details className="border-t border-border-default">
            <summary className="px-6 py-1.5 font-mono text-xs tracking-widest text-text-muted cursor-pointer list-none uppercase hover:text-signal">
              VIEW SOURCE
            </summary>
            <pre className="m-0 px-6 py-4 overflow-x-auto font-mono text-xs text-text-body border-t border-dashed border-border-default">
              <code>{source}</code>
            </pre>
          </details>
        )}
      </TerminalPanel>
    </div>
  );
}
