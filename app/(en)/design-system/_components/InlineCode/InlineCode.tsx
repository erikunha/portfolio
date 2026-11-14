import type { ComponentPropsWithoutRef } from 'react';
import { BREAK_AFTER, BreakAfter } from '@/components/BreakAfter';

const FENCED_BLOCK_CLASS = /(^|\s)language-/;
const CODE_PIECE_CLASS = 'ds-code-piece';

export function InlineCode({ children, className, ...props }: ComponentPropsWithoutRef<'code'>) {
  const fenced = className !== undefined && FENCED_BLOCK_CLASS.test(className);
  return (
    <code className={className} {...props}>
      {typeof children === 'string' && !fenced ? (
        <BreakAfter chars={BREAK_AFTER.code} pieceClassName={CODE_PIECE_CLASS}>
          {children}
        </BreakAfter>
      ) : (
        children
      )}
    </code>
  );
}
