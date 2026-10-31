import type { ReactNode } from 'react';
import { CopyButton } from '@/app/design-system/_components/CopyButton';
import { aboutContent as c } from '@/content/about';
import { responsibilities } from '@/content/responsibilities';
import { SCROLL_REGION_LABELS } from '@/content/section-labels';
import { RoleTyper } from '../../client/RoleTyper';
import { IconReadme } from '../../Icons';

function Panel({
  title,
  className,
  children,
  action,
}: {
  title: string;
  className?: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className={`ab-panel ${className ?? ''}`}>
      <header className="ab-ph">
        <span className="ab-mk" aria-hidden="true">
          {c.marker}
        </span>
        <h3 className="ab-h" data-type-reveal>
          {title}
        </h3>
        {action}
      </header>
      {children}
    </div>
  );
}

const FIRST_LINE_NUMBER = 1;
const lineNumbers = Array.from(
  { length: c.whoami.gutterLines },
  (_, index) => index + FIRST_LINE_NUMBER,
);

export function About() {
  return (
    <section id="sec-readme" tabIndex={-1} aria-labelledby="about-header" className="about-section">
      <header className="about-section-header">
        <h2 id="about-header">
          <span data-type-reveal>{c.title}</span>
          <IconReadme />
          <span className="about-section-command" aria-hidden="true">
            {c.command}
          </span>
        </h2>
      </header>
      <div className="module-body-content">
        <div className="about-grid">
          <div className="about-col">
            <Panel title={c.whoami.title}>
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
                    <RoleTyper className="ab-role font-bold" />
                    {c.whoami.statusSuffix}
                  </p>
                  {c.whoami.details.map((line) => (
                    <p key={line}>{line}</p>
                  ))}
                </div>
              </div>
            </Panel>
            <Panel title={c.now.title} className="ab-now">
              <dl className="ab-body">
                {c.now.rows.map((row) => (
                  <div key={row.k}>
                    <dt>{row.k}</dt>
                    <dd>{row.v}</dd>
                  </div>
                ))}
              </dl>
            </Panel>
            <Panel title={c.responsibilities.title} className="ab-resp">
              <section
                className="ab-body overflow-x-auto"
                aria-label={SCROLL_REGION_LABELS['sec-responsibilities']}
                // biome-ignore lint/a11y/noNoninteractiveTabindex: allow keyboard scrolling of responsibilities
                tabIndex={0}
              >
                <p className="ab-cmd">{c.responsibilities.command}</p>
                <pre data-no-copy="true">
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
            <Panel title={c.stack.title} className="ab-stack">
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
              title={c.code.title}
              className="ab-code"
              action={
                <>
                  <CopyButton
                    text={c.code.tokens.map((token) => token.text).join('')}
                    aria-label={c.code.copyAccessibleLabel}
                  />
                  <a
                    className="repo-link"
                    href={c.code.repoHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={c.code.repoAccessibleLabel}
                  >
                    {c.code.repoLabel}
                  </a>
                </>
              }
            >
              <section
                className="ab-code-scroll"
                aria-label={c.code.label}
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
