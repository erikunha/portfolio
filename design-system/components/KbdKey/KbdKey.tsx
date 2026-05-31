import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

export type KbdKeyProps = { size?: 'sm' | 'md'; children: ReactNode };

export function KbdKey({ size = 'md', children }: KbdKeyProps) {
  return (
    <kbd
      className={cn(
        'kbd-key inline-flex items-center border border-border-default text-text-body font-mono rounded-[2px]',
        size === 'sm' && 'text-xs px-1 py-0',
        size === 'md' && 'text-xs px-[6px] py-px',
      )}
    >
      {children}
    </kbd>
  );
}
