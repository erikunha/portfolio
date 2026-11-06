import { linksContent } from '@/content/links';
import type { LinksLocale } from '@/content/links.constants';
import type { LinksPill } from '@/content/schemas';
import { withUtm } from '@/lib/links/utm';
import { CopyLinkButton } from './client/CopyLinkButton.client';
import { PillGlyph } from './LinkIcons';

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
            className="links-pill"
          >
            <span className="links-pill-glyph">
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
