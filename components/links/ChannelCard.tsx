import Image from 'next/image';
import { linksContent } from '@/content/links';
import { LINKS_INTL_LOCALE, type LinksLocale } from '@/content/links.constants';
import { Badge, Button } from '@/design-system';
import { cn } from '@/lib/cn';
import type { ChannelFeed } from '@/lib/links/feed';
import { formatRelative } from '@/lib/links/relative-time';
import { withUtm } from '@/lib/links/utm';
import { SubscribeCta } from './client/SubscribeCta.client';
import { IconYouTube } from './LinkIcons';
import { SectionHeading } from './SectionHeading';

const HEADING_ID = 'links-channel-heading';
const THUMB_SIZES = '(min-width: 1100px) 480px, (min-width: 900px) 560px, 100vw';

function compact(value: number, locale: LinksLocale): string {
  return new Intl.NumberFormat(LINKS_INTL_LOCALE[locale], {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value);
}

export function ChannelCard({ locale, feed }: { locale: LinksLocale; feed: ChannelFeed }) {
  const { channel, copy } = linksContent;
  const { latest, stats, channelUrl } = feed;

  const counts = [
    stats.subscriberCount === undefined ? null : compact(stats.subscriberCount, locale),
    stats.videoCount === undefined
      ? null
      : `${compact(stats.videoCount, locale)} ${copy.videosWord[locale]}`,
  ].filter((part): part is string => part !== null);

  const publishedAgo = latest ? formatRelative(new Date(latest.publishedAt), locale) : null;
  const subscribeHref = `${channelUrl}?sub_confirmation=1`;

  return (
    <section
      className="links-col px-[18px] pt-[18px]"
      data-col="channel"
      aria-labelledby={HEADING_ID}
    >
      <SectionHeading id={HEADING_ID}>{copy.channelHeading[locale]}</SectionHeading>

      <div className="links-channel-card border border-primary-subtle p-[14px]">
        <div className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-[9px] text-primary-500">
            <IconYouTube />
            <span className="text-primary-500 text-base font-bold">{channel.name}</span>
          </span>
          {counts.length > 0 && (
            <span className="text-tertiary-400 text-[10px] tracking-[0.04em]">
              {counts.join(' · ')}
            </span>
          )}
        </div>

        {latest === null ? (
          <p className="mt-3 mb-0 text-tertiary-400 text-[11.5px] leading-[1.6]">
            {copy.feedUnavailable[locale]}
          </p>
        ) : (
          <a
            href={withUtm(latest.url, 'ultimo-video')}
            target="_blank"
            rel="noopener noreferrer"
            data-outbound="ultimo-video"
            className="block no-underline mt-3 focus-visible:outline-2 focus-visible:outline-primary-500 focus-visible:outline-offset-2 hover:opacity-92"
          >
            <span className="relative block h-[104px] lg:h-[280px] border border-primary-border overflow-hidden">
              <Image
                src={latest.thumbnailUrl}
                alt=""
                fill
                priority
                sizes={THUMB_SIZES}
                className="object-cover"
              />
            </span>
            <span className="flex items-center gap-[7px] mt-[10px]">
              <Badge variant="dot" size="sm">
                {copy.newBadge[locale]}
              </Badge>
              {publishedAgo !== null && (
                <span className="text-tertiary-400 text-[10.5px]">
                  {publishedAgo}
                  {latest.duration ? ` · ${latest.duration}` : ''}
                </span>
              )}
            </span>
            <span className="block text-tertiary-50 font-bold text-[15px] mt-[7px] text-pretty">
              {latest.title}
            </span>
            {latest.description && (
              <span className="block mt-[5px] text-tertiary-400 text-[11px] text-pretty">
                {latest.description}
              </span>
            )}
          </a>
        )}

        <div className={cn('grid gap-2 mt-[13px]', latest !== null && 'grid-cols-[1fr_auto]')}>
          <SubscribeCta
            href={withUtm(subscribeHref, 'inscrever')}
            subscribedHref={withUtm(`${channelUrl}/videos`, 'inscrito-ver-videos')}
            subscribeLabel={copy.subscribe[locale]}
            subscribedLabel={copy.subscribedCta[locale]}
            utmContent="inscrever"
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
              {copy.watch[locale]} →
            </Button>
          )}
        </div>
      </div>
    </section>
  );
}
