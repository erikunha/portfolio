import type { ComponentPropsWithoutRef, ReactNode } from 'react';
import { cn } from '@/lib/cn';

export type CmdLineProps = Omit<ComponentPropsWithoutRef<'div'>, 'children'> & {
  user: string;
  command: string;
  output?: ReactNode;
  prompt?: string;
};

export function CmdLine({
  user,
  command,
  output,
  prompt = ':~$',
  className,
  ...rest
}: CmdLineProps) {
  return (
    <div className={cn('cmd-line font-mono text-sm leading-ratio-1-55', className)} {...rest}>
      <div className="flex flex-wrap gap-x-1">
        <span className="text-primary-400">{user}</span>
        <span className="text-primary-400">{prompt}</span>
        <span className="text-tertiary-50">{command}</span>
      </div>
      {output != null && <div className="text-tertiary-50 mt-1">{output}</div>}
    </div>
  );
}
