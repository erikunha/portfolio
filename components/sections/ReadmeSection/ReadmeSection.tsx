import type { ReactNode } from 'react';
import { readmeCopy as c } from '@/content/readme';
import { RoleTyper } from '../../client/RoleTyper';
import { IconReadme } from '../../Icons';
import { Module } from '../../responsive/Module';
import styles from './ReadmeSection.module.css';

type ReadmeLine = { text?: string; node?: ReactNode; cls?: string; key: string };

const README_DESKTOP: ReadmeLine[] = [
  { text: c.desktopH1, cls: 'h1', key: c.desktopH1 },
  { text: c.desktopIntro, key: c.desktopIntro },
  { text: '## Core Stack', cls: 'h2', key: '## Core Stack' },
  ...c.desktopCoreStack.map((t) => ({ text: t, key: t })),
  { text: '## Operating Principles', cls: 'h2', key: '## Operating Principles' },
  ...c.desktopPrinciples.map((t) => ({ text: t, key: t })),
  { text: c.desktopStatusH2, cls: 'h2', key: c.desktopStatusH2 },
  {
    key: 'status-roletyper',
    node: (
      <>
        {'Open to '}
        <span className={styles.pillWrap}>
          <RoleTyper className={styles.pill} />
        </span>
        {' roles or impactful contract roles · remote-first · EU/US/CA · English C1.'}
      </>
    ),
  },
];

function ReadmeBlock({ lines }: { lines: ReadmeLine[] }) {
  return (
    <div className={styles.root}>
      <div className={styles.gutter} aria-hidden="true">
        {lines.map((line, i) => (
          <span key={line.key}>{i + 1}</span>
        ))}
      </div>
      <div className={styles.code}>
        {lines.map((line) => (
          <div
            key={line.key}
            className={
              line.cls === 'h1' ? styles.rowH1 : line.cls === 'h2' ? styles.rowH2 : styles.row
            }
          >
            {line.node ?? line.text}
          </div>
        ))}
      </div>
    </div>
  );
}

export function ReadmeSection() {
  return (
    <Module id="sec-readme" header="CAT README.MD" icon={<IconReadme />}>
      <ReadmeBlock lines={README_DESKTOP} />

      <div className={styles.codeSampleWrap}>
        <div className={styles.codeSample}>
          <div className={styles.codeSampleBar}>
            <span>{'$ cat src/lib/with-retry.ts'}</span>
            <a href="https://github.com/erikunha" target="_blank" rel="noopener noreferrer">
              {'// view full repo →'}
            </a>
          </div>
          <pre className={styles.codeSamplePre}>
            <span className={styles.tkC}>
              {'// retry an RxJS stream with exponential backoff + jitter — used in'}
            </span>
            {'\n'}
            <span className={styles.tkC}>
              {"// the cashier's deposit polling loop. signals abort on permanent 4xx."}
            </span>
            {'\n'}
            <span className={styles.tkK}>{'export function'}</span>{' '}
            <span className={styles.tkF}>{'withRetry'}</span>
            <span className={styles.tkP}>{'<'}</span>
            <span className={styles.tkT}>{'T'}</span>
            <span className={styles.tkP}>{'>'}</span>
            <span className={styles.tkP}>{'('}</span>
            {'\n'}
            {'  '}
            <span className={styles.tkP}>{'{ max = '}</span>
            <span className={styles.tkT}>{'5'}</span>
            <span className={styles.tkP}>{', base = '}</span>
            <span className={styles.tkT}>{'300'}</span>
            <span className={styles.tkP}>{', isFatal }: '}</span>
            <span className={styles.tkT}>{'RetryOpts'}</span>
            <span className={styles.tkP}>{','}</span>
            {'\n'}
            <span className={styles.tkP}>{'): '}</span>
            <span className={styles.tkT}>{'MonoTypeOperatorFunction'}</span>
            <span className={styles.tkP}>{'<'}</span>
            <span className={styles.tkT}>{'T'}</span>
            <span className={styles.tkP}>{'> {'}</span>
            {'\n'}
            {'  '}
            <span className={styles.tkK}>{'return'}</span>{' '}
            <span className={styles.tkF}>{'retry'}</span>
            <span className={styles.tkP}>{'({'}</span>
            {'\n'}
            {'    count'}
            <span className={styles.tkP}>{':'}</span>
            {' max'}
            <span className={styles.tkP}>{','}</span>
            {'\n'}
            {'    delay'}
            <span className={styles.tkP}>{': (err, attempt) => {'}</span>
            {'\n'}
            {'      '}
            <span className={styles.tkK}>{'if'}</span> <span className={styles.tkP}>{'('}</span>
            <span className={styles.tkF}>{'isFatal'}</span>
            <span className={styles.tkP}>{'?.(err)) '}</span>
            <span className={styles.tkK}>{'throw'}</span>
            {' err'}
            <span className={styles.tkP}>{';'}</span>
            {'\n'}
            {'      '}
            <span className={styles.tkK}>{'const'}</span>
            {' wait '}
            <span className={styles.tkP}>{'='}</span>
            {' base '}
            <span className={styles.tkP}>{'* '}</span>
            <span className={styles.tkT}>{'2'}</span>
            <span className={styles.tkP}>{'**'}</span>
            {'attempt '}
            <span className={styles.tkP}>{'+ '}</span>
            <span className={styles.tkF}>{'Math.random'}</span>
            <span className={styles.tkP}>{'() * '}</span>
            {'base'}
            <span className={styles.tkP}>{';'}</span>
            {'\n'}
            {'      '}
            <span className={styles.tkK}>{'return'}</span>{' '}
            <span className={styles.tkF}>{'timer'}</span>
            <span className={styles.tkP}>{'(wait);'}</span>
            {'\n'}
            {'    '}
            <span className={styles.tkP}>{'}'}</span>
            <span className={styles.tkP}>{','}</span>
            {'\n'}
            {'  '}
            <span className={styles.tkP}>{'});'}</span>
            {'\n'}
            <span className={styles.tkP}>{'}'}</span>
          </pre>
        </div>
      </div>
    </Module>
  );
}
