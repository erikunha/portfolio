import { linksContent } from '@/content/links';
import { LINKS_LOCALE, LINKS_PATH, type LinksLocale } from '@/content/links.constants';
import { Button } from '@/design-system';
import { WindowChrome } from '@/design-system/components/WindowChrome';

const SWITCH_LABEL: Record<LinksLocale, string> = {
  [LINKS_LOCALE.pt]: 'Português',
  [LINKS_LOCALE.en]: 'English',
};

export function ChromeBar({ locale }: { locale: LinksLocale }) {
  const { copy, shellTitle } = linksContent;

  return (
    <div className="links-chrome flex gap-[6px] items-center px-[18px] pt-[18px]">
      <WindowChrome size={9} />
      <span className="ml-2 flex-1 text-primary-400 text-[10px] tracking-[0.14em] uppercase">
        {shellTitle}
      </span>
      <nav aria-label={copy.langSwitchLabel[locale]} className="flex gap-[6px]">
        {Object.values(LINKS_LOCALE).map((candidate) => {
          const active = candidate === locale;
          return (
            <Button
              key={candidate}
              as="a"
              href={LINKS_PATH[candidate]}
              hrefLang={candidate}
              size="sm"
              variant={active ? 'primary' : 'secondary'}
              className="min-w-11 min-h-11"
              {...(active ? { 'aria-current': 'page' as const } : {})}
            >
              {candidate.toUpperCase()}
              <span className="sr-only">&nbsp;{SWITCH_LABEL[candidate]}</span>
            </Button>
          );
        })}
      </nav>
    </div>
  );
}
