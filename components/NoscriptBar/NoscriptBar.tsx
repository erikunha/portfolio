import { errorsContent } from '@/content/errors';
import type { SiteLocale } from '@/content/site-locale';

export function NoscriptBar({ locale }: { locale: SiteLocale }) {
  const { noscript } = errorsContent[locale];
  return (
    <noscript>
      <div className="nojs-bar" data-locale={locale}>
        {noscript.text} <a href={noscript.contact.href}>{noscript.contact.label}</a>
      </div>
    </noscript>
  );
}
