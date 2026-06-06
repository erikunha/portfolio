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
        <span className="text-primary-400">{user}</span>
        <span className="text-primary-400">{prompt}</span>
        <span className="text-tertiary-50">{command}</span>
      </div>
      {output != null && <div className="text-tertiary-50 mt-1">{output}</div>}
    </div>
  );
}
