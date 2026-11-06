import type { LinksLocale } from '@/content/links.constants';
import { linksUi } from '@/content/links-ui';

const TEXT_BAR_COUNT = 3;
const TEXT_BARS = Array.from({ length: TEXT_BAR_COUNT }, (_, position) => ({ position }));

export function LatestVideoSkeleton({ locale }: { locale: LinksLocale }) {
  return (
    <div
      className="links-col links-skeleton"
      data-col="channel-loading"
      role="status"
      aria-label={linksUi.latestVideoLoading[locale]}
    >
      <div className="links-channel-card border border-primary-subtle p-4">
        <div className="links-skeleton-block links-skeleton-thumb" aria-hidden="true" />
        <div className="links-skeleton-bars" aria-hidden="true">
          {TEXT_BARS.map(({ position }) => (
            <span key={position} className="links-skeleton-block links-skeleton-bar" />
          ))}
        </div>
      </div>
    </div>
  );
}
