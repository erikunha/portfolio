import type { ReactNode } from 'react';

export type CmdLineProps = { user?: string; command: string; output?: ReactNode; prompt?: string };

export function CmdLine({
  user = 'erik@portfolio',
  command,
  output,
  prompt = ':~$',
}: CmdLineProps) {
  return (
    <div className="cmd-line font-mono text-sm leading-[1.55]">
      <div className="flex flex-wrap gap-x-1">
        <span className="text-text-muted">{user}</span>
        <span className="text-text-muted">{prompt}</span>
        <span className="text-text-body">{command}</span>
      </div>
      {output != null && <div className="text-text-body mt-1">{output}</div>}
    </div>
  );
}
