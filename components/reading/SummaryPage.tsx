import { BrandLink } from '@/components/BrandLink';
import { CompanyMention } from '@/components/CompanyLink';
import { PrintButton } from '@/components/client/PrintButton';
import { readingViews, summaryDocument } from '@/content/reading-views';
import type { SiteLocale } from '@/content/site-locale';
import { Button, StatTile, TerminalPanel } from '@/design-system';
import { ReadingLanguageSwitch } from './LanguageSwitch';

const MAIN_ID = 'main-content';

const sectionId = (key: string) => `summary-${key}`;

export function SummaryPage({ locale }: { locale: SiteLocale }) {
  const { shared, summary } = readingViews[locale];
  const doc = summaryDocument[locale];
  const cvPath = readingViews[locale].cv.path;
  return (
    <div className="reading-view">
      <a href={`#${MAIN_ID}`} className="skip-to-content">
        {shared.skipLabel}
      </a>
      <header className="reading-bar">
        <div className="reading-bar-in">
          <BrandLink />
          <nav aria-label={shared.navLabel} className="reading-nav">
            {shared.nav.map((item) => (
              <a key={item.href} href={item.href}>
                {item.label}
              </a>
            ))}
          </nav>
          <ReadingLanguageSwitch
            locale={locale}
            label={locale === 'pt' ? 'Idioma' : 'Language'}
            path="/summary"
          />
        </div>
      </header>
      <main id={MAIN_ID} tabIndex={-1} className="reading-doc reading-doc--wide">
        <section aria-labelledby={sectionId('who')}>
          <h1 id={sectionId('who')} className="reading-name">
            {doc.name}
          </h1>
          <p className="reading-role">{doc.tagline}</p>
          <p className="reading-meta">{doc.technologyLine}</p>
          <p className="reading-meta">
            <CompanyMention
              text={doc.context}
              company={doc.employer.name}
              href={doc.employer.url}
            />
          </p>
        </section>

        <section className="reading-stats mt-6" aria-label={summary.statsLabel}>
          {doc.stats.map((stat) => (
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
          <Button as="a" variant="secondary" href={cvPath}>
            {summary.cvLinkLabel}
          </Button>
          <PrintButton label={shared.printLabel} />
        </div>

        <section aria-labelledby={sectionId('projects')} className="reading-section">
          <h2
            id={sectionId('projects')}
            className="reading-heading"
            data-type-reveal
            suppressHydrationWarning
          >
            {summary.headings.projects}
          </h2>
          <ul className="reading-projects">
            {doc.projects.map((project) => (
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
          <section aria-labelledby={sectionId('stack')} className="reading-section">
            <h2
              id={sectionId('stack')}
              className="reading-heading"
              data-type-reveal
              suppressHydrationWarning
            >
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
          <h2
            id={sectionId('contact')}
            className="reading-heading"
            data-type-reveal
            suppressHydrationWarning
          >
            {summary.headings.contact}
          </h2>
          <p className="reading-actions-inline">
            <a href={`mailto:${doc.email}`}>{doc.email}</a>
          </p>
          <p className="reading-meta">{doc.languages}</p>
        </section>
      </main>
    </div>
  );
}
