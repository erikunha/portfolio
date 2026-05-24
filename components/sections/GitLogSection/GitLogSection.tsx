import type { ReactNode } from 'react';
import { Suspense } from 'react';
import { gitLog } from '@/content/git-log';
import type { GitCommit } from '@/content/schemas';
import { getIsMobile } from '@/lib/ua';
import { IconGitLog } from '../../Icons';
import { Module } from '../../responsive/Module';
import styles from './GitLogSection.module.css';

const COMMITS = gitLog;

// Shared graph glyphs — hoisted to module scope so the desktop and mobile
// renderers don't each rebuild identical nodes per call. The two renderers
// stay separate: their layouts genuinely differ (mobile reformats the date
// and splits the role line).
const g = (s: string): ReactNode => <span className={styles.gGraph}>{s}</span>;
const PIPE = g('|');
const STAR = g('*');

function renderCommitMobile(c: GitCommit, key: string): ReactNode {
  const hashShort = c.hash.slice(0, 7);
  // "Sat Mar 1 09:42:11 2025 +0100" → "Sat Mar 1 2025"
  const dp = c.date.split(' ');
  const dateShort = `${dp[0]} ${dp[1]} ${dp[2]} ${dp[4]}`;
  const [roleTitle, ...locParts] = c.role.split(' · ');
  const roleLocation = locParts.join(' · ');

  if (c.isRoot) {
    return (
      <span key={key}>
        {STAR} <span className={styles.gLabel}>{'commit '}</span>
        <span className={styles.gHash}>{hashShort}</span>
        {'\n'}
        {'  '}
        <span className={styles.gDeco}>{c.deco}</span>
        {'\n'}
        {'  '}
        <span className={styles.gLabel}>{'Author:  '}</span>
        <span className={styles.gAuthor}>{'Erik Henrique Alves Cunha'}</span>
        {'\n'}
        {'           '}
        <span className={styles.gAuthor}>{'<erik@erikunha.dev>'}</span>
        {'\n'}
        {'  '}
        <span className={styles.gLabel}>{'AuthorDate:'}</span>{' '}
        <span className={styles.gDate}>{dateShort}</span>
        {'\n'}
        {'  '}
        <span className={styles.gLabel}>{'Branch: '}</span>{' '}
        <span className={styles.gBranch}>{c.branch}</span>
        {'\n'}
        {'\n'}
        {'      '}
        <span className={styles.gMsg}>
          {'feat('}
          {c.type}
          {'):'}
        </span>
        {'\n'}
        {'        '}
        <span className={styles.gEmp}>{c.company}</span>
        {'\n'}
        {'        '}
        <span className={styles.gDate}>{roleTitle}</span>
        {'\n'}
        {roleLocation && (
          <span>
            {'        '}
            <span className={styles.gDate} style={{ opacity: 0.65 }}>
              {roleLocation}
            </span>
            {'\n'}
          </span>
        )}
        {'\n'}
        {c.body.map((line) => (
          <span key={`${c.hash}-${line}`}>
            {'      '}
            <span className={styles.gBody}>{line}</span>
            {'\n'}
          </span>
        ))}
      </span>
    );
  }

  return (
    <span key={key}>
      {STAR} <span className={styles.gLabel}>{'commit '}</span>
      <span className={styles.gHash}>{hashShort}</span>
      {'\n'}
      {PIPE} <span className={styles.gDeco}>{c.deco}</span>
      {'\n'}
      {PIPE} <span className={styles.gLabel}>{'Author:  '}</span>
      <span className={styles.gAuthor}>{'Erik Henrique Alves Cunha'}</span>
      {'\n'}
      {PIPE}
      {'          '}
      <span className={styles.gAuthor}>{'<erik@erikunha.dev>'}</span>
      {'\n'}
      {PIPE} <span className={styles.gLabel}>{'AuthorDate:'}</span>{' '}
      <span className={styles.gDate}>{dateShort}</span>
      {'\n'}
      {PIPE} <span className={styles.gLabel}>{'Branch: '}</span>{' '}
      <span className={styles.gBranch}>{c.branch}</span>
      {'\n'}
      {PIPE}
      {'\n'}
      {PIPE}{' '}
      <span className={styles.gMsg}>
        {'feat('}
        {c.type}
        {'):'}
      </span>
      {'\n'}
      {PIPE}
      {'   '}
      <span className={styles.gEmp}>{c.company}</span>
      {'\n'}
      {PIPE}
      {'   '}
      <span className={styles.gDate}>{roleTitle}</span>
      {'\n'}
      {roleLocation && (
        <span>
          {PIPE}
          {'   '}
          <span className={styles.gDate} style={{ opacity: 0.65 }}>
            {roleLocation}
          </span>
          {'\n'}
        </span>
      )}
      {PIPE}
      {'\n'}
      {c.body.map((line) => (
        <span key={`${c.hash}-${line}`}>
          {PIPE} <span className={styles.gBody}>{line}</span>
          {'\n'}
        </span>
      ))}
      {PIPE}
      {'\n'}
    </span>
  );
}

