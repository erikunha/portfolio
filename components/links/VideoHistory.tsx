import Image from 'next/image';
import { linksContent } from '@/content/links';
import { LINKS_INTL_LOCALE, type LinksLocale } from '@/content/links.constants';
import type { ChannelFeed } from '@/lib/links/feed';
import { formatRelative } from '@/lib/links/relative-time';
import { withUtm } from '@/lib/links/utm';
import { SectionHeading } from './SectionHeading';

const HEADING_ID = 'links-history-heading';
const THUMB_WIDTH = 64;
const THUMB_HEIGHT = 36;
const INDEX_PAD = 2;

function meta(
  video: ChannelFeed['history'][number],
  locale: LinksLocale,
  viewsWord: string,
): string {
  const relative = formatRelative(new Date(video.publishedAt), locale);
  const parts = [
    video.duration,
    video.viewCount === undefined
      ? undefined
      : `${new Intl.NumberFormat(LINKS_INTL_LOCALE[locale], { notation: 'compact', maximumFractionDigits: 1 }).format(video.viewCount)} ${viewsWord}`,
    relative ?? undefined,
  ];
  return parts.filter((part): part is string => part !== undefined).join(' · ');
}

export function VideoHistory({ locale, feed }: { locale: LinksLocale; feed: ChannelFeed }) {
  const { copy } = linksContent;
  if (feed.history.length === 0) return null;

  return (
    <section
      className="links-col px-[18px] pt-[18px]"
      data-col="history"
      aria-labelledby={HEADING_ID}
    >
      <SectionHeading id={HEADING_ID} trailing={`$ ${copy.historyCommand}`}>
        {copy.latestHeading[locale]}
      </SectionHeading>

      <ol className="list-none m-0 p-0 border border-primary-border bg-[var(--color-glow-03)]">
        {feed.history.map((video, index) => (
          <li key={video.id} className="border-b border-primary-quiet last:border-b-0">
            <a
              href={withUtm(video.url, `video-${index + 1}`)}
              target="_blank"
              rel="noopener noreferrer"
              data-outbound={`video-${index + 1}`}
              className="grid grid-cols-[20px_64px_1fr_auto] gap-[11px] items-center py-[11px] px-[13px] no-underline transition-colors duration-150 hover:bg-[var(--color-glow-06)] focus-visible:outline-2 focus-visible:outline-primary-500 focus-visible:-outline-offset-2"
            >
              <span className="text-primary-400 text-[11px]">
                {String(index + 1).padStart(INDEX_PAD, '0')}
              </span>
              <Image
                src={video.thumbnailUrl}
                alt=""
                width={THUMB_WIDTH}
                height={THUMB_HEIGHT}
                sizes="64px"
                className="border border-primary-border object-cover h-9 w-16"
              />
              <span>
                <span className="block text-tertiary-50 text-[12.5px] leading-[1.45] text-pretty">
                  {video.title}
                </span>
                <span className="block text-tertiary-400 text-[10px] mt-0.5">
                  {meta(video, locale, copy.viewsWord[locale])}
                </span>
              </span>
              <span aria-hidden="true" className="text-primary-subtle text-xs">
                →
              </span>
            </a>
          </li>
        ))}
      </ol>

      {feed.channelUrl !== null && (
        <a
          href={withUtm(`${feed.channelUrl}/videos`, 'todos-videos')}
          target="_blank"
          rel="noopener noreferrer"
          data-outbound="todos-videos"
          className="flex items-center justify-center gap-2 p-3 border border-t-0 border-primary-border bg-[var(--color-glow-04)] text-primary-500 font-bold text-[11.5px] tracking-[0.1em] uppercase no-underline transition-colors duration-150 hover:bg-primary-quiet focus-visible:outline-2 focus-visible:outline-primary-500 focus-visible:-outline-offset-2"
        >
          {copy.seeAllVideos[locale]}
        </a>
      )}
    </section>
  );
}
