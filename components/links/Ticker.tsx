import { linksContent } from '@/content/links';
import type { LinksLocale } from '@/content/links.constants';

export function Ticker({ locale }: { locale: LinksLocale }) {
  const { upcoming } = linksContent;
  const segment = `${upcoming.label[locale]} · ${upcoming.slot[locale]} · ${upcoming.topic[locale]}  ///  `;

  return (
    <div className="border-b border-primary-border bg-[var(--color-glow-06)] overflow-hidden relative z-[11]">
      <div className="links-ticker-track text-primary-500 text-[10.5px] tracking-[0.12em] uppercase py-[5px]">
        <span className="inline-block pr-[26px]">{segment}</span>
        <span aria-hidden="true" className="inline-block pr-[26px]">
          {segment}
        </span>
      </div>
    </div>
  );
}
