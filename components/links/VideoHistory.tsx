import { ExternalLink } from '@/components/ExternalLink';
import { OptimizedImage } from '@/components/OptimizedImage';
import { linksContent } from '@/content/links';
import type { LinksLocale } from '@/content/links.constants';
import { linksUi } from '@/content/links-ui';
import type { ChannelFeed } from '@/lib/links/feed';
import { formatCompact } from '@/lib/links/format';
import { formatRelative } from '@/lib/links/relative-time';
import { withUtm } from '@/lib/links/utm';
import { NewTabHint } from './NewTabHint';
import { SectionHeading } from './SectionHeading';

const HEADING_ID = 'links-history-heading';
const THUMB_WIDTH = 64;
const THUMB_HEIGHT = 36;
const INDEX_PAD = 2;

function meta(
  video: ChannelFeed['history'][number],
  locale: LinksLocale,
  viewsWord: string,
  fetchedAt: ChannelFeed['fetchedAt'],
): string {
  const relative =
    fetchedAt === null
      ? null
      : formatRelative(new Date(video.publishedAt), locale, new Date(fetchedAt));
  const parts = [
    video.duration,
    video.viewCount === undefined
      ? undefined
      : `${formatCompact(video.viewCount, locale)} ${viewsWord}`,
    relative ?? undefined,
  ];
  return parts.filter((part): part is string => part !== undefined).join(' · ');
}

export function VideoHistory({ locale, feed }: { locale: LinksLocale; feed: ChannelFeed }) {
  const { copy } = linksContent;
  const isEmpty = feed.history.length === 0;

  return (
    <section className="links-col" data-col="history" aria-labelledby={HEADING_ID}>
      <SectionHeading id={HEADING_ID} trailing={`$ ${copy.historyCommand}`}>
        {copy.latestHeading[locale]}
      </SectionHeading>

      {isEmpty && (
        <p className="links-history-empty">
          <span aria-hidden="true" className="links-history-empty-prompt">
            ${' '}
          </span>
          {copy.historyEmpty[locale]}
        </p>
      )}

      {!isEmpty && (
        <ol className="links-history-list">
          {feed.history.map((video, index) => (
            <li key={video.id} className="links-history-item">
              <ExternalLink
                href={withUtm(video.url, `video-${index + 1}`)}
                data-outbound={`video-${index + 1}`}
                className="links-history-row"
              >
                <span className="links-history-index">
                  {String(index + 1).padStart(INDEX_PAD, '0')}
                </span>
                <span className="links-thumb links-history-thumb">
                  <OptimizedImage
                    src={video.thumbnailUrl}
                    alt=""
                    width={THUMB_WIDTH}
                    height={THUMB_HEIGHT}
                    sizes="64px"
                    className="object-cover h-full w-full"
                  />
                </span>
                <span>
                  <span className="links-history-title">{video.title}</span>
                  <span className="links-history-meta">
                    {meta(video, locale, copy.viewsWord[locale], feed.fetchedAt)}
                  </span>
                </span>
                <span aria-hidden="true" className="links-history-arrow">
                  {linksUi.arrow}
                </span>
                <NewTabHint text={copy.opensInNewTab[locale]} />
              </ExternalLink>
            </li>
          ))}
        </ol>
      )}

      <ExternalLink
        href={withUtm(`${feed.channelUrl}/videos`, 'todos-videos')}
        data-outbound="todos-videos"
        className="links-history-all"
      >
        {copy.seeAllVideos[locale]}
        <NewTabHint text={copy.opensInNewTab[locale]} />
      </ExternalLink>
    </section>
  );
}
