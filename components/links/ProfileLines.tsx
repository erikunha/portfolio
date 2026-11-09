import { EXTERNAL_LINK_PROPS } from '@/components/ExternalLink';
import { linksContent } from '@/content/links';
import type { LinksLocale } from '@/content/links.constants';
import { linksUi } from '@/content/links-ui';
import { hostLabel } from '@/lib/links/host-label';
import { withUtm } from '@/lib/links/utm';
import { LineContent } from './LineContent';
import { PillGlyph } from './LinkIcons';
import { isLinkedProfile } from './link-pills';
import { NewTabHint } from './NewTabHint';
import { SectionHeading } from './SectionHeading';

const HEADING_ID = 'links-profiles-heading';

export function ProfileLines({ locale }: { locale: LinksLocale }) {
  const { pills, copy } = linksContent;
  const profiles = pills.filter(isLinkedProfile);

  return (
    <section className="links-col" data-col="profiles" aria-labelledby={HEADING_ID}>
      <SectionHeading id={HEADING_ID}>{copy.profilesHeading[locale]}</SectionHeading>

      <ul data-testid="links-profiles" className="links-lines">
        {profiles.map((profile) => (
          <li key={profile.id}>
            <a
              href={withUtm(profile.href, profile.id)}
              {...EXTERNAL_LINK_PROPS}
              data-outbound={profile.id}
              className="links-line"
            >
              <LineContent
                glyph={<PillGlyph icon={profile.icon} />}
                label={profile.label[locale]}
                host={hostLabel(profile.href)}
                arrow={linksUi.arrow}
              />
              <NewTabHint text={copy.opensInNewTab[locale]} />
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
