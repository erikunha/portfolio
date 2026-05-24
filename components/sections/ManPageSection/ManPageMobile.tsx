import { manPage } from '@/content/man-page';
import styles from './ManPageSection.module.css';

// Mobile man-page: semantic layout — avoids pre-wrap column fighting. Plain
// RSC — rendered when ManPageContent detects a mobile UA via getIsMobile().
export function ManPageMobile() {
  return (
    <div className={styles.mobile} data-testid="manpage-mobile">
      <span className={styles.mpHead}>{`${manPage.name.toUpperCase()}(1) - User Commands`}</span>

      <span className={styles.mpSec}>NAME</span>
      <span className={styles.mpBody}>
        <span className={styles.mpName}>{manPage.name}</span>
        {` — ${manPage.tagline}`}
      </span>

      <span className={styles.mpSec}>DESCRIPTION</span>
      <span className={styles.mpBody}>{manPage.description}</span>

      <span className={styles.mpSec}>OPTIONS</span>
      <div className={styles.mpOpts}>
        {manPage.options.flatMap((opt) => [
          <span key={`f-${opt.flag}`} className={styles.mpFlag}>
            {opt.flag}
          </span>,
          <span key={`d-${opt.flag}`} className={styles.mpDesc}>
            {opt.desc}
          </span>,
        ])}
      </div>

      <span className={styles.mpSec}>EXAMPLES</span>
      <div className={styles.mpExamples}>
        <span className={styles.mpExLine}>
          <span className={styles.mpMute}>$</span>{' '}
          <span className={styles.mpName}>{manPage.name}</span>
          {' --seniority STAFF --domain FRONTEND --ft'}
        </span>
        <span className={styles.mpExLine}>
          <span className={styles.mpMute}>$</span>{' '}
          <span className={styles.mpName}>{manPage.name}</span>
          {
            ' --track LEAD --domain AI-TOOLING --stack "LLMs, RAG, AI Agents, Harness, and GenAI with Spec-Driven flow" --ft'
          }
        </span>
        <span className={styles.mpExLine}>
          <span className={styles.mpMute}>$</span>{' '}
          <span className={styles.mpName}>{manPage.name}</span>
          {' --seniority PRINCIPAL --track LEAD --region WORLDWIDE --relocation'}
        </span>
      </div>

      <span className={styles.mpSec}>KNOWN BUGS</span>
      <span className={styles.mpBugs}>{manPage.knownBugs.map((b) => `- ${b}`).join('\n')}</span>

      <span className={styles.mpSec}>AUTHOR</span>
      <span className={styles.mpBody}>{'Written by Erik Henrique Alves Cunha.'}</span>
    </div>
  );
}
