import type { ReactNode } from 'react';
import { Suspense } from 'react';
import { gitLog } from '@/content/git-log';
import type { GitCommit } from '@/content/schemas';
import { getIsMobile } from '@/lib/ua';
import { IconGitLog } from '../Icons';
import { Module } from '../responsive/Module';

const COMMITS = gitLog;

// Shared graph glyphs — hoisted to module scope so the desktop and mobile
// renderers don't each rebuild identical nodes per call. The two renderers
// stay separate: their layouts genuinely differ (mobile reformats the date
// and splits the role line).
const g = (s: string): ReactNode => <span className="g-graph">{s}</span>;
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
        {STAR} <span className="g-label">{'commit '}</span>
        <span className="g-hash">{hashShort}</span>
        {'\n'}
        {'  '}
        <span className="g-deco">{c.deco}</span>
        {'\n'}
        {'  '}
        <span className="g-label">{'Author:  '}</span>
        <span className="g-author">{'Erik Henrique Alves Cunha'}</span>
        {'\n'}
        {'           '}
        <span className="g-author">{'<erik@erikunha.dev>'}</span>
        {'\n'}
        {'  '}
        <span className="g-label">{'AuthorDate:'}</span> <span className="g-date">{dateShort}</span>
        {'\n'}
        {'  '}
        <span className="g-label">{'Branch: '}</span> <span className="g-branch">{c.branch}</span>
        {'\n'}
        {'\n'}
        {'      '}
        <span className="g-msg">
          {'feat('}
          {c.type}
          {'):'}
        </span>
        {'\n'}
        {'        '}
        <span className="g-emp">{c.company}</span>
        {'\n'}
        {'        '}
        <span className="g-date">{roleTitle}</span>
        {'\n'}
        {roleLocation && (
          <span>
            {'        '}
            <span className="g-date" style={{ opacity: 0.65 }}>
              {roleLocation}
            </span>
            {'\n'}
          </span>
        )}
        {'\n'}
        {c.body.map((line) => (
          <span key={`${c.hash}-${line}`}>
            {'      '}
            <span className="g-body">{line}</span>
            {'\n'}
          </span>
        ))}
      </span>
    );
  }

  return (
    <span key={key}>
      {STAR} <span className="g-label">{'commit '}</span>
      <span className="g-hash">{hashShort}</span>
      {'\n'}
      {PIPE} <span className="g-deco">{c.deco}</span>
      {'\n'}
      {PIPE} <span className="g-label">{'Author:  '}</span>
      <span className="g-author">{'Erik Henrique Alves Cunha'}</span>
      {'\n'}
      {PIPE}
      {'          '}
      <span className="g-author">{'<erik@erikunha.dev>'}</span>
      {'\n'}
      {PIPE} <span className="g-label">{'AuthorDate:'}</span>{' '}
      <span className="g-date">{dateShort}</span>
      {'\n'}
      {PIPE} <span className="g-label">{'Branch: '}</span>{' '}
      <span className="g-branch">{c.branch}</span>
      {'\n'}
      {PIPE}
      {'\n'}
      {PIPE}{' '}
      <span className="g-msg">
        {'feat('}
        {c.type}
        {'):'}
      </span>
      {'\n'}
      {PIPE}
      {'   '}
      <span className="g-emp">{c.company}</span>
      {'\n'}
      {PIPE}
      {'   '}
      <span className="g-date">{roleTitle}</span>
      {'\n'}
      {roleLocation && (
        <span>
          {PIPE}
          {'   '}
          <span className="g-date" style={{ opacity: 0.65 }}>
            {roleLocation}
          </span>
          {'\n'}
        </span>
      )}
      {PIPE}
      {'\n'}
      {c.body.map((line) => (
        <span key={`${c.hash}-${line}`}>
          {PIPE} <span className="g-body">{line}</span>
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
        {STAR} <span className="g-label">commit</span> <span className="g-hash">{c.hash}</span>{' '}
        <span className="g-deco">{c.deco}</span>
        {'\n'}
        {'  '}
        <span className="g-label">Author: </span>{' '}
        <span className="g-author">{'Erik Henrique Alves Cunha <erik@erikunha.dev>'}</span>
        {'\n'}
        {'  '}
        <span className="g-label">AuthorDate:</span> <span className="g-date">{c.date}</span>
        {'\n'}
        {'  '}
        <span className="g-label">Branch: </span> <span className="g-branch">{c.branch}</span>
        {'\n'}
        {'\n'}
        {'      '}
        <span className="g-msg">
          {'feat('}
          {c.type}
          {'): '}
          <span className="g-emp">{c.company}</span>
          {' · '}
          {c.role}
        </span>
        {'\n'}
        {'\n'}
        {c.body.map((line) => (
          <span key={`${c.hash}-${line}`}>
            {'      '}
            <span className="g-body">{line}</span>
            {'\n'}
          </span>
        ))}
      </span>
    );
  }

  return (
    <span key={key}>
      {STAR} <span className="g-label">commit</span> <span className="g-hash">{c.hash}</span>{' '}
      <span className="g-deco">{c.deco}</span>
      {'\n'}
      {PIPE} <span className="g-label">Author: </span>{' '}
      <span className="g-author">{'Erik Henrique Alves Cunha <erik@erikunha.dev>'}</span>
      {'\n'}
      {PIPE} <span className="g-label">AuthorDate:</span> <span className="g-date">{c.date}</span>
      {'\n'}
      {PIPE} <span className="g-label">Branch: </span> <span className="g-branch">{c.branch}</span>
      {'\n'}
      {PIPE}
      {'\n'}
      {PIPE}
      {'     '}
      <span className="g-msg">
        {'feat('}
        {c.type}
        {'): '}
        <span className="g-emp">{c.company}</span>
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
          <span className="g-body">{line}</span>
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
    <div className="gitfuller career-desktop">
      <div className="gf-cmdbar">
        <span className="gf-prompt">erik@portfolio:~$</span>
        {' git log --graph --pretty=fuller --decorate --since="2018-06-01" ~/career'}
      </div>
      <pre>{COMMITS.map((c) => renderCommit(c, c.hash))}</pre>
      <div className="gf-end">
        {'(END) — press '}
        <span style={{ color: 'var(--signal)' }}>q</span>
        {' to return to portfolio'}
      </div>
    </div>
  );
}

function GitLogMobile() {
  return (
    <div className="gitfuller gitfuller--mobile career-mobile">
      <div className="gf-cmdbar">
        <span className="gf-prompt">erik@portfolio:~$</span>
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
