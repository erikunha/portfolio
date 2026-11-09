import { cn } from '@/lib/cn';

interface StatusDotProps {
  blink?: boolean;
  className?: string;
}

export function StatusDot({ blink = false, className }: StatusDotProps) {
  return (
    <span className={cn('status-dot', blink && 'status-dot-blink', className)} aria-hidden="true" />
  );
}