function renderCommit(c: GitCommit, key: string): ReactNode {
  if (c.isRoot) {
    return (
      <span key={key}>
        {STAR} <span className={styles.gLabel}>commit</span>{' '}
        <span className={styles.gHash}>{c.hash}</span>{' '}
        <span className={styles.gDeco}>{c.deco}</span>
        {'\n'}
        {'  '}
        <span className={styles.gLabel}>Author: </span>{' '}
        <span className={styles.gAuthor}>{'Erik Henrique Alves Cunha <erik@erikunha.dev>'}</span>
        {'\n'}
        {'  '}
        <span className={styles.gLabel}>AuthorDate:</span>{' '}
        <span className={styles.gDate}>{c.date}</span>
        {'\n'}
        {'  '}
        <span className={styles.gLabel}>Branch: </span>{' '}
        <span className={styles.gBranch}>{c.branch}</span>
        {'\n'}
        {'\n'}
        {'      '}
        <span className={styles.gMsg}>
          {'feat('}
          {c.type}
          {'): '}
          <span className={styles.gEmp}>{c.company}</span>
          {' · '}
          {c.role}
        </span>
        {'\n'}
        {'\n'}
        {c.body.map((line) => (
          <span key={`${c.hash}-${line}`}>
            {'      '}
            <span className={styles.gBody}>{line}</span>
            {'\n'}
          </span>
        ))}
      </span>
    );
  }

  return (
    <span key={key}>
      {STAR} <span className={styles.gLabel}>commit</span>{' '}
      <span className={styles.gHash}>{c.hash}</span> <span className={styles.gDeco}>{c.deco}</span>
      {'\n'}
      {PIPE} <span className={styles.gLabel}>Author: </span>{' '}
      <span className={styles.gAuthor}>{'Erik Henrique Alves Cunha <erik@erikunha.dev>'}</span>
      {'\n'}
      {PIPE} <span className={styles.gLabel}>AuthorDate:</span>{' '}
      <span className={styles.gDate}>{c.date}</span>
      {'\n'}
      {PIPE} <span className={styles.gLabel}>Branch: </span>{' '}
      <span className={styles.gBranch}>{c.branch}</span>
      {'\n'}
      {PIPE}
      {'\n'}
      {PIPE}
      {'     '}
      <span className={styles.gMsg}>
        {'feat('}
        {c.type}
        {'): '}
        <span className={styles.gEmp}>{c.company}</span>
        {' · '}
        {c.role}
      </span>
      {'\n'}
      {PIPE}
      {'\n'}
      {c.body.map((line) => (
        <span key={`${c.hash}-${line}`}>
          {PIPE}
          {'     '}
          <span className={styles.gBody}>{line}</span>
          {'\n'}
        </span>
      ))}
      {PIPE}
      {'\n'}
    </span>
  );
}

function GitLogDesktop() {
  return (
    <div className={styles.root} data-testid="career-desktop">
      <div className={styles.cmdbar}>
        <span className={styles.prompt}>erik@portfolio:~$</span>
        {' git log --graph --pretty=fuller --decorate --since="2018-06-01" ~/career'}
      </div>
      <pre>{COMMITS.map((c) => renderCommit(c, c.hash))}</pre>
      <div className={styles.end}>
        {'(END) — press '}
        <span style={{ color: 'var(--ds-color-signal)' }}>q</span>
        {' to return to portfolio'}
      </div>
    </div>
  );
}

function GitLogMobile() {
  return (
    <div className={`${styles.root} ${styles.mobile}`} data-testid="career-mobile">
      <div className={styles.cmdbar}>
        <span className={styles.prompt}>erik@portfolio:~$</span>
        {' git log --career --graph'}
      </div>
      <pre>{COMMITS.map((c) => renderCommitMobile(c, `m-${c.hash}`))}</pre>
    </div>
  );
}

export async function GitLogContent() {
  const isMobile = await getIsMobile();
  return isMobile ? <GitLogMobile /> : <GitLogDesktop />;
}

export function GitLogSection({ defer }: { defer?: boolean } = {}) {
  return (
    <Module
      id="sec-git-log"
      header="GIT LOG ~/CAREER --PRETTY=FULLER --DECORATE --GRAPH"
      mobileHeader="GIT LOG --CAREER"
      icon={<IconGitLog />}
      defer={defer}
    >
      <Suspense fallback={<GitLogDesktop />}>
        <GitLogContent />
      </Suspense>
    </Module>
  );
}
