import { CompanyLink } from '@/components/CompanyLink';
import { ExternalLink, externalLinkProps } from '@/components/ExternalLink';
import { cvDocument, cvJsonLd, readingViews } from '@/content/reading-views';
import type { SiteLocale } from '@/content/site-locale';
import { serializeJsonLd } from '@/lib/json-ld';
import { ReadingActions } from './ReadingActions';
import { ReadingSection } from './ReadingSection';
import { ReadingShell } from './ReadingShell';

const JSON_LD_TYPE = 'application/ld+json';

const sectionId = (key: string) => `cv-${key}`;
const NEW_TAB_NOTE_ID = 'cv-new-tab-note';
const SKILL_SEPARATOR = ' · ';

function Rows({ rows }: { rows: { key: string; label: string; value: string }[] }) {
  return (
    <ul className="reading-rows">
      {rows.map((row) => (
        <li key={row.key}>
          <span className="reading-row-key">{row.label}</span>
          <span className="reading-row-value">{row.value}</span>
        </li>
      ))}
    </ul>
  );
}

export function CvPage({ locale }: { locale: SiteLocale }) {
  const { shared, cv } = readingViews[locale];
  const document_ = cvDocument[locale];
  const summaryPath = readingViews[locale].summary.path;
  return (
    <ReadingShell locale={locale} route={readingViews[locale].cv.path}>
      <script type={JSON_LD_TYPE}>{serializeJsonLd(cvJsonLd)}</script>
      <ReadingActions
        locale={locale}
        secondary={{ href: summaryPath, label: cv.summaryLinkLabel }}
      />

      <header>
        <h1 className="reading-name">{document_.name}</h1>
        <p className="reading-role">{document_.role}</p>
        <p className="reading-meta">{document_.location}</p>
        <ul className="reading-links">
          {document_.links.map((link) => (
            <li key={link.href}>
              <a href={link.href} {...externalLinkProps(link.external)}>
                {link.label}
                {link.external ? <span className="sr-only"> {shared.newTabHint}</span> : null}
              </a>
            </li>
          ))}
        </ul>
      </header>

      <ReadingSection id={sectionId('summary')} heading={cv.headings.summary}>
        <p>{document_.summary}</p>
      </ReadingSection>

      <ReadingSection id={sectionId('experience')} heading={cv.headings.experience}>
        <span id={NEW_TAB_NOTE_ID} className="sr-only">
          {shared.newTabHint}
        </span>
        {document_.experience.map((job) => (
          <article key={job.key} className="reading-entry">
            <h3 data-type-reveal suppressHydrationWarning>
              <CompanyLink href={job.companyUrl} locale={locale} describedBy={NEW_TAB_NOTE_ID}>
                {job.company}
              </CompanyLink>
            </h3>
            <p className="reading-meta">{job.meta}</p>
            {job.context ? <p>{job.context}</p> : null}
            <ul>
              {job.bullets.map((bullet) => (
                <li key={bullet}>{bullet}</li>
              ))}
            </ul>
          </article>
        ))}
      </ReadingSection>

      <ReadingSection id={sectionId('skills')} heading={cv.headings.skills}>
        <p>{document_.skills.join(SKILL_SEPARATOR)}</p>
      </ReadingSection>

      <ReadingSection id={sectionId('certifications')} heading={cv.headings.certifications}>
        <Rows rows={document_.certifications} />
      </ReadingSection>

      <ReadingSection id={sectionId('community')} heading={cv.headings.community}>
        <article className="reading-entry">
          <h3>
            {document_.community.href ? (
              <ExternalLink href={document_.community.href}>
                {document_.community.heading}
                <span className="sr-only"> {shared.newTabHint}</span>
              </ExternalLink>
            ) : (
              document_.community.heading
            )}
          </h3>
          <ul>
            {document_.community.bullets.map((bullet) => (
              <li key={bullet}>{bullet}</li>
            ))}
          </ul>
          <p className="reading-meta">{document_.community.status}</p>
        </article>
      </ReadingSection>

      <ReadingSection id={sectionId('education')} heading={cv.headings.education}>
        <Rows rows={document_.education} />
      </ReadingSection>

      <ReadingSection id={sectionId('contact')} heading={cv.headings.contact}>
        <p className="reading-meta">{document_.languages}</p>
        <p className="reading-actions-inline">
          <ExternalLink
            className="reading-cta"
            href={shared.hire.href}
            aria-label={shared.hire.ariaLabel}
          >
            {shared.hire.label}
          </ExternalLink>
          <a href={`mailto:${document_.email}`}>{document_.email}</a>
        </p>
      </ReadingSection>
    </ReadingShell>
  );
}
