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
            variant={active ? 'primary' : 'secondary'}
            className="min-w-11 min-h-11"
            {...(active ? { 'aria-current': 'page' as const } : {})}
          >
            {candidate.toUpperCase()}
            <span className="sr-only">&nbsp;{names[candidate]}</span>
          </Button>
        );
      })}
    </nav>
  );
}
