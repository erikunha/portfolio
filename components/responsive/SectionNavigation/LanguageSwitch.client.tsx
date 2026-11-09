'use client';

import { usePathname } from 'next/navigation';
import { Suspense } from 'react';
import { LocaleSwitch } from '@/components/LocaleSwitch/LocaleSwitch';
import {
  headerLanguageSwitchPaths,
  LANGUAGE_SWITCH_NAME,
  LOCALE_HOME_PATH,
  type SiteLocale,
  withSectionHash,
} from '@/content/site-locale';
import { cn } from '@/lib/cn';
import { HOME_SECTION_ID } from '@/lib/section-spy';
import { useCurrentSection, useSectionNavigation } from './SectionNavigationProvider.client';

function LanguageSwitchView({
  className,
  paths,
}: {
  className: string | undefined;
  paths: Record<SiteLocale, string>;
}) {
  const { locale, copy } = useSectionNavigation();
  return (
    <LocaleSwitch
      label={copy.langSwitchLabel}
      current={locale}
      hrefs={paths}
      names={LANGUAGE_SWITCH_NAME}
      className={cn('flex-none', className)}
      data-lang-switch=""
    />
  );
}

function CurrentLanguageSwitch({ className }: { className: string | undefined }) {
  const currentId = useCurrentSection();
  const pathname = usePathname();
  if (!pathname) return null;
  const sectionId = currentId && currentId !== HOME_SECTION_ID ? currentId : null;
  return (
    <LanguageSwitchView
      className={className}
      paths={withSectionHash(pathname, headerLanguageSwitchPaths(pathname), sectionId)}
    />
  );
}

export function LanguageSwitch({ className }: { className?: string }) {
  const { route } = useSectionNavigation();
  const fallbackPaths = route === null ? LOCALE_HOME_PATH : headerLanguageSwitchPaths(route);
  return (
    <Suspense fallback={<LanguageSwitchView className={className} paths={fallbackPaths} />}>
      <CurrentLanguageSwitch className={className} />
    </Suspense>
  );
}
