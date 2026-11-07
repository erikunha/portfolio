import { Suspense } from 'react';
import { PageMain } from '@/components/PageMain';
import { SiteShell } from '@/components/SiteShell';
import { linksContent } from '@/content/links';
import { LINKS_PATH, type LinksLocale } from '@/content/links.constants';
import { CHANNEL_URL, EMPTY_FEED, getChannelFeed } from '@/lib/links/feed';
import { ChannelCard } from './ChannelCard';
import { ChromeBar } from './ChromeBar';
import { NavProgress } from './client/NavProgress.client';
import { IdentityCard } from './IdentityCard';
import { LatestVideoSkeleton } from './LatestVideoSkeleton';
import { LinkPills } from './LinkPills';
import { LinksFooter } from './LinksFooter';
import { PlaylistCards } from './PlaylistCards';
import { QrPanel } from './QrPanel';
import { Ticker } from './Ticker';
import { VideoHistory } from './VideoHistory';

async function LinksTicker({ locale }: { locale: LinksLocale }) {
  const feed = await getChannelFeed().catch(() => EMPTY_FEED);
  return feed.latest === null ? <Ticker locale={locale} /> : null;
}

async function LinksFeedColumn({ locale }: { locale: LinksLocale }) {
  const feed = await getChannelFeed().catch(() => EMPTY_FEED);
  return (
    <>
      <ChannelCard locale={locale} feed={feed} />
      <VideoHistory locale={locale} feed={feed} />
    </>
  );
}

export function LinksPage({ locale }: { locale: LinksLocale }) {
  const { copy, siteUrl } = linksContent;
  const pageUrl = `${siteUrl}${LINKS_PATH[locale]}`;

  return (
    <SiteShell locale={locale}>
      <NavProgress />
      <div className="links-page">
        <PageMain className="page-container page-main links-main">
          <h1 className="sr-only">{copy.pageHeading[locale]}</h1>
          <Suspense fallback={null}>
            <LinksTicker locale={locale} />
          </Suspense>
          <ChromeBar />
          <div className="links-grid">
            <div className="links-stack" data-stack="primary">
              <IdentityCard locale={locale} />
              <LinkPills locale={locale} url={pageUrl} />
              <QrPanel locale={locale} url={pageUrl} />
            </div>
            <div className="links-stack" data-stack="secondary">
              <Suspense fallback={<LatestVideoSkeleton locale={locale} />}>
                <LinksFeedColumn locale={locale} />
              </Suspense>
              <PlaylistCards locale={locale} channelUrl={CHANNEL_URL} />
            </div>
          </div>
          <LinksFooter />
        </PageMain>
      </div>
    </SiteShell>
  );
}
