import { linksContent } from '@/content/links';
import { LINKS_HTML_LANG, LINKS_PATH, type LinksLocale } from '@/content/links.constants';
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

const MAIN_ID = 'links-main';

export async function LinksPage({ locale }: { locale: LinksLocale }) {
  const { copy, siteUrl } = linksContent;
  const feed: ChannelFeed = await getChannelFeed().catch(() => EMPTY_FEED);
  const pageUrl = `${siteUrl}${LINKS_PATH[locale]}`;

  return (
    <div
      lang={LINKS_HTML_LANG[locale]}
      className="relative min-h-screen bg-secondary-950 text-tertiary-50 font-mono text-sm leading-[1.6]"
    >
      <NavProgress />
      <div className="crt-scanlines" aria-hidden="true" />
      <div className="crt-vignette" aria-hidden="true" />

      <a
        href={`#${MAIN_ID}`}
        className="sr-only focus:not-sr-only focus:absolute focus:z-30 focus:top-2 focus:left-2 focus:bg-secondary-950 focus:text-primary-500 focus:border focus:border-primary-500 focus:px-3 focus:py-2"
      >
        {copy.skipToContent[locale]}
      </a>

      <Ticker locale={locale} />

      <div className="links-shell relative z-10">
        <ChromeBar locale={locale} />

        <main id={MAIN_ID} tabIndex={-1} className="links-main-grid">
          <h1 className="sr-only">{copy.pageHeading[locale]}</h1>
          <IdentityCard locale={locale} />
          <ChannelCard locale={locale} feed={feed} />
          <VideoHistory locale={locale} feed={feed} />
          <PlaylistCards locale={locale} channelUrl={feed.channelUrl} />
          <QrPanel locale={locale} url={pageUrl} />
        </main>

        <LinksFooter locale={locale} url={pageUrl} />
      </div>
    </div>
  );
}
