import { linksContent } from '@/content/links';
import { linksUi } from '@/content/links-ui';
import { withUtm } from '@/lib/links/utm';

export function LinksFooter() {
  const { siteUrl, siteLabel } = linksContent;

  return (
    <footer className="links-footer">
      <p className="links-footer-line">
        <span aria-hidden="true">
          $ <span className="boot-cursor" />
        </span>
        <a
          href={withUtm(siteUrl, 'portfolio-footer')}
          data-outbound="portfolio-footer"
          className="links-footer-link"
        >
          {siteLabel} <span aria-hidden="true">{linksUi.arrow}</span>
        </a>
      </p>
    </footer>
  );
}
