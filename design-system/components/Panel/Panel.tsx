import type { ComponentPropsWithoutRef, ReactNode } from 'react';
import { cn } from '@/lib/cn';

type PanelTag = 'div' | 'section' | 'aside';

export type PanelProps = Omit<ComponentPropsWithoutRef<'div'>, 'title'> & {
  as?: PanelTag;
  title: string;
  marker: string;
  titleId?: string;
  reveal?: boolean;
  action?: ReactNode;
};

export function Panel({
  as: Tag = 'div',
  title,
  marker,
  titleId,
  reveal = false,
  action,
  className,
  children,
  ...rest
}: PanelProps) {
  return (
    <Tag className={cn('panel', className)} aria-labelledby={titleId} {...rest}>
      <header className="panel-head">
        <span className="panel-marker" aria-hidden="true">
          {marker}
        </span>
        <h3
          className="panel-title"
          id={titleId}
          data-type-reveal={reveal || undefined}
          suppressHydrationWarning={reveal || undefined}
        >
          {title}
        </h3>
        {action}
      </header>
      {children}
    </Tag>
  );
}
