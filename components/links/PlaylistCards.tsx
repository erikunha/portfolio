import { ExternalLink } from '@/components/ExternalLink';
import { linksContent } from '@/content/links';
import type { LinksLocale } from '@/content/links.constants';
import { linksUi } from '@/content/links-ui';
import type { LinksPlaylist } from '@/content/schemas';
import { cn } from '@/lib/cn';
import { withUtm } from '@/lib/links/utm';
import { NewTabHint } from './NewTabHint';
import { SectionHeading } from './SectionHeading';

const HEADING_ID = 'links-playlists-heading';
const PLAYLIST_ENDPOINT = 'https://www.youtube.com/playlist?list=';

const CARD_HOVER =
  'hover:border-primary-500 hover:bg-linear-to-b hover:from-primary-500/[0.07] hover:to-primary-500/[0.07]';
const TAG = 'border border-primary-subtle text-tertiary-50 text-xs tracking-md py-0.5 px-1';
const ARROW = 'text-sm text-primary-500';

function destination(playlist: LinksPlaylist, channelUrl: string): string {
  if (playlist.playlistId) return `${PLAYLIST_ENDPOINT}${playlist.playlistId}`;
  return `${channelUrl}/playlists`;
}

export function PlaylistCards({ locale, channelUrl }: { locale: LinksLocale; channelUrl: string }) {
  const { playlists, copy } = linksContent;
  const linkable = playlists.map((playlist) => ({
    playlist,
    href: destination(playlist, channelUrl),
  }));

  if (linkable.length === 0) return null;

  return (
    <section className="links-col" data-col="playlists" aria-labelledby={HEADING_ID}>
      <SectionHeading id={HEADING_ID}>{copy.playlistsHeading[locale]}</SectionHeading>

      <ul className="links-playlists list-none m-0 p-0">
        {linkable.map(({ playlist, href }) => (
          <li key={playlist.id}>
            <ExternalLink
              href={withUtm(href, `playlist-${playlist.id}`)}
              data-outbound={`playlist-${playlist.id}`}
              className={cn(
                'block h-full border border-primary-border p-4 no-underline bg-secondary-950 transition-[border-color,background] duration-150 [body[data-motion=reduce]_&]:transition-none',
                CARD_HOVER,
              )}
            >
              <span className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-2">
                  <span className={TAG}>{playlist.tag}</span>
                  <span className="text-tertiary-50 text-sm">{playlist.title[locale]}</span>
                </span>
                <span aria-hidden="true" className={ARROW}>
                  {linksUi.arrow}
                </span>
              </span>
              <span className="block mt-2 text-tertiary-400 text-xs text-pretty">
                {playlist.description[locale]}
              </span>
              <NewTabHint text={copy.opensInNewTab[locale]} />
            </ExternalLink>
          </li>
        ))}
      </ul>
    </section>
  );
}
