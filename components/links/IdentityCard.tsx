import Image from 'next/image';
import { linksContent } from '@/content/links';
import type { LinksLocale } from '@/content/links.constants';
import { TaglineTyper } from './client/TaglineTyper.client';

const AVATAR_MOBILE_PX = 56;
const AVATAR_DESKTOP_PX = 96;
const AVATAR_SIZES = `(min-width: 1024px) ${AVATAR_DESKTOP_PX}px, ${AVATAR_MOBILE_PX}px`;

export function IdentityCard({ locale }: { locale: LinksLocale }) {
  const { profile, copy } = linksContent;

  const rows: { label: string; value: React.ReactNode }[] = [
    { label: copy.hostLabel[locale], value: profile.host[locale] },
    { label: copy.stackLabel[locale], value: profile.stack },
    {
      label: copy.statusLabel[locale],
      value: (
        <span className="inline-flex items-center gap-2">
          <span className="badge-dot" aria-hidden="true" />
          {profile.status[locale]}
        </span>
      ),
    },
  ];

  return (
    <div className="links-identity pt-2">
      <p className="m-0 mb-2 text-tertiary-400 text-xs">
        <span className="text-tertiary-400">$</span> {copy.whoami}
      </p>

      <div className="links-identity-box border border-primary-border bg-[var(--color-glow-03)] p-4">
        <div className="flex gap-3 items-center">
          <span className="links-avatar w-14 h-14 flex-[0_0_56px] border border-primary-subtle overflow-hidden lg:w-24 lg:h-24 lg:flex-[0_0_96px]">
            <Image
              src={profile.avatar}
              alt=""
              width={AVATAR_DESKTOP_PX}
              height={AVATAR_DESKTOP_PX}
              sizes={AVATAR_SIZES}
              priority
              className="h-full w-full object-cover"
            />
          </span>
          <div>
            <p className="signal-glow text-primary-500 font-bold text-xl tracking-[0.02em] m-0 lg:text-3xl">
              {profile.name}
            </p>
            <p className="m-0 grid text-tertiary-400 text-xs lg:text-sm">
              {profile.taglines[locale].map((phrase) => (
                <span
                  key={phrase}
                  className="tagline-sizer invisible [grid-area:1/1]"
                  aria-hidden="true"
                >
                  {phrase}
                  <span className="boot-cursor" />
                </span>
              ))}
              <span className="tagline-live [grid-area:1/1]">
                <TaglineTyper phrases={profile.taglines[locale]} />
                <span className="boot-cursor" aria-hidden="true" />
              </span>
            </p>
          </div>
        </div>

        <dl className="links-identity-meta mt-3 pt-3 border-t border-dashed border-primary-border grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs text-tertiary-400">
          {rows.map((row) => (
            <div key={row.label} className="contents">
              <dt>{row.label}</dt>
              <dd className="m-0 text-tertiary-50/85">{row.value}</dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}
