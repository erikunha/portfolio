import type { ReactNode } from 'react';

export type SectionHeadingProps = {
  id: string;
  children: ReactNode;
  trailing?: ReactNode;
  reveal?: boolean;
};

export function SectionHeading({ id, children, trailing, reveal = true }: SectionHeadingProps) {
  return (
    <h2
      id={id}
      className="flex items-center gap-2 text-primary-500 text-xs font-normal tracking-3xl uppercase m-0 mb-2"
    >
      <span data-type-reveal={reveal || undefined} suppressHydrationWarning>
        {children}
      </span>
      <span aria-hidden="true" className="flex-1 h-px bg-primary-border" />
      {trailing != null && (
        <span className="text-tertiary-400 text-xs tracking-xs normal-case">{trailing}</span>
      )}
    </h2>
  );
}
