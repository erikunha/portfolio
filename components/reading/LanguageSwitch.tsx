import {
  LANGUAGE_SWITCH_NAME,
  languageSwitchPaths,
  SITE_LOCALES,
  type SiteLocale,
} from '@/content/site-locale';

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
  return (
    <nav aria-label={label} className="reading-lang">
      {SITE_LOCALES.map((candidate) => (
        <a
          key={candidate}
          href={paths[candidate]}
          hrefLang={candidate}
          {...(candidate === locale ? { 'aria-current': 'page' as const } : {})}
        >
          {candidate.toUpperCase()}
          <span className="sr-only">&nbsp;{LANGUAGE_SWITCH_NAME[candidate]}</span>
        </a>
      ))}
    </nav>
  );
}
