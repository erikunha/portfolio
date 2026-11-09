import { EXTERNAL_LINK_PROPS, ExternalLink } from '@/components/ExternalLink';
import { OptimizedImage } from '@/components/OptimizedImage';
import { linksContent } from '@/content/links';
import type { LinksLocale } from '@/content/links.constants';
import { linksUi } from '@/content/links-ui';
import { Badge, Button } from '@/design-system';
import type { ChannelFeed } from '@/lib/links/feed';
import { formatCompact } from '@/lib/links/format';
import { formatRelative } from '@/lib/links/relative-time';
import { withUtm } from '@/lib/links/utm';
import { SubscribeCta } from './client/SubscribeCta.client';
import { IconYouTube } from './LinkIcons';
import { NewTabHint } from './NewTabHint';
import { SectionHeading } from './SectionHeading';

const HEADING_ID = 'links-channel-heading';
const CHANNEL_GLYPH_PX = 16;
const THUMB_SIZES = '(min-width: 1024px) 62vw, (min-width: 768px) 50vw, 100vw';

export function ChannelCard({ locale, feed }: { locale: LinksLocale; feed: ChannelFeed }) {
  const { channel, copy } = linksContent;
  const { latest, stats, channelUrl, fetchedAt } = feed;

  const counts = [
    stats.subscriberCount === undefined ? null : formatCompact(stats.subscriberCount, locale),
    stats.videoCount === undefined
      ? null
      : `${formatCompact(stats.videoCount, locale)} ${copy.videosWord[locale]}`,
  ].filter((part): part is string => part !== null);

  const publishedAgo =
    latest && fetchedAt !== null
      ? formatRelative(new Date(latest.publishedAt), locale, new Date(fetchedAt))
      : null;
  const subscribeHref = `${channelUrl}?sub_confirmation=1`;

  const description = latest?.description ?? '';

  return (
    <section className="links-col" data-col="channel" aria-labelledby={HEADING_ID}>
      <SectionHeading id={HEADING_ID}>{copy.watchHeading[locale]}</SectionHeading>

      <article className="links-channel-card links-watch border border-primary-subtle p-4">
        <div className="links-watch-media">
          {latest === null ? (
            <div
              aria-hidden="true"
              className="links-thumb-placeholder w-full border border-primary-border grid place-items-center text-primary-400 text-xs tracking-lg uppercase"
            >
              {copy.thumbPlaceholder[locale]}
            </div>
          ) : (
            <ExternalLink
              href={withUtm(latest.url, 'ultimo-video')}
              data-outbound="ultimo-video"
              tabIndex={-1}
              aria-hidden="true"
              className="block no-underline hover:opacity-92"
            >
              <span className="links-thumb w-full">
                <OptimizedImage
                  src={latest.thumbnailUrl}
                  alt=""
                  fill
                  priority
                  fetchPriority="high"
                  sizes={THUMB_SIZES}
                  className="object-cover"
                />
              </span>
            </ExternalLink>
          )}
        </div>

        <div className="links-watch-body">
          <p className="links-watch-channel">
            <span className="links-watch-glyph">
              <IconYouTube size={CHANNEL_GLYPH_PX} />
            </span>
            <span>{channel.name}</span>
            <span className="links-watch-handle">{channel.handle}</span>
            <span className="links-watch-counts" hidden={counts.length === 0}>
              {counts.join(' · ')}
            </span>
          </p>

          {latest === null ? (
            <p className="links-watch-note">{copy.feedUnavailable[locale]}</p>
          ) : (
            <>
              <p className="links-watch-meta">
                <Badge variant="dot" size="sm">
                  {copy.newBadge[locale]}
                </Badge>
                <span className="links-watch-age" hidden={publishedAgo === null}>
                  {publishedAgo}
                  {latest.duration ? ` · ${latest.duration}` : ''}
                </span>
              </p>
              <p className="links-watch-title">
                <ExternalLink
                  href={withUtm(latest.url, 'ultimo-video-titulo')}
                  data-outbound="ultimo-video-titulo"
                >
                  {latest.title}
                  <NewTabHint text={copy.opensInNewTab[locale]} />
                </ExternalLink>
              </p>
              <p className="links-watch-desc line-clamp-4" hidden={description === ''}>
                {description}
              </p>
            </>
          )}
        </div>

        <div data-testid="links-channel-actions" className="links-watch-actions">
          <SubscribeCta
            href={withUtm(subscribeHref, 'inscrever')}
            subscribedHref={withUtm(`${channelUrl}/videos`, 'inscrito-ver-videos')}
            subscribeLabel={copy.subscribe[locale]}
            subscribedLabel={copy.subscribedCta[locale]}
            outboundId="inscrever"
            newTabHint={copy.opensInNewTab[locale]}
          />
          {latest !== null && (
            <Button
              as="a"
              href={withUtm(latest.url, 'assistir')}
              {...EXTERNAL_LINK_PROPS}
              size="lg"
              variant="secondary"
              data-outbound="assistir"
            >
              {copy.watch[locale]} <span aria-hidden="true">{linksUi.arrow}</span>
              <NewTabHint text={copy.opensInNewTab[locale]} />
            </Button>
          )}
        </div>
      </article>
    </section>
  );
}
