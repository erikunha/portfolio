import { AppShell } from '@/components/AppShell';
import { BrandLink } from '@/components/BrandLink';
import { linksContent } from '@/content/links';
import { LINKS_HTML_LANG, LINKS_PATH, type LinksLocale } from '@/content/links.constants';
import { NAVIGATION, siteNavChrome } from '@/content/navigation';
import { SITE_LOCALE } from '@/content/site-locale';
import { type ChannelFeed, EMPTY_FEED, getChannelFeed } from '@/lib/links/feed';
import { ChannelCard } from './ChannelCard';
import { ChromeBar } from './ChromeBar';
import { NavProgress } from './client/NavProgress.client';
import { IdentityCard } from './IdentityCard';
import { LinksFooter } from './LinksFooter';
import { PlaylistCards } from './PlaylistCards';
import { QrPanel } from './QrPanel';
import { Ticker } from './Ticker';
import { VideoHistory } from './VideoHistory';

export async function LinksPage({ locale }: { locale: LinksLocale }) {
  const { copy, siteUrl } = linksContent;
  const feed: ChannelFeed = await getChannelFeed().catch(() => EMPTY_FEED);
  const pageUrl = `${siteUrl}${LINKS_PATH[locale]}`;

  return (
    <AppShell
      brand={<BrandLink />}
      chrome={siteNavChrome(SITE_LOCALE.en)}
      locale={SITE_LOCALE.en}
      skipLabel={NAVIGATION[SITE_LOCALE.en].copy.skipLabel}
    >
      <NavProgress />
      <div lang={LINKS_HTML_LANG[locale]} className="links-page">
        <main id="main-content" tabIndex={-1} className="page-container page-main links-main">
          <h1 className="sr-only">{copy.pageHeading[locale]}</h1>
          <Ticker locale={locale} />
          <ChromeBar locale={locale} />
          <IdentityCard locale={locale} />
          <div className="links-grid">
            <div className="links-stack" data-stack="primary">
              <ChannelCard locale={locale} feed={feed} />
              <QrPanel locale={locale} url={pageUrl} />
            </div>
            <div className="links-stack" data-stack="secondary">
              <VideoHistory locale={locale} feed={feed} />
              <PlaylistCards locale={locale} channelUrl={feed.channelUrl} />
            </div>
          </div>
          <LinksFooter locale={locale} url={pageUrl} />
        </main>
      </div>
    </AppShell>
  );
}
