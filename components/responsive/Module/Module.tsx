import type { ReactNode } from 'react';

export type ModuleProps = {
  id: string;
  header: string;
  mobileHeader?: string;
  icon?: ReactNode;
  defer?: boolean | undefined;
  variant?: 'green';
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
    <details
      id={id}
      className={[
        'module-root',
        'mb-[18px] md:mb-10',
        'border border-primary-subtle bg-[rgba(0,0,0,0.22)] md:bg-transparent overflow-hidden md:overflow-visible',
        'md:border-0',
        defer ? 'module-deferred' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      open
      {...(defer ? { 'data-cv-defer': 'true' } : {})}
    >
      <summary
        className={[
          '[list-style:none] [&::-webkit-details-marker]:hidden',
          'flex items-center gap-2 w-full',
          'px-[14px] py-3 min-h-11 bg-glow-04 border-b border-primary-quiet cursor-pointer',
          'focus-visible:outline-2 focus-visible:outline-primary-500 focus-visible:outline-offset-2',
          'md:px-0 md:py-0 md:min-h-0 md:bg-transparent md:border-b-0 md:mb-2',
        ].join(' ')}
      >
        <span className="module-chevron" aria-hidden>
          ▸
        </span>
        <h2 className="flex-1 flex items-center gap-2 text-primary-500 font-mono text-xs max-md:text-[10px] md:text-[12px] font-medium tracking-[0.14em] md:tracking-[0.1em] uppercase m-0">
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
      </summary>
      <div className="module-body" id={`${id}-body`}>
        <div className="min-h-0 overflow-hidden">
          <div className="module-body-content" data-variant={variant}>
            {children}
          </div>
        </div>
      </div>
    </details>
  );
}
