import type { ReactNode } from 'react';
import { type ModuleVariant, moduleHeaderId } from './module.constants';

export type ModuleProps = {
  id: string;
  header: string;
  mobileHeader?: string;
  icon?: ReactNode;
  defer?: boolean | undefined;
  variant?: ModuleVariant;
  children: ReactNode;
};

export function Module({
  id,
  header,
  mobileHeader,
  icon,
  defer = false,
  variant,
  children,
}: ModuleProps) {
  return (
    <section
      id={id}
      tabIndex={-1}
      aria-labelledby={moduleHeaderId(id)}
      className={[
        'mb-[18px] md:mb-10',
        'border border-primary-subtle bg-[rgba(0,0,0,0.22)] md:bg-transparent overflow-hidden md:overflow-visible',
        'md:border-0',
        defer ? 'module-deferred' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      {...(defer ? { 'data-cv-defer': 'true' } : {})}
    >
      <header
        className={[
          'flex items-center gap-2 w-full',
          'px-[14px] py-3 min-h-11 bg-glow-04 border-b border-primary-quiet',
          'md:px-0 md:py-0 md:min-h-0 md:bg-transparent md:border-b-0 md:mb-2',
        ].join(' ')}
      >
        <h2
          id={moduleHeaderId(id)}
          className="flex-1 flex items-center gap-2 text-primary-500 font-mono text-xs max-md:text-[10px] md:text-[12px] font-medium tracking-[0.14em] md:tracking-[0.1em] uppercase m-0"
        >
          {icon ? (
            <span
              className="inline-flex w-5 h-5 items-center justify-center text-primary-500 [&_svg]:w-[18px] [&_svg]:h-[18px] [&_svg]:stroke-current [&_svg]:fill-none [&_svg]:[stroke-width:1.4]"
              aria-hidden
            >
              {icon}
            </span>
          ) : null}
          <span className="hidden md:inline">{header}</span>
          <span className="md:hidden">{mobileHeader ?? header}</span>
        </h2>
      </header>
      <div className="module-body-content" data-variant={variant}>
        {children}
      </div>
    </section>
  );
}
