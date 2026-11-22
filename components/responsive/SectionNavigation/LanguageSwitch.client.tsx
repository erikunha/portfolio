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
import type { ButtonSize } from '@/design-system';
import { joinClassNames } from '@/lib/join-class-names';
import { HOME_SECTION_ID } from '@/lib/section-spy';
import { useCurrentSection, useSectionNavigation } from './SectionNavigationProvider.client';

type LanguageSwitchStyle = {
  className?: string | undefined;
  size?: ButtonSize | undefined;
  buttonClassName?: string | undefined;
};

function LanguageSwitchView({
  paths,
  ...style
}: LanguageSwitchStyle & {
  paths: Record<SiteLocale, string>;
}) {
  const { locale, copy } = useSectionNavigation();
  return (
    <LocaleSwitch
      label={copy.langSwitchLabel}
      current={locale}
      hrefs={paths}
      names={LANGUAGE_SWITCH_NAME}
      {...(style.size ? { size: style.size } : {})}
      buttonClassName={style.buttonClassName}
      className={joinClassNames('flex-none', style.className)}
      data-lang-switch=""
    />
  );
}

function CurrentLanguageSwitch(style: LanguageSwitchStyle) {
  const currentId = useCurrentSection();
  const pathname = usePathname();
  if (!pathname) return null;
  const sectionId = currentId && currentId !== HOME_SECTION_ID ? currentId : null;
  return (
    <LanguageSwitchView
      {...style}
      paths={withSectionHash(pathname, headerLanguageSwitchPaths(pathname), sectionId)}
    />
  );
}

export function LanguageSwitch(style: LanguageSwitchStyle) {
  const { route } = useSectionNavigation();
  const fallbackPaths = route === null ? LOCALE_HOME_PATH : headerLanguageSwitchPaths(route);
  return (
    <Suspense fallback={<LanguageSwitchView {...style} paths={fallbackPaths} />}>
      <CurrentLanguageSwitch {...style} />
    </Suspense>
  );
}
