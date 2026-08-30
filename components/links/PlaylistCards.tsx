import { linksContent } from '@/content/links';
import type { LinksLocale, PlaylistAccent } from '@/content/links.constants';
import type { LinksPlaylist } from '@/content/schemas';
import { cn } from '@/lib/cn';
import { withUtm } from '@/lib/links/utm';
import { SectionHeading } from './SectionHeading';

const HEADING_ID = 'links-playlists-heading';
const PLAYLIST_ENDPOINT = 'https://www.youtube.com/playlist?list=';

const ACCENT_CARD: Record<PlaylistAccent, string> = {
  quaternary: 'hover:border-quaternary-400 hover:bg-quaternary-400/[0.07]',
  quinary: 'hover:border-quinary-300 hover:bg-quinary-300/[0.07]',
};

const ACCENT_TAG: Record<PlaylistAccent, string> = {
  quaternary: 'border-quaternary-400/40 text-quaternary-400',
  quinary: 'border-quinary-300/40 text-quinary-300',
};

const ACCENT_ARROW: Record<PlaylistAccent, string> = {
  quaternary: 'text-quaternary-400/60',
  quinary: 'text-quinary-300/60',
};

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
    <section
      className="links-col px-[18px] pt-[18px]"
      data-col="playlists"
      aria-labelledby={HEADING_ID}
    >
      <SectionHeading id={HEADING_ID}>{copy.playlistsHeading[locale]}</SectionHeading>

      <ul className="list-none m-0 p-0 grid gap-[10px]">
        {linkable.map(({ playlist, href }) => (
          <li key={playlist.id}>
            <a
              href={withUtm(href, `playlist-${playlist.id}`)}
              target="_blank"
              rel="noopener noreferrer"
              data-outbound={`playlist-${playlist.id}`}
              className={cn(
                'block border border-primary-border p-[14px] no-underline bg-[var(--color-glow-03)] transition-[border-color,background] duration-150 focus-visible:outline-2 focus-visible:outline-primary-500 focus-visible:outline-offset-2',
                ACCENT_CARD[playlist.accent],
              )}
            >
              <span className="flex items-center justify-between gap-[10px]">
                <span className="flex items-center gap-[9px]">
                  <span
                    className={cn(
                      'border text-[9.5px] tracking-[0.06em] py-0.5 px-[5px]',
                      ACCENT_TAG[playlist.accent],
                    )}
                  >
                    {playlist.tag}
                  </span>
                  <span className="text-tertiary-50 text-[14.5px]">{playlist.title[locale]}</span>
                </span>
                <span
                  aria-hidden="true"
                  className={cn('text-[13px]', ACCENT_ARROW[playlist.accent])}
                >
                  →
                </span>
              </span>
              <span className="block mt-[6px] text-tertiary-400 text-[11px] text-pretty">
                {playlist.description[locale]}
              </span>
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
