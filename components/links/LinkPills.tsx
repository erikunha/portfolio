import { linksContent } from '@/content/links';
import type { LinksLocale } from '@/content/links.constants';
import type { LinksPill } from '@/content/schemas';
import { withUtm } from '@/lib/links/utm';
import { CopyLinkButton } from './client/CopyLinkButton.client';
import { PillGlyph } from './LinkIcons';

const PILL_CLASS =
  'inline-flex items-center gap-2 w-full min-w-0 border border-primary-subtle px-3 min-h-12 bg-transparent text-primary-500 font-bold text-xs tracking-[0.1em] uppercase no-underline transition-[box-shadow,background] duration-200 ease-out hover:shadow-[0_0_12px_var(--color-primary-500)] hover:bg-primary-quiet focus-visible:outline-2 focus-visible:outline-primary-500 focus-visible:outline-offset-2';

function isMail(href: string): boolean {
  return href.startsWith('mailto:');
}

function isLinked(pill: LinksPill): pill is LinksPill & { href: string } {
  return typeof pill.href === 'string' && pill.href.length > 0;
}

export function LinkPills({ locale, url }: { locale: LinksLocale; url: string }) {
  const { pills, copy } = linksContent;

  return (
    <ul data-testid="links-pills" className="links-pills list-none m-0 p-0">
      {pills.filter(isLinked).map((pill) => (
        <li key={pill.id}>
          <a
            href={isMail(pill.href) ? pill.href : withUtm(pill.href, pill.id)}
            {...(isMail(pill.href)
              ? {}
              : { target: '_blank', rel: 'noopener noreferrer', 'data-outbound': pill.id })}
            className={PILL_CLASS}
          >
            <span className="text-primary-400">
              <PillGlyph icon={pill.icon} />
            </span>
            {pill.label[locale]}
            {!isMail(pill.href) && <span className="sr-only"> ({copy.opensInNewTab[locale]})</span>}
          </a>
        </li>
      ))}
      <li>
        <CopyLinkButton
          url={url}
          idleLabel={copy.copyLink[locale]}
          doneLabel={copy.copyDone}
          failedLabel={copy.copyFailed}
        />
      </li>
    </ul>
  );
}
