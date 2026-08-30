import { linksContent } from '@/content/links';
import type { LinksLocale } from '@/content/links.constants';
import { Badge } from '@/design-system';
import { TaglineTyper } from './client/TaglineTyper.client';

export function IdentityCard({ locale }: { locale: LinksLocale }) {
  const { profile, copy } = linksContent;

  const rows: { label: string; value: React.ReactNode }[] = [
    { label: copy.hostLabel[locale], value: profile.host[locale] },
    { label: copy.stackLabel[locale], value: profile.stack },
    {
      label: copy.statusLabel[locale],
      value: (
        <Badge variant="dot" size="sm">
          {profile.status[locale]}
        </Badge>
      ),
    },
  ];

  return (
    <div className="links-identity px-[18px] pt-[6px]">
      <p className="m-0 mb-2 text-tertiary-400 text-[10.5px]">
        <span className="text-primary-400">$</span> {copy.whoami}
      </p>

      <div className="links-identity-box border border-primary-border bg-[var(--color-glow-03)] p-[14px]">
        <div className="flex gap-3 items-center">
          <span
            aria-hidden="true"
            className="links-avatar w-14 h-14 flex-[0_0_56px] border border-primary-subtle grid place-items-center text-primary-500 text-[9px] tracking-[0.06em] text-center leading-[1.3] lg:w-24 lg:h-24 lg:flex-[0_0_96px] lg:text-[11px]"
          >
            {profile.name
              .split(' ')
              .map((part) => part.charAt(0))
              .join('')}
          </span>
          <div>
            <p className="signal-glow text-primary-500 font-bold text-lg tracking-[0.02em] m-0 lg:text-[30px]">
              {profile.name}
            </p>
            <p className="m-0 text-tertiary-400 text-[11.5px] min-h-[19px] lg:text-sm">
              <TaglineTyper phrases={profile.taglines[locale]} />
              <span className="boot-cursor" aria-hidden="true" />
            </p>
          </div>
        </div>

        <dl className="links-identity-meta mt-3 pt-[10px] border-t border-dashed border-primary-border grid grid-cols-[auto_1fr] gap-x-[10px] gap-y-[3px] text-[11px] text-primary-400 lg:text-[12.5px]">
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
