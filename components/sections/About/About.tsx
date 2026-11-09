import { ExternalLink } from '@/components/ExternalLink';
import { aboutContent } from '@/content/about';
import { responsibilities } from '@/content/responsibilities';
import { SCROLL_REGION_LABELS } from '@/content/section-labels';
import type { SiteLocale } from '@/content/site-locale';
import { Panel } from '@/design-system';
import { CompanyMention } from '../../CompanyLink';
import { RoleTyper } from '../../client/RoleTyper';
import { IconReadme } from '../../Icons';

const FIRST_LINE_NUMBER = 1;

export function About({ locale }: { locale: SiteLocale }) {
  const c = aboutContent[locale];
  const lineNumbers = Array.from(
    { length: c.whoami.gutterLines },
    (_, index) => index + FIRST_LINE_NUMBER,
  );
  return (
    <section id="sec-readme" tabIndex={-1} aria-labelledby="about-header" className="about-section">
      <header className="about-section-header">
        <h2 id="about-header">
          <span data-type-reveal suppressHydrationWarning>
            {c.title}
          </span>
          <IconReadme />
          <span className="about-section-command" aria-hidden="true">
            {c.command}
          </span>
        </h2>
      </header>
      <div className="module-body-content">
        <div className="about-grid">
          <div className="about-col">
            <Panel reveal title={c.whoami.title} marker={c.marker}>
              <div className="ab-body ab-text">
                <div className="ab-gutter" aria-hidden="true">
                  {lineNumbers.map((lineNumber) => (
                    <span key={lineNumber}>{lineNumber}</span>
                  ))}
                </div>
                <div className="ab-prose">
                  <p>{c.whoami.intro}</p>
                  <h4>{c.whoami.principlesTitle}</h4>
                  {c.whoami.principles.map((line) => (
                    <p key={line}>{line}</p>
                  ))}
                  <h4>{c.whoami.statusTitle}</h4>
                  <p>
                    {c.whoami.statusPrefix}
                    <RoleTyper role={c.whoami.role} className="ab-role font-bold" />
                    {c.whoami.statusSuffix}
                  </p>
                  {c.whoami.details.map((line) => (
                    <p key={line}>{line}</p>
                  ))}
                </div>
              </div>
            </Panel>
            <Panel reveal title={c.now.title} marker={c.marker} className="ab-now">
              <dl className="ab-body">
                {c.now.rows.map((row) => (
                  <div key={row.k}>
                    <dt>{row.k}</dt>
                    <dd>
                      {row.company ? (
                        <CompanyMention
                          text={row.v}
                          company={row.company.name}
                          href={row.company.url}
                          locale={locale}
                        />
                      ) : (
                        row.v
                      )}
                    </dd>
                  </div>
                ))}
              </dl>
            </Panel>
            <Panel reveal title={c.responsibilities.title} marker={c.marker} className="ab-resp">
              <section
                className="ab-body overflow-x-auto"
                aria-label={SCROLL_REGION_LABELS[locale]['sec-responsibilities']}
                // biome-ignore lint/a11y/noNoninteractiveTabindex: allow keyboard scrolling of responsibilities
                tabIndex={0}
              >
                <p className="ab-cmd">{c.responsibilities.command}</p>
                <pre>
                  {responsibilities.map((row) => (
                    <span key={row.name}>
                      <span className="ab-permissions">{row.perms}</span>
                      <span className="ab-user">{row.user}</span>
                      <span className="ab-group">{row.group}</span>
                      <span data-file="true" data-highlight={row.highlight || undefined}>
                        {row.name}
                      </span>
                    </span>
                  ))}
                </pre>
              </section>
            </Panel>
          </div>
          <div className="about-col">
            <Panel reveal title={c.stack.title} marker={c.marker} className="ab-stack">
              <dl className="ab-body">
                {c.stack.groups.map((group) => (
                  <div key={group.label}>
                    <dt>{group.label}</dt>
                    <dd>
                      <ul>
                        {group.items.map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    </dd>
                  </div>
                ))}
              </dl>
            </Panel>
            <Panel
              reveal
              title={c.code.title}
              marker={c.marker}
              className="ab-code"
              action={
                <ExternalLink className="repo-link" href={c.code.repoHref}>
                  {c.code.repoLabel} <span aria-hidden="true">{c.code.repoGlyph}</span>
                  <span className="sr-only"> {c.code.repoNewTabNote}</span>
                </ExternalLink>
              }
            >
              <section
                className="ab-code-scroll"
                aria-label={SCROLL_REGION_LABELS[locale]['sec-readme']}
                // biome-ignore lint/a11y/noNoninteractiveTabindex: the labelled code region is a deliberate tab stop so keyboard users can focus and select the sample
                tabIndex={0}
              >
                <pre className="ab-body">
                  {c.code.tokens.map((token) => (
                    <span key={token.id} className={token.className}>
                      {token.text}
                    </span>
                  ))}
                </pre>
              </section>
            </Panel>
          </div>
        </div>
      </div>
    </section>
  );
}
