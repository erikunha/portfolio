import type { ComponentPropsWithoutRef } from 'react';
import type { SiteLocale } from '@/content/site-locale';
import { Button } from '@/design-system';
import { cn } from '@/lib/cn';

type LocaleSwitchProps = Omit<ComponentPropsWithoutRef<'nav'>, 'children' | 'aria-label'> & {
  label: string;
  current: SiteLocale;
  hrefs: Record<SiteLocale, string>;
  names: Record<SiteLocale, string>;
};

const LINK_CLASSES =
  'min-w-11 min-h-11 aria-[current=page]:border-primary-500 aria-[current=page]:underline aria-[current=page]:underline-offset-4 aria-[current=page]:decoration-2';

export function LocaleSwitch({
  label,
  current,
  hrefs,
  names,
  className,
  ...navProps
}: LocaleSwitchProps) {
  return (
    <nav {...navProps} aria-label={label} className={cn('flex gap-2', className)}>
      {(Object.keys(hrefs) as SiteLocale[]).map((candidate) => {
        const active = candidate === current;
        return (
          <Button
            key={candidate}
            as="a"
            href={hrefs[candidate]}
            hrefLang={candidate}
            size="sm"
            variant="secondary"
            className={LINK_CLASSES}
            {...(active ? { 'aria-current': 'page' as const } : {})}
          >
            {candidate.toUpperCase()}
            <span lang={candidate} className="sr-only">
              &nbsp;{names[candidate]}
            </span>
          </Button>
        );
      })}
    </nav>
  );
}
