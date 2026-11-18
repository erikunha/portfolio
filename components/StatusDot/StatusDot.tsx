import { joinClassNames } from '@/lib/join-class-names';

interface StatusDotProps {
  blink?: boolean;
  className?: string;
}

export function StatusDot({ blink = false, className }: StatusDotProps) {
  return (
    <span
      className={joinClassNames('status-dot', blink && 'status-dot-blink', className)}
      aria-hidden="true"
    />
  );
}
