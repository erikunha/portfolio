import { EXTERNAL_LINK_PROPS } from '@/components/ExternalLink';
import { linksContent } from '@/content/links';
import type { LinksLocale } from '@/content/links.constants';
import { Button } from '@/design-system';
import { CHANNEL_URL } from '@/lib/links/feed';
import { withUtm } from '@/lib/links/utm';
import { IconYouTube } from './LinkIcons';
import { NewTabHint } from './NewTabHint';
import { SectionHeading } from './SectionHeading';

const HEADING_ID = 'links-channel-noscript-heading';
const SUBSCRIBE_QUERY = '?sub_confirmation=1';
const OUTBOUND_ID = 'inscrever';
const GLYPH_PX = 17;

export function ChannelNoscript({ locale }: { locale: LinksLocale }) {
  const { copy } = linksContent;
  return (
    <noscript>
      <section className="links-col" data-col="channel-noscript" aria-labelledby={HEADING_ID}>
        <SectionHeading id={HEADING_ID} reveal={false}>
          {copy.watchHeading[locale]}
        </SectionHeading>
        <article className="links-channel-card links-watch border border-primary-subtle p-4">
          <p className="links-watch-note">{copy.feedUnavailable[locale]}</p>
          <div className="links-watch-actions">
            <Button
              as="a"
              href={withUtm(`${CHANNEL_URL}${SUBSCRIBE_QUERY}`, OUTBOUND_ID)}
              {...EXTERNAL_LINK_PROPS}
              size="lg"
              variant="primary"
              className="gap-[9px]"
              data-outbound={OUTBOUND_ID}
            >
              <IconYouTube size={GLYPH_PX} />
              <span>{copy.subscribe[locale]}</span>
              <NewTabHint text={copy.opensInNewTab[locale]} />
            </Button>
          </div>
        </article>
      </section>
    </noscript>
  );
}
