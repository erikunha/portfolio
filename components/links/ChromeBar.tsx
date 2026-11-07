import { LocaleSwitch } from '@/components/LocaleSwitch/LocaleSwitch';
import { linksContent } from '@/content/links';
import { LINKS_PATH, type LinksLocale } from '@/content/links.constants';
import { LANGUAGE_SWITCH_NAME } from '@/content/site-locale';

export function ChromeBar({ locale }: { locale: LinksLocale }) {
  const { copy, shellTitle } = linksContent;

  return (
    <div className="links-chrome">
      <span className="links-chrome-title">{shellTitle}</span>
      <LocaleSwitch
        label={copy.langSwitchLabel[locale]}
        current={locale}
        hrefs={LINKS_PATH}
        names={LANGUAGE_SWITCH_NAME}
      />
    </div>
  );
}
