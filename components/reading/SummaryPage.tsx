import { CompanyMention } from '@/components/CompanyLink';
import { readingViews, summaryDocument } from '@/content/reading-views';
import type { SiteLocale } from '@/content/site-locale';
import { StatTile } from '@/design-system';
import { ReadingActions } from './ReadingActions';
import { ReadingSection } from './ReadingSection';
import { ReadingShell } from './ReadingShell';

const sectionId = (key: string) => `summary-${key}`;
const NO_BREAK_SPACE = '\u00a0';

const keepLastWordsTogether = (text: string): string => {
  const split = text.lastIndexOf(' ');
  return split < 0 ? text : `${text.slice(0, split)}${NO_BREAK_SPACE}${text.slice(split + 1)}`;
};

export function SummaryPage({ locale }: { locale: SiteLocale }) {
  const { summary } = readingViews[locale];
  const doc = summaryDocument[locale];
  const cvPath = readingViews[locale].cv.path;
  return (
    <ReadingShell locale={locale} route={readingViews[locale].summary.path}>
      <section aria-labelledby={sectionId('who')}>
        <h1 id={sectionId('who')} className="reading-name">
          {doc.name}
        </h1>
        <p className="reading-role">{doc.tagline}</p>
        <p className="reading-meta">{doc.technologyLine}</p>
        <p className="reading-meta">
          <CompanyMention
            text={keepLastWordsTogether(doc.context)}
            company={doc.employer.name}
            href={doc.employer.url}
            locale={locale}
          />
        </p>
      </section>

      <section className="reading-stats mt-6" aria-label={summary.statsLabel}>
        {doc.stats.map((stat) => (
          <StatTile key={stat.label} value={stat.value} label={stat.label} variant="display" />
        ))}
      </section>

      <ReadingActions
        locale={locale}
        className="mt-6"
        secondary={{ href: cvPath, label: summary.cvLinkLabel }}
      />

      <div className="reading-split">
        <ReadingSection id={sectionId('projects')} heading={summary.headings.projects}>
          <ul className="reading-projects">
            {doc.projects.map((project) => (
              <li key={project.name} className="reading-project">
                <h3 className="reading-project-name">{project.name}</h3>
                <p className="reading-project-metric">
                  <span>{project.label}</span> <b>{project.value}</b>
                </p>
                <p className="reading-project-text">{project.description}</p>
              </li>
            ))}
          </ul>
        </ReadingSection>

        <div className="reading-side">
          <ReadingSection id={sectionId('stack')} heading={summary.headings.stack}>
            <ul className="reading-chips" aria-label={summary.stackLabels.core}>
              {summary.stack.core.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            <ul className="reading-chips reading-chips--ai" aria-label={summary.stackLabels.ai}>
              {summary.stack.ai.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </ReadingSection>

          <ReadingSection id={sectionId('contact')} heading={summary.headings.contact}>
            <p className="reading-actions-inline">
              <a href={`mailto:${doc.email}`}>{doc.email}</a>
            </p>
            <p className="reading-meta">{doc.languages}</p>
          </ReadingSection>
        </div>
      </div>
    </ReadingShell>
  );
}
