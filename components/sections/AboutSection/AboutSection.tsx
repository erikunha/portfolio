import { CopyButton } from '@/app/design-system/_components/CopyButton';
import { IconReadme } from '@/components/Icons';
import { readmeCopy, retryCode, retryTokens } from '@/content/readme';
import { NowSection } from '../NowSection/NowSection';
import { NpmStackSection } from '../NpmStackSection/NpmStackSection';
import { ReadmeSection } from '../ReadmeSection/ReadmeSection';
import { ResponsibilitiesSection } from '../ResponsibilitiesSection/ResponsibilitiesSection';

export function AboutSection() {
  return (
    <section id="sec-about" tabIndex={-1} aria-labelledby="about-heading" className="about-section">
      <h2 id="about-heading" className="about-heading">
        <span>{readmeCopy.aboutTitle}</span> <IconReadme />
        <span className="about-heading-command">{readmeCopy.aboutCommand}</span>
      </h2>
      <div className="about-grid">
        <div className="about-column">
          <ReadmeSection panel />
          <NowSection panel />
          <ResponsibilitiesSection panel />
        </div>
        <div className="about-column">
          <NpmStackSection panel />
          <section className="about-panel" aria-labelledby="retry-heading">
            <header className="about-panel-header">
              <h3 id="retry-heading" className="about-retry-title">
                <span className="about-panel-marker" aria-hidden="true">
                  ▌
                </span>
                {retryCode.command}
              </h3>
              <a href={retryCode.repoHref} target="_blank" rel="noopener noreferrer">
                {retryCode.repoLabel}
              </a>
              <CopyButton text={retryCode.source} />
            </header>
            {/* biome-ignore lint/a11y/noNoninteractiveTabindex: Horizontal code scrolling requires keyboard focus on this named region. */}
            <section className="about-retry" aria-label={retryCode.regionLabel} tabIndex={0}>
              <pre>
                <code>
                  {retryTokens.map((token) => (
                    <span
                      key={token.offset}
                      className={token.kind ? `about-code-${token.kind}` : undefined}
                    >
                      {token.text}
                    </span>
                  ))}
                </code>
              </pre>
            </section>
          </section>
        </div>
      </div>
    </section>
  );
}
