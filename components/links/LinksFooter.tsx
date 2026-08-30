import { linksContent } from '@/content/links';
import type { LinksLocale } from '@/content/links.constants';
import type { LinksPill } from '@/content/schemas';
import { withUtm } from '@/lib/links/utm';
import { CopyLinkButton } from './client/CopyLinkButton.client';
import { PillGlyph } from './LinkIcons';

const PILL_CLASS =
  'inline-flex items-center gap-[7px] w-full border border-primary-subtle px-[14px] min-h-11 bg-transparent text-primary-500 font-bold text-xs tracking-[0.1em] uppercase no-underline transition-[box-shadow,background] duration-200 ease-out hover:shadow-[0_0_12px_var(--color-primary-500)] hover:bg-primary-quiet focus-visible:outline-2 focus-visible:outline-primary-500 focus-visible:outline-offset-2';

function isLinked(pill: LinksPill): pill is LinksPill & { href: string } {
  return typeof pill.href === 'string' && pill.href.length > 0;
}

export function LinksFooter({ locale, url }: { locale: LinksLocale; url: string }) {
  const { pills, copy, siteUrl, siteLabel } = linksContent;

  return (
    <footer className="links-footer mx-[18px] mt-[22px] pt-[14px] border-t border-primary-border">
      <ul className="list-none m-0 p-0 grid gap-2 min-[900px]:grid-cols-2 min-[1100px]:grid-cols-3">
        {pills.filter(isLinked).map((pill) => (
          <li key={pill.id}>
            <a
              href={pill.href.startsWith('mailto:') ? pill.href : withUtm(pill.href, pill.id)}
              {...(pill.href.startsWith('mailto:')
                ? {}
                : { target: '_blank', rel: 'noopener noreferrer', 'data-outbound': pill.id })}
              className={PILL_CLASS}
            >
              <span className="text-primary-400">
                <PillGlyph icon={pill.icon} />
              </span>
              {pill.label[locale]}
            </a>
          </li>
        ))}
        <li>
          <CopyLinkButton url={url} idleLabel={copy.copyLink[locale]} doneLabel={copy.copyDone} />
        </li>
      </ul>

      <p className="flex justify-between items-center mt-3 mb-0 text-tertiary-400 text-[11px]">
        <span aria-hidden="true">
          $ <span className="boot-cursor" />
        </span>
        <a
          href={withUtm(siteUrl, 'portfolio-footer')}
          data-outbound="portfolio-footer"
          className="text-primary-400 no-underline hover:text-primary-500 focus-visible:outline-2 focus-visible:outline-primary-500 focus-visible:outline-offset-2"
        >
          {siteLabel} →
        </a>
      </p>
    </footer>
  );
}
