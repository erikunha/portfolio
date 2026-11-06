import { linksContent } from '@/content/links';
import { withUtm } from '@/lib/links/utm';

export function LinksFooter() {
  const { siteUrl, siteLabel } = linksContent;

  return (
    <footer className="links-footer pt-4 border-t border-primary-border">
      <p className="flex justify-between items-center m-0 text-tertiary-400 text-xs">
        <span aria-hidden="true">
          $ <span className="boot-cursor" />
        </span>
        <a
          href={withUtm(siteUrl, 'portfolio-footer')}
          data-outbound="portfolio-footer"
          className="inline-flex items-center min-h-11 text-primary-400 no-underline hover:text-primary-500 focus-visible:outline-2 focus-visible:outline-primary-500 focus-visible:outline-offset-2"
        >
          {siteLabel} →
        </a>
      </p>
    </footer>
  );
}
