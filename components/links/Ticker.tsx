import { linksContent } from '@/content/links';
import type { LinksLocale } from '@/content/links.constants';

export function Ticker({ locale }: { locale: LinksLocale }) {
  const { upcoming } = linksContent;
  const segment = `${upcoming.label[locale]} · ${upcoming.slot[locale]} · ${upcoming.topic[locale]}  ///  `;

  return (
    <div className="border-b border-primary-border bg-[var(--color-glow-06)] overflow-hidden relative z-(--z-content-raised)">
      <div className="links-ticker-track text-primary-500 text-xs tracking-2xl uppercase py-1">
        <span className="inline-block pr-6">{segment}</span>
        <span aria-hidden="true" className="inline-block pr-6 [body[data-motion=reduce]_&]:hidden">
          {segment}
        </span>
      </div>
    </div>
  );
}
