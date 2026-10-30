import type { Metadata } from 'next';
import { PrintButton } from '@/components/client/PrintButton';
import { READING_PATHS, readingViews, summaryDocument } from '@/content/reading-views';
import { social } from '@/content/social';
import { Badge, Button, StatTile, TerminalPanel } from '@/design-system';

const { shared, summary } = readingViews;
const MAIN_ID = 'main-content';
const SOCIAL_IMAGE = `${social.site}${shared.ogImage.path}`;
const CANONICAL = `${social.site}${summary.path}`;
const CARD_TYPE = 'summary_large_image';
const OG_WEBSITE_TYPE = 'website';

export const metadata: Metadata = {
  title: summary.title,
  description: summary.description,
  alternates: { canonical: CANONICAL },
  openGraph: {
    type: OG_WEBSITE_TYPE,
    url: CANONICAL,
    title: summary.title,
    description: summary.description,
    images: [
      {
        url: SOCIAL_IMAGE,
        width: shared.ogImage.width,
        height: shared.ogImage.height,
        alt: summaryDocument.name,
      },
    ],
  },
  twitter: {
    card: CARD_TYPE,
    title: summary.title,
    description: summary.description,
    images: [SOCIAL_IMAGE],
  },
};

const sectionId = (key: string) => `summary-${key}`;

export default function SummaryPage() {
  return (
    <div className="reading-view">
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
      <main id={MAIN_ID} tabIndex={-1} className="reading-doc reading-doc--wide">
        <section aria-labelledby={sectionId('who')}>
          <h1 id={sectionId('who')} className="reading-name">
            {summaryDocument.name}
          </h1>
          <p className="reading-role">{summaryDocument.tagline}</p>
          <p className="reading-meta">{summaryDocument.technologyLine}</p>
          <p className="reading-meta">{summaryDocument.context}</p>
          <p className="mt-2 print:hidden">
            <Badge>{summary.badge}</Badge>
          </p>
        </section>

        <section className="reading-stats mt-6" aria-label={summary.statsLabel}>
          {summaryDocument.stats.map((stat) => (
            <StatTile key={stat.label} value={stat.value} label={stat.label} variant="display" />
          ))}
        </section>

        <div className="reading-actions mt-6">
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
          <Button as="a" variant="secondary" href={READING_PATHS.cv}>
            {summary.cvLinkLabel}
          </Button>
          <PrintButton label={shared.printLabel} />
        </div>

        <section aria-labelledby={sectionId('projects')} className="reading-section">
          <h2 id={sectionId('projects')} className="reading-heading" data-type-reveal>
            {summary.headings.projects}
          </h2>
          <ul className="reading-projects">
            {summaryDocument.projects.map((project) => (
              <li key={project.name}>
                <TerminalPanel header={project.name}>
                  <div className="px-3.5 py-3">
                    <p className="reading-meta">{project.label}</p>
                    <p className="font-bold">{project.value}</p>
                    <p className="reading-meta">{project.description}</p>
                  </div>
                </TerminalPanel>
              </li>
            ))}
          </ul>
        </section>

        <div className="reading-grid">
          <section aria-labelledby={sectionId('auth')} className="reading-section">
            <h2 id={sectionId('auth')} className="reading-heading" data-type-reveal>
              {summary.headings.workAuthorization}
            </h2>
            <ul className="reading-rows">
              {summaryDocument.authorization.map((row) => (
                <li key={row.jurisdiction}>
                  <span className="reading-row-key">{row.jurisdiction}</span>
                  <span className="reading-row-value">
                    {row.status} <span className="reading-meta">{row.evidence}</span>
                  </span>
                </li>
              ))}
            </ul>
            <p className="reading-meta">{summaryDocument.languages}</p>
          </section>

          <section aria-labelledby={sectionId('stack')} className="reading-section">
            <h2 id={sectionId('stack')} className="reading-heading" data-type-reveal>
              {summary.headings.stack}
            </h2>
            <ul className="reading-chips">
              {summary.stack.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>
        </div>

        <section aria-labelledby={sectionId('contact')} className="reading-section">
          <h2 id={sectionId('contact')} className="reading-heading" data-type-reveal>
            {summary.headings.contact}
          </h2>
          <p className="reading-actions-inline">
            <a href={`mailto:${summaryDocument.email}`}>{summaryDocument.email}</a>
          </p>
        </section>
      </main>
    </div>
  );
}
