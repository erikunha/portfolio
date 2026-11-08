import { linksContent } from '@/content/links';
import type { LinksLocale } from '@/content/links.constants';
import { linksUi } from '@/content/links-ui';
import { hostLabel } from '@/lib/links/host-label';
import { CopyLinkButton } from './client/CopyLinkButton.client';
import { LineContent } from './LineContent';
import { PillGlyph } from './LinkIcons';
import { isLinkedMail } from './link-pills';
import { SectionHeading } from './SectionHeading';

const HEADING_ID = 'links-contact-heading';

export function ContactLines({ locale, url }: { locale: LinksLocale; url: string }) {
  const { pills, copy } = linksContent;
  const mail = pills.filter(isLinkedMail);

  return (
    <section className="links-col" data-col="contact" aria-labelledby={HEADING_ID}>
      <SectionHeading id={HEADING_ID}>{copy.contactHeading[locale]}</SectionHeading>

      <ul data-testid="links-contact" className="links-lines">
        {mail.map((pill) => (
          <li key={pill.id}>
            <a href={pill.href} className="links-line">
              <LineContent
                glyph={<PillGlyph icon={pill.icon} />}
                label={pill.label[locale]}
                host={copy.emailHint[locale]}
                arrow={linksUi.arrow}
              />
            </a>
          </li>
        ))}
        <li>
          <CopyLinkButton
            url={url}
            hostLabel={hostLabel(url)}
            idleLabel={copy.copyLink[locale]}
            doneLabel={copy.copyDone[locale]}
            failedLabel={copy.copyFailed[locale]}
            failedMessage={copy.copyFailedMessage[locale]}
          />
        </li>
      </ul>
    </section>
  );
}
