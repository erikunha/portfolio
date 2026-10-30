import type { Metadata } from 'next';
import { PrintButton } from '@/components/client/PrintButton';
import { cvDocument, cvJsonLd, READING_PATHS, readingViews } from '@/content/reading-views';
import { social } from '@/content/social';
import { Button } from '@/design-system';

const { shared, cv } = readingViews;
const MAIN_ID = 'main-content';
const SOCIAL_IMAGE = `${social.site}${shared.ogImage.path}`;
const CANONICAL = `${social.site}${cv.path}`;
const CARD_TYPE = 'summary_large_image';
const OG_PROFILE_TYPE = 'profile';
const JSON_LD_TYPE = 'application/ld+json';

export const metadata: Metadata = {
  title: cv.title,
  description: cv.description,
  alternates: { canonical: CANONICAL },
  openGraph: {
    type: OG_PROFILE_TYPE,
    url: CANONICAL,
    title: cv.title,
    description: cv.description,
    images: [
      {
        url: SOCIAL_IMAGE,
        width: shared.ogImage.width,
        height: shared.ogImage.height,
        alt: cvDocument.name,
      },
    ],
  },
  twitter: {
    card: CARD_TYPE,
    title: cv.title,
    description: cv.description,
    images: [SOCIAL_IMAGE],
  },
};

const sectionId = (key: string) => `cv-${key}`;

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
      <h2 id={sectionId(name)} className="reading-heading" data-type-reveal>
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

export default function CvPage() {
  return (
    <div className="reading-view">
      <script type={JSON_LD_TYPE}>{JSON.stringify(cvJsonLd)}</script>
      <a href={`#${MAIN_ID}`} className="skip-to-content">
        {shared.skipLabel}
      </a>
      <header className="reading-bar">
        <div className="reading-bar-in">
          <a className="reading-brand" href={shared.homeHref}>
            {shared.homeLabel}
          </a>
          <nav aria-label={shared.navLabel} className="reading-nav">
            {shared.nav.map((item) => (
              <a key={item.href} href={item.href}>
                {item.label}
              </a>
            ))}
          </nav>
        </div>
      </header>
      <main id={MAIN_ID} tabIndex={-1} className="reading-doc">
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
          <Button as="a" variant="secondary" href={READING_PATHS.summary}>
            {cv.summaryLinkLabel}
          </Button>
          <PrintButton label={shared.printLabel} />
        </div>

        <header>
          <h1 className="reading-name">{cvDocument.name}</h1>
          <p className="reading-role">{cvDocument.role}</p>
          <p className="reading-meta">{cvDocument.location}</p>
          <ul className="reading-links">
            {cvDocument.links.map((link) => (
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
          <p>{cvDocument.summary}</p>
        </Section>

        <Section name="experience" heading={cv.headings.experience}>
          {cvDocument.experience.map((job) => (
            <article key={job.key} className="reading-entry">
              <h3 data-type-reveal>{job.company}</h3>
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
          <p>{cvDocument.skills.join(' · ')}</p>
        </Section>

        <Section name="certifications" heading={cv.headings.certifications}>
          <Rows rows={cvDocument.certifications} />
        </Section>

        <Section name="community" heading={cv.headings.community}>
          <article className="reading-entry">
            <h3>
              {cvDocument.community.href ? (
                <a href={cvDocument.community.href} target="_blank" rel={shared.newTabRel}>
                  {cvDocument.community.heading}
                  <span className="sr-only"> {shared.newTabHint}</span>
                </a>
              ) : (
                cvDocument.community.heading
              )}
            </h3>
            <ul>
              {cvDocument.community.bullets.map((bullet) => (
                <li key={bullet}>{bullet}</li>
              ))}
            </ul>
            <p className="reading-meta">{cvDocument.community.status}</p>
          </article>
        </Section>

        <Section name="education" heading={cv.headings.education}>
          <Rows rows={cvDocument.education} />
        </Section>

        <Section name="contact" heading={cv.headings.contact}>
          <p className="reading-meta">{cvDocument.languages}</p>
          <p className="reading-actions-inline">
            <a
              href={shared.hire.href}
              target="_blank"
              rel={shared.newTabRel}
              aria-label={shared.hire.ariaLabel}
            >
              {shared.hire.label}
            </a>
            <a href={`mailto:${cvDocument.email}`}>{cvDocument.email}</a>
          </p>
        </Section>
      </main>
    </div>
  );
}
