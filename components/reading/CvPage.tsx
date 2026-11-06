import { CompanyLink } from '@/components/CompanyLink';
import { PrintButton } from '@/components/client/PrintButton';
import { cvDocument, cvJsonLd, readingViews } from '@/content/reading-views';
import type { SiteLocale } from '@/content/site-locale';
import { Button } from '@/design-system';
import { ReadingShell } from './ReadingShell';

const JSON_LD_TYPE = 'application/ld+json';

const sectionId = (key: string) => `cv-${key}`;
const NEW_TAB_NOTE_ID = 'cv-new-tab-note';

function Section({
  name,
  heading,
  children,
}: {
  name: string;
  heading: string;
  children: React.ReactNode;
}) {
  return (
    <section aria-labelledby={sectionId(name)} className="reading-section">
      <h2
        id={sectionId(name)}
        className="reading-heading"
        data-type-reveal
        suppressHydrationWarning
      >
        {heading}
      </h2>
      {children}
    </section>
  );
}

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
    <ReadingShell locale={locale}>
      <script type={JSON_LD_TYPE}>{JSON.stringify(cvJsonLd)}</script>
      <div className="reading-actions">
        <Button
          as="a"
          variant="primary"
          href={shared.hire.href}
          target="_blank"
          rel={shared.newTabRel}
          aria-label={shared.hire.ariaLabel}
        >
          {shared.hire.label}
        </Button>
        <Button as="a" variant="secondary" href={summaryPath}>
          {cv.summaryLinkLabel}
        </Button>
        <PrintButton label={shared.printLabel} />
      </div>

      <header>
        <h1 className="reading-name">{document_.name}</h1>
        <p className="reading-role">{document_.role}</p>
        <p className="reading-meta">{document_.location}</p>
        <ul className="reading-links">
          {document_.links.map((link) => (
            <li key={link.href}>
              <a
                href={link.href}
                {...(link.external ? { target: '_blank', rel: shared.newTabRel } : {})}
              >
                {link.label}
                {link.external ? <span className="sr-only"> {shared.newTabHint}</span> : null}
              </a>
            </li>
          ))}
        </ul>
      </header>

      <Section name="summary" heading={cv.headings.summary}>
        <p>{document_.summary}</p>
      </Section>

      <Section name="experience" heading={cv.headings.experience}>
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
            <ul>
              {job.bullets.map((bullet) => (
                <li key={bullet}>{bullet}</li>
              ))}
            </ul>
          </article>
        ))}
      </Section>

      <Section name="skills" heading={cv.headings.skills}>
        <p>{document_.skills.join(' · ')}</p>
      </Section>

      <Section name="certifications" heading={cv.headings.certifications}>
        <Rows rows={document_.certifications} />
      </Section>

      <Section name="community" heading={cv.headings.community}>
        <article className="reading-entry">
          <h3>
            {document_.community.href ? (
              <a href={document_.community.href} target="_blank" rel={shared.newTabRel}>
                {document_.community.heading}
                <span className="sr-only"> {shared.newTabHint}</span>
              </a>
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
      </Section>

      <Section name="education" heading={cv.headings.education}>
        <Rows rows={document_.education} />
      </Section>

      <Section name="contact" heading={cv.headings.contact}>
        <p className="reading-meta">{document_.languages}</p>
        <p className="reading-actions-inline">
          <a
            href={shared.hire.href}
            target="_blank"
            rel={shared.newTabRel}
            aria-label={shared.hire.ariaLabel}
          >
            {shared.hire.label}
          </a>
          <a href={`mailto:${document_.email}`}>{document_.email}</a>
        </p>
      </Section>
    </ReadingShell>
  );
}
