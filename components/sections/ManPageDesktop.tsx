import { manPage } from '@/content/man-page';
import styles from './ManPageSection.module.css';

// Desktop man-page: full pre with fixed-width columns. Plain RSC — CSS
// (`.desktop`) toggles visibility against the mobile variant.
export function ManPageDesktop() {
  return (
    <div className={`${styles.root} ${styles.desktop}`}>
      <pre>
        <span
          className={styles.mHead}
        >{`${manPage.name.toUpperCase()}(1)                    User Commands                    ${manPage.name.toUpperCase()}(1)`}</span>
        {'\n\n\n'}
        <span className={styles.mSec}>{'NAME'}</span>
        {'\n       '}
        <span className={styles.mErik}>{manPage.name}</span>
        {` — ${manPage.tagline}\n\n`}
        <span className={styles.mSec}>{'SYNOPSIS'}</span>
        {'\n       '}
        <span className={styles.mErik}>{manPage.name}</span>
        {' ['}
        <span className={styles.mDim}>{'--seniority'}</span>
        {' SENIOR|STAFF|PRINCIPAL]\n            ['}
        <span className={styles.mDim}>{'--track'}</span>
        {' IC|LEAD]\n            ['}
        <span className={styles.mDim}>{'--domain'}</span>
        {' FRONTEND|PAYMENTS|HEALTHCARE|AI-TOOLING]\n            ['}
        <span className={styles.mDim}>{'--region'}</span>
        {' WORLDWIDE] ['}
        <span className={styles.mDim}>{'--relocation'}</span>
        {']\n            ['}
        <span className={styles.mDim}>{'--contract'}</span>
        {'|'}
        <span className={styles.mDim}>{'--ft'}</span>
        {']\n            [<target-stack> ...]\n\n'}
        <span className={styles.mSec}>{'DESCRIPTION'}</span>
        {'\n       '}
        {manPage.description}
        {'\n\n'}
        <span className={styles.mSec}>{'OPTIONS'}</span>
        {'\n       '}
        <span className={styles.mDim}>{'--seniority'}</span>
        {'    Senior → Staff/Principal\n       '}
        <span className={styles.mDim}>{'--track'}</span>
        {'        Individual contributor or technical lead\n       '}
        <span className={styles.mDim}>{'--domain'}</span>
        {
          '       Strongest in regulated frontends (payments,\n                      healthcare, AI tooling); open to adjacent\n       '
        }
        <span className={styles.mDim}>{'--region'}</span>
        {'       Worldwide; remote-first\n       '}
        <span className={styles.mDim}>{'--relocation'}</span>
        {'   Open to relocating for the right role\n       '}
        <span className={styles.mDim}>{'--regulated'}</span>
        {'    Specialty: PCI-DSS, healthcare, banking\n       '}
        <span className={styles.mDim}>{'--contract'}</span>
        {'     Open to fixed-term or freelance\n       '}
        <span className={styles.mDim}>{'--ft'}</span>
        {'           Open to full-time\n       '}
        <span className={styles.mDim}>{'--hire'}</span>
        {'         Initiates handshake. See '}
        <span className={styles.mSec}>{'CONTACT'}</span>
        {'.\n\n'}
        <span className={styles.mSec}>{'EXAMPLES'}</span>
        {'\n       '}
        <span className={styles.mMute}>{'$'}</span>{' '}
        <span className={styles.mErik}>{manPage.name}</span>
        {' --seniority STAFF --domain FRONTEND --ft\n       '}
        <span className={styles.mMute}>{'$'}</span>{' '}
        <span className={styles.mErik}>{manPage.name}</span>
        {' --track LEAD --domain AI-TOOLING --stack "Angular, LLM, RAG" --ft\n       '}
        <span className={styles.mMute}>{'$'}</span>{' '}
        <span className={styles.mErik}>{manPage.name}</span>
        {' --seniority PRINCIPAL --track LEAD --region WORLDWIDE --relocation\n       '}
        <span className={styles.mMute}>{'$'}</span>{' '}
        <span className={styles.mErik}>{manPage.name}</span>
        {' --contract --regulated --stack "Angular, React, TypeScript"\n\n'}
        <span className={styles.mSec}>{'KNOWN BUGS'}</span>
        {`\n       - Occasionally rewrites a working component for clarity.
       - Will not stop talking about bundle size.
       - Sometimes ships the test before the feature.\n\n`}
        <span className={styles.mSec}>{'AUTHOR'}</span>
        {'\n       Written by Erik Henrique Alves Cunha.\n       Report bugs to: '}
        <span className={styles.mErik}>{'erikhenriquealvescunha@gmail.com'}</span>
        {'\n\n'}
        <span className={styles.mSec}>{'SEE ALSO'}</span>
        {'\n       cv(1), github(1), linkedin(1), calendar(1)\n\n\n'}
        <span
          className={styles.mHead}
        >{`${manPage.version}                       ${manPage.date}                       ${manPage.name.toUpperCase()}(1)`}</span>
      </pre>
    </div>
  );
}
