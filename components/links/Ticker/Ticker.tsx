import { linksContent } from '@/content/links';
import type { SiteLocale } from '@/content/site-locale';

export function Ticker({ locale }: { locale: SiteLocale }) {
  const { upcoming } = linksContent;
  const segment = `${upcoming.label[locale]} · ${upcoming.slot[locale]} · ${upcoming.topic[locale]}  ///  `;

  return (
    <div className="border-b border-(color:--color-border) bg-[var(--color-signal-glow-06)] overflow-hidden relative z-(--z-content-raised)">
      <div className="links-ticker-track text-(color:--color-accent) text-xs tracking-2xl uppercase py-1">
        <span className="inline-block pr-6">{segment}</span>
        <span aria-hidden="true" className="inline-block pr-6 motion-off:hidden">
          {segment}
        </span>
      </div>
    </div>
  );
}
