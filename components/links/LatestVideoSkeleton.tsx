import { linksContent } from '@/content/links';
import type { LinksLocale } from '@/content/links.constants';
import { linksUi } from '@/content/links-ui';
import { HISTORY_LENGTH } from '@/lib/links/feed';
import { SectionHeading } from './SectionHeading';

const CHANNEL_HEADING_ID = 'links-channel-loading-heading';
const HISTORY_HEADING_ID = 'links-history-loading-heading';
const TEXT_BAR_COUNT = 3;
const TEXT_BARS = Array.from({ length: TEXT_BAR_COUNT }, (_, position) => ({ position }));
const HISTORY_ROWS = Array.from({ length: HISTORY_LENGTH }, (_, position) => ({ position }));

export function LatestVideoSkeleton({ locale }: { locale: LinksLocale }) {
  const { copy } = linksContent;
  return (
    <>
      <div
        className="links-col links-skeleton"
        data-col="channel-loading"
        role="status"
        aria-busy="true"
        aria-label={linksUi.latestVideoLoading[locale]}
      >
        <div aria-hidden="true">
          <SectionHeading id={CHANNEL_HEADING_ID} reveal={false}>
            {copy.watchHeading[locale]}
          </SectionHeading>
          <div className="links-channel-card links-watch border border-primary-subtle p-4">
            <div className="links-watch-media">
              <div className="links-skeleton-block links-skeleton-thumb" />
            </div>
            <div className="links-watch-body">
              <span className="links-skeleton-block links-skeleton-title" />
              <div className="links-skeleton-bars">
                {TEXT_BARS.map(({ position }) => (
                  <span key={position} className="links-skeleton-block links-skeleton-bar" />
                ))}
              </div>
            </div>
            <div className="links-watch-actions">
              <span className="links-skeleton-block links-skeleton-action" />
            </div>
          </div>
        </div>
      </div>
      <div className="links-col links-skeleton" data-col="history-loading" aria-hidden="true">
        <SectionHeading
          id={HISTORY_HEADING_ID}
          trailing={`$ ${copy.historyCommand}`}
          reveal={false}
        >
          {copy.latestHeading[locale]}
        </SectionHeading>
        <ol className="links-history-list">
          {HISTORY_ROWS.map(({ position }) => (
            <li key={position} className="links-history-item">
              <span className="links-history-row">
                <span className="links-skeleton-block links-skeleton-index" />
                <span className="links-skeleton-block links-skeleton-history-thumb" />
                <span className="links-skeleton-lines">
                  <span className="links-skeleton-block links-skeleton-line" />
                  <span className="links-skeleton-block links-skeleton-line" />
                </span>
              </span>
            </li>
          ))}
        </ol>
        <span className="links-skeleton-block links-skeleton-all" />
      </div>
    </>
  );
}
