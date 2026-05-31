import type { ReactNode } from 'react';
import { Suspense } from 'react';
import { gitLog } from '@/content/git-log';
import type { GitCommit } from '@/content/schemas';
import { getIsMobile } from '@/lib/ua';
import { IconGitLog } from '../../Icons';
import { Module } from '../../responsive/Module';

const COMMITS = gitLog;

// Shared graph glyphs — hoisted to module scope so the desktop and mobile
// renderers don't each rebuild identical nodes per call. The two renderers
// stay separate: their layouts genuinely differ (mobile reformats the date
// and splits the role line).
const g = (s: string): ReactNode => <span className="text-signal">{s}</span>;
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
        {STAR} <span className="text-text-muted">{'commit '}</span>
        <span className="text-text-muted opacity-85">{hashShort}</span>
        {'\n'}
        {'  '}
        <span className="text-accent-warm">{c.deco}</span>
        {'\n'}
        {'  '}
        <span className="text-text-muted">{'Author:  '}</span>
        <span className="text-text-body opacity-85">{'Erik Henrique Alves Cunha'}</span>
        {'\n'}
        {'           '}
        <span className="text-text-body opacity-85">{'<erik@erikunha.dev>'}</span>
        {'\n'}
        {'  '}
        <span className="text-text-muted">{'AuthorDate:'}</span>{' '}
        <span className="text-text-body opacity-85">{dateShort}</span>
        {'\n'}
        {'  '}
        <span className="text-text-muted">{'Branch: '}</span>{' '}
        <span className="text-accent-cool">{c.branch}</span>
        {'\n'}
        {'\n'}
        {'      '}
        <span className="text-signal font-bold">
          {'feat('}
          {c.type}
          {'):'}
        </span>
        {'\n'}
        {'        '}
        <span className="text-signal font-bold">{c.company}</span>
        {'\n'}
        {'        '}
        <span className="text-text-body opacity-85">{roleTitle}</span>
        {'\n'}
        {roleLocation && (
          <span>
            {'        '}
            <span className="text-text-body opacity-85" style={{ opacity: 0.65 }}>
              {roleLocation}
            </span>
            {'\n'}
          </span>
        )}
        {'\n'}
        {c.body.map((line) => (
          <span key={`${c.hash}-${line}`}>
            {'      '}
            <span className="text-text-body">{line}</span>
            {'\n'}
          </span>
        ))}
      </span>
    );
  }

  return (
    <span key={key}>
      {STAR} <span className="text-text-muted">{'commit '}</span>
      <span className="text-text-muted opacity-85">{hashShort}</span>
      {'\n'}
      {PIPE} <span className="text-accent-warm">{c.deco}</span>
      {'\n'}
      {PIPE} <span className="text-text-muted">{'Author:  '}</span>
      <span className="text-text-body opacity-85">{'Erik Henrique Alves Cunha'}</span>
      {'\n'}
      {PIPE}
      {'          '}
      <span className="text-text-body opacity-85">{'<erik@erikunha.dev>'}</span>
      {'\n'}
      {PIPE} <span className="text-text-muted">{'AuthorDate:'}</span>{' '}
      <span className="text-text-body opacity-85">{dateShort}</span>
      {'\n'}
      {PIPE} <span className="text-text-muted">{'Branch: '}</span>{' '}
      <span className="text-accent-cool">{c.branch}</span>
      {'\n'}
      {PIPE}
      {'\n'}
      {PIPE}{' '}
      <span className="text-signal font-bold">
        {'feat('}
        {c.type}
        {'):'}
      </span>
      {'\n'}
      {PIPE}
      {'   '}
      <span className="text-signal font-bold">{c.company}</span>
      {'\n'}
      {PIPE}
      {'   '}
      <span className="text-text-body opacity-85">{roleTitle}</span>
      {'\n'}
      {roleLocation && (
        <span>
          {PIPE}
          {'   '}
          <span className="text-text-body opacity-85" style={{ opacity: 0.65 }}>
            {roleLocation}
          </span>
          {'\n'}
        </span>
      )}
      {PIPE}
      {'\n'}
      {c.body.map((line) => (
        <span key={`${c.hash}-${line}`}>
          {PIPE} <span className="text-text-body">{line}</span>
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
        {STAR} <span className="text-text-muted">commit</span>{' '}
        <span className="text-text-muted opacity-85">{c.hash}</span>{' '}
        <span className="text-accent-warm">{c.deco}</span>
        {'\n'}
        {'  '}
        <span className="text-text-muted">Author: </span>{' '}
        <span className="text-text-body opacity-85">
          {'Erik Henrique Alves Cunha <erik@erikunha.dev>'}
        </span>
        {'\n'}
        {'  '}
        <span className="text-text-muted">AuthorDate:</span>{' '}
        <span className="text-text-body opacity-85">{c.date}</span>
        {'\n'}
        {'  '}
        <span className="text-text-muted">Branch: </span>{' '}
        <span className="text-accent-cool">{c.branch}</span>
        {'\n'}
        {'\n'}
        {'      '}
        <span className="text-signal font-bold">
          {'feat('}
          {c.type}
          {'): '}
          <span className="text-signal font-bold">{c.company}</span>
          {' · '}
          {c.role}
        </span>
        {'\n'}
        {'\n'}
        {c.body.map((line) => (
          <span key={`${c.hash}-${line}`}>
            {'      '}
            <span className="text-text-body">{line}</span>
            {'\n'}
          </span>
        ))}
      </span>
    );
  }

  return (
    <span key={key}>
      {STAR} <span className="text-text-muted">commit</span>{' '}
      <span className="text-text-muted opacity-85">{c.hash}</span>{' '}
      <span className="text-accent-warm">{c.deco}</span>
      {'\n'}
      {PIPE} <span className="text-text-muted">Author: </span>{' '}
      <span className="text-text-body opacity-85">
        {'Erik Henrique Alves Cunha <erik@erikunha.dev>'}
      </span>
      {'\n'}
      {PIPE} <span className="text-text-muted">AuthorDate:</span>{' '}
      <span className="text-text-body opacity-85">{c.date}</span>
      {'\n'}
      {PIPE} <span className="text-text-muted">Branch: </span>{' '}
      <span className="text-accent-cool">{c.branch}</span>
      {'\n'}
      {PIPE}
      {'\n'}
      {PIPE}
      {'     '}
      <span className="text-signal font-bold">
        {'feat('}
        {c.type}
        {'): '}
        <span className="text-signal font-bold">{c.company}</span>
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
          <span className="text-text-body">{line}</span>
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
    <div className="font-mono text-sm leading-[1.55] overflow-x-auto" data-testid="career-desktop">
      <div className="text-text-muted opacity-70 mb-3 tracking-[0.02em] text-sm whitespace-pre">
        <span className="text-signal opacity-80 mr-1.5">erik@portfolio:~$</span>
        {' git log --graph --pretty=fuller --decorate --since="2018-06-01" ~/career'}
      </div>
      <pre className="m-0 whitespace-pre text-text-body">
        {COMMITS.map((c) => renderCommit(c, c.hash))}
      </pre>
      <div className="text-text-muted opacity-70 mt-[14px] text-sm tracking-[0.04em]">
        {'(END) — press '}
        <span style={{ color: 'var(--color-signal)' }}>q</span>
        {' to return to portfolio'}
      </div>
    </div>
  );
}

function GitLogMobile() {
  return (
    <div className="font-mono text-xs leading-[1.55] overflow-x-auto" data-testid="career-mobile">
      <div className="text-text-muted opacity-70 mb-3 tracking-[0.02em] text-xs whitespace-nowrap overflow-hidden text-ellipsis">
        <span className="text-signal opacity-80 mr-1.5">erik@portfolio:~$</span>
        {' git log --career --graph'}
      </div>
      <pre className="m-0 whitespace-pre-wrap break-words overflow-x-hidden text-text-body">
        {COMMITS.map((c) => renderCommitMobile(c, `m-${c.hash}`))}
      </pre>
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
