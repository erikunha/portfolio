import type { ReactNode } from 'react';
import { gitLog } from '@/content/git-log';
import type { GitCommit } from '@/content/schemas';
import { IconGitLog } from '../Icons';
import { Module } from '../responsive/Module';

const COMMITS = gitLog;

function formatDateShort(date: string): string {
  const parts = date.split(' ');
  return `${parts[1] ?? ''} ${parts[4] ?? ''}`;
}

function renderCommitMobile(c: GitCommit, key: string): ReactNode {
  const g = (s: string) => <span className="g-graph">{s}</span>;
  const pipe = g('|');
  const star = g('*');
  const hashShort = c.hash.slice(0, 8);

  if (c.isRoot) {
    return (
      <span key={key}>
        {star} <span className="g-label">commit</span> <span className="g-hash">{hashShort}</span>{' '}
        <span className="g-deco">{c.deco}</span>
        {'\n'}
        {'  '}
        <span className="g-label">{'Date:  '}</span>{' '}
        <span className="g-date">{formatDateShort(c.date)}</span>
        {'\n'}
        {'  '}
        <span className="g-label">{'Branch:'}</span> <span className="g-branch">{c.branch}</span>
        {'\n'}
        {'\n'}
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
        {'\n'}
        {c.body.map((line, i) => (
          <span key={i}>
            {'     '}
            <span className="g-body">{line}</span>
            {'\n'}
          </span>
        ))}
      </span>
    );
  }

  return (
    <span key={key}>
      {star} <span className="g-label">commit</span> <span className="g-hash">{hashShort}</span>{' '}
      <span className="g-deco">{c.deco}</span>
      {'\n'}
      {pipe} <span className="g-label">{'Date:  '}</span>{' '}
      <span className="g-date">{formatDateShort(c.date)}</span>
      {'\n'}
      {pipe} <span className="g-label">{'Branch:'}</span>{' '}
      <span className="g-branch">{c.branch}</span>
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

export function GitLogSection() {
  return (
    <Module
      id="sec-git-log"
      header="GIT LOG ~/CAREER --PRETTY=FULLER --DECORATE --GRAPH"
      mobileHeader="GIT LOG --CAREER"
      icon={<IconGitLog />}
      defaultOpen={false}
    >
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
      <div className="gitfuller gitfuller--mobile career-mobile">
        <div className="gf-cmdbar">
          <span className="gf-prompt">erik@portfolio:~$</span>
          {' git log --pretty=fuller --since="2018-06-01"'}
        </div>
        <pre>{COMMITS.map((c) => renderCommitMobile(c, `m-${c.hash}`))}</pre>
      </div>
    </Module>
  );
}
