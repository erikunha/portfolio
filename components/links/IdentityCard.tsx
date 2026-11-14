import { CompanyMention } from '@/components/CompanyLink';
import { KeepTail } from '@/components/KeepTail';
import { OptimizedImage } from '@/components/OptimizedImage';
import { linksContent } from '@/content/links';
import type { LinksLocale } from '@/content/links.constants';
import { profile as siteProfile } from '@/content/profile';
import { TaglineTyper } from './client/TaglineTyper.client';

const AVATAR_PX = 56;
const AVATAR_SIZES = `${AVATAR_PX}px`;

export function IdentityCard({ locale }: { locale: LinksLocale }) {
  const { profile, copy } = linksContent;

  const rows: { label: string; value: React.ReactNode }[] = [
    {
      label: copy.hostLabel[locale],
      value: (
        <CompanyMention
          text={profile.host[locale]}
          company={siteProfile.currentEmployer.name}
          href={siteProfile.currentEmployer.url}
          locale={locale}
        />
      ),
    },
    { label: copy.stackLabel[locale], value: profile.stack },
  ];

  return (
    <div className="links-identity">
      <p className="links-identity-prompt">$ {copy.whoami}</p>

      <div className="links-identity-box">
        <div className="links-identity-head">
          <span className="links-avatar links-identity-avatar">
            <OptimizedImage
              src={profile.avatar}
              alt=""
              width={AVATAR_PX}
              height={AVATAR_PX}
              sizes={AVATAR_SIZES}
              priority
              className="h-full w-full object-cover"
            />
          </span>
          <div className="links-identity-text">
            <p className="signal-glow links-identity-name">{profile.name}</p>
            <p className="links-identity-tagline">
              {profile.taglines[locale].map((phrase) => (
                <span key={phrase} className="tagline-sizer" aria-hidden="true">
                  <KeepTail>{phrase}</KeepTail>
                  <span className="boot-cursor" />
                </span>
              ))}
              <span className="tagline-live">
                <TaglineTyper phrases={profile.taglines[locale]} />
                <span className="boot-cursor" aria-hidden="true" />
              </span>
            </p>
          </div>
        </div>

        <dl className="links-identity-meta">
          {rows.map((row) => (
            <div key={row.label}>
              <dt>{row.label}</dt>
              <dd>{row.value}</dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}
