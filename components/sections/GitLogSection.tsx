import type { ReactNode } from 'react';
import { gitLog } from '@/content/git-log';
import type { GitCommit } from '@/content/schemas';
import { getIsMobileForRequest } from '@/lib/get-is-mobile-for-request';
import { IconGitLog } from '../Icons';
import { Module } from '../responsive/Module';

const COMMITS = gitLog;

function renderCommitMobile(c: GitCommit, key: string): ReactNode {
  const g = (s: string) => <span className="g-graph">{s}</span>;
  const pipe = g('|');
  const star = g('*');
  const hashShort = c.hash.slice(0, 7);
  // "Sat Mar 1 09:42:11 2025 +0100" → "Sat Mar 1 2025"
  const dp = c.date.split(' ');
  const dateShort = `${dp[0]} ${dp[1]} ${dp[2]} ${dp[4]}`;
  const [roleTitle, ...locParts] = c.role.split(' · ');
  const roleLocation = locParts.join(' · ');

  if (c.isRoot) {
    return (
      <span key={key}>
        {star} <span className="g-label">{'commit '}</span>
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
        {c.body.map((line, i) => (
          <span key={i}>
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
      {star} <span className="g-label">{'commit '}</span>
      <span className="g-hash">{hashShort}</span>
      {'\n'}
      {pipe} <span className="g-deco">{c.deco}</span>
      {'\n'}
      {pipe} <span className="g-label">{'Author:  '}</span>
      <span className="g-author">{'Erik Henrique Alves Cunha'}</span>
      {'\n'}
      {pipe}
      {'          '}
      <span className="g-author">{'<erik@erikunha.dev>'}</span>
      {'\n'}
      {pipe} <span className="g-label">{'AuthorDate:'}</span>{' '}
      <span className="g-date">{dateShort}</span>
      {'\n'}
      {pipe} <span className="g-label">{'Branch: '}</span>{' '}
      <span className="g-branch">{c.branch}</span>
      {'\n'}
      {pipe}
      {'\n'}
      {pipe}{' '}
      <span className="g-msg">
        {'feat('}
        {c.type}
        {'):'}
      </span>
      {'\n'}
      {pipe}
      {'   '}
      <span className="g-emp">{c.company}</span>
      {'\n'}
      {pipe}
      {'   '}
      <span className="g-date">{roleTitle}</span>
      {'\n'}
      {roleLocation && (
        <span>
          {pipe}
          {'   '}
          <span className="g-date" style={{ opacity: 0.65 }}>
            {roleLocation}
          </span>
          {'\n'}
        </span>
      )}
      {pipe}
      {'\n'}
      {c.body.map((line, i) => (
        <span key={i}>
          {pipe} <span className="g-body">{line}</span>
          {'\n'}
        </span>
      ))}
      {pipe}
      {'\n'}
    </span>
  );
}

function renderCommit(c: GitCommit, key: string): ReactNode {
  const g = (s: string) => <span className="g-graph">{s}</span>;
  const pipe = g('|');
  const star = g('*');

  if (c.isRoot) {
    return (
      <span key={key}>
        {star} <span className="g-label">commit</span> <span className="g-hash">{c.hash}</span>{' '}
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
        {c.body.map((line, i) => (
          <span key={i}>
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
      {star} <span className="g-label">commit</span> <span className="g-hash">{c.hash}</span>{' '}
      <span className="g-deco">{c.deco}</span>
      {'\n'}
      {pipe} <span className="g-label">Author: </span>{' '}
      <span className="g-author">{'Erik Henrique Alves Cunha <erik@erikunha.dev>'}</span>
      {'\n'}
      {pipe} <span className="g-label">AuthorDate:</span> <span className="g-date">{c.date}</span>
      {'\n'}
      {pipe} <span className="g-label">Branch: </span> <span className="g-branch">{c.branch}</span>
      {'\n'}
      {pipe}
      {'\n'}
      {pipe}
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
      {pipe}
      {'\n'}
      {c.body.map((line, i) => (
        <span key={i}>
          {pipe}
          {'     '}
          <span className="g-body">{line}</span>
          {'\n'}
        </span>
      ))}
      {pipe}
      {'\n'}
    </span>
  );
}

// Async RSC: renders only the matching viewport branch server-side.
// Same UA-detection pattern as Module.tsx — avoids shipping both the
// full `--pretty=fuller` desktop log and the compact mobile log when
// only one is visible at a time. 8 commits × ~15 spans each = ~120 nodes saved.
export async function GitLogSection({ defer }: { defer?: boolean } = {}) {
  const isMobile = await getIsMobileForRequest();

  return (
    <Module
      id="sec-git-log"
      header="GIT LOG ~/CAREER --PRETTY=FULLER --DECORATE --GRAPH"
      mobileHeader="GIT LOG --CAREER"
      icon={<IconGitLog />}
      defaultOpen={false}
      defer={defer}
    >
      {isMobile ? (
        <div className="gitfuller gitfuller--mobile career-mobile">
          <div className="gf-cmdbar">
            <span className="gf-prompt">erik@portfolio:~$</span>
            {' git log --career --graph'}
          </div>
          <pre>{COMMITS.map((c) => renderCommitMobile(c, `m-${c.hash}`))}</pre>
        </div>
      ) : (
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
      )}
    </Module>
  );
}
