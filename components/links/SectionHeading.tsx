import type { ReactNode } from 'react';

export type SectionHeadingProps = {
  id: string;
  children: ReactNode;
  trailing?: ReactNode;
};

export function SectionHeading({ id, children, trailing }: SectionHeadingProps) {
  return (
    <h2
      id={id}
      className="flex items-center gap-2 text-primary-500 text-xs md:text-micro-105 font-normal tracking-[0.14em] uppercase m-0 mb-[10px]"
    >
      <span data-type-reveal>{children}</span>
      <span aria-hidden="true" className="flex-1 h-px bg-primary-border" />
      {trailing != null && (
        <span className="text-tertiary-400 text-xs md:text-micro-100 tracking-[0.04em] normal-case">
          {trailing}
        </span>
      )}
    </h2>
  );
}
