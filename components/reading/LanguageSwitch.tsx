import { LocaleSwitch } from '@/components/LocaleSwitch/LocaleSwitch';
import { LANGUAGE_SWITCH_NAME, languageSwitchPaths, type SiteLocale } from '@/content/site-locale';

export function ReadingLanguageSwitch({
  locale,
  label,
  path,
}: {
  locale: SiteLocale;
  label: string;
  path: string;
}) {
  const paths = languageSwitchPaths(path);
  if (!paths) return null;
  return <LocaleSwitch label={label} current={locale} hrefs={paths} names={LANGUAGE_SWITCH_NAME} />;
}
