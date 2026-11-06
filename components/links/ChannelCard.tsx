import Image from 'next/image';
import { linksContent } from '@/content/links';
import type { LinksLocale } from '@/content/links.constants';
import { linksUi } from '@/content/links-ui';
import { Badge, Button } from '@/design-system';
import { cn } from '@/lib/cn';
import type { ChannelFeed } from '@/lib/links/feed';
import { formatCompact } from '@/lib/links/format';
import { formatRelative } from '@/lib/links/relative-time';
import { withUtm } from '@/lib/links/utm';
import { SubscribeCta } from './client/SubscribeCta.client';
import { IconYouTube } from './LinkIcons';
import { SectionHeading } from './SectionHeading';

const HEADING_ID = 'links-channel-heading';
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

  return (
    <section className="links-col" data-col="channel" aria-labelledby={HEADING_ID}>
      <SectionHeading id={HEADING_ID}>{copy.channelHeading[locale]}</SectionHeading>

      <div className="links-channel-card border border-primary-subtle p-4">
        <div className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-2 text-primary-500">
            <IconYouTube />
            <span className="text-primary-500 text-base font-bold">{channel.name}</span>
          </span>
          {counts.length > 0 && (
            <span className="text-tertiary-400 text-xs tracking-[0.04em]">
              {counts.join(' · ')}
            </span>
          )}
        </div>

        {latest === null ? (
          <div className="mt-3">
            <div
              aria-hidden="true"
              className="links-thumb-placeholder w-full border border-primary-border grid place-items-center text-primary-400 text-xs tracking-[0.08em] uppercase"
            >
              {copy.thumbPlaceholder[locale]}
            </div>
            <p className="mt-3 mb-0 text-tertiary-400 text-xs leading-body text-pretty">
              {copy.feedUnavailable[locale]}
            </p>
          </div>
        ) : (
          <a
            href={withUtm(latest.url, 'ultimo-video')}
            target="_blank"
            rel="noopener noreferrer"
            data-outbound="ultimo-video"
            className="block no-underline mt-3 focus-visible:outline-2 focus-visible:outline-primary-500 focus-visible:outline-offset-2 hover:opacity-92"
          >
            <span className="links-thumb w-full">
              <Image
                src={latest.thumbnailUrl}
                alt=""
                fill
                priority
                sizes={THUMB_SIZES}
                className="object-cover"
              />
            </span>
            <span className="flex items-center gap-2 mt-3">
              <Badge variant="dot" size="sm">
                {copy.newBadge[locale]}
              </Badge>
              {publishedAgo !== null && (
                <span className="text-tertiary-400 text-xs">
                  {publishedAgo}
                  {latest.duration ? ` · ${latest.duration}` : ''}
                </span>
              )}
            </span>
            <span className="block text-tertiary-50 font-bold text-base mt-2 text-pretty">
              {latest.title}
            </span>
            {latest.description && (
              <span className="mt-1 text-tertiary-400 text-xs text-pretty line-clamp-4">
                {latest.description}
              </span>
            )}
          </a>
        )}

        <div
          data-testid="links-channel-actions"
          className={cn('grid gap-2 mt-[13px]', latest !== null && 'md:grid-cols-[1fr_auto]')}
        >
          <SubscribeCta
            href={withUtm(subscribeHref, 'inscrever')}
            subscribedHref={withUtm(`${channelUrl}/videos`, 'inscrito-ver-videos')}
            subscribeLabel={copy.subscribe[locale]}
            subscribedLabel={copy.subscribedCta[locale]}
            outboundId="inscrever"
          />
          {latest !== null && (
            <Button
              as="a"
              href={withUtm(latest.url, 'assistir')}
              target="_blank"
              rel="noopener noreferrer"
              size="lg"
              variant="secondary"
              data-outbound="assistir"
            >
              {copy.watch[locale]} <span aria-hidden="true">{linksUi.arrow}</span>
            </Button>
          )}
        </div>
      </div>
    </section>
  );
}
