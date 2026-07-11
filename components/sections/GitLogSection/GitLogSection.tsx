import type { ReactNode } from 'react';
import { Suspense } from 'react';
import { gitLog } from '@/content/git-log';
import type { GitCommit } from '@/content/schemas';
import { getIsMobile } from '@/lib/ua';
import { IconGitLog } from '../../Icons';
import { Module } from '../../responsive/Module';

const COMMITS = gitLog;

const g = (s: string): ReactNode => <span className="text-primary-500">{s}</span>;
const PIPE = g('|');
const STAR = g('*');

const RAIL = `*\n${'|\n'.repeat(48)}`;

function renderCommitMobile(c: GitCommit, key: string): ReactNode {
  const hashShort = c.hash.slice(0, 7);
  const dp = c.date.split(' ');
  const dateShort = `${dp[0]} ${dp[1]} ${dp[2]} ${dp[4]}`;
  return (
    <li key={key} className="relative pl-[1.7ch] pb-5 last:pb-0">
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 left-0 w-[1ch] overflow-hidden whitespace-pre text-primary-500 select-none"
      >
        {RAIL}
      </span>
      <div className="whitespace-pre-wrap break-words">
        <span className="text-primary-400">{'commit '}</span>
        <span className="text-primary-400 opacity-70">{hashShort}</span>
        {c.deco ? <span className="text-quinary-300">{` ${c.deco}`}</span> : null}
        {'\n'}
        <span className="text-primary-400 opacity-75">{dateShort}</span>
        <span className="text-primary-400 opacity-40">{' · '}</span>
        <span className="text-quaternary-400">{c.branch}</span>
        {'\n\n'}
        <span className="font-bold text-primary-500">{`feat(${c.type}): ${c.company}`}</span>
        {'\n'}
        <span className="text-tertiary-50 opacity-85">{c.role}</span>
        {'\n\n'}
        <span className="text-primary-400">{c.body.join(' ')}</span>
      </div>
    </li>
  );
}

function renderCommit(c: GitCommit, key: string): ReactNode {
  if (c.isRoot) {
    return (
      <span key={key}>
        {STAR} <span className="text-primary-400">commit</span>{' '}
        <span className="text-primary-400 opacity-85">{c.hash}</span>{' '}
        <span className="text-quinary-300">{c.deco}</span>
        {'\n'}
        {'  '}
        <span className="text-primary-400">Author: </span>{' '}
        <span className="text-tertiary-50 opacity-85">
          {'Erik Henrique Alves Cunha <erik@erikunha.dev>'}
        </span>
        {'\n'}
        {'  '}
        <span className="text-primary-400">AuthorDate:</span>{' '}
        <span className="text-tertiary-50 opacity-85">{c.date}</span>
        {'\n'}
        {'  '}
        <span className="text-primary-400">Branch: </span>{' '}
        <span className="text-quaternary-400">{c.branch}</span>
        {'\n'}
        {'\n'}
        {'      '}
        <span className="text-primary-500 font-bold">
          {'feat('}
          {c.type}
          {'): '}
          <span className="text-primary-500 font-bold">{c.company}</span>
          {' · '}
          {c.role}
        </span>
        {'\n'}
        {'\n'}
        {c.body.map((line) => (
          <span key={`${c.hash}-${line}`}>
            {'      '}
            <span className="text-primary-400">{line}</span>
            {'\n'}
          </span>
        ))}
      </span>
    );
  }

  return (
    <span key={key}>
      {STAR} <span className="text-primary-400">commit</span>{' '}
      <span className="text-primary-400 opacity-85">{c.hash}</span>{' '}
      <span className="text-quinary-300">{c.deco}</span>
      {'\n'}
      {PIPE} <span className="text-primary-400">Author: </span>{' '}
      <span className="text-tertiary-50 opacity-85">
        {'Erik Henrique Alves Cunha <erik@erikunha.dev>'}
      </span>
      {'\n'}
      {PIPE} <span className="text-primary-400">AuthorDate:</span>{' '}
      <span className="text-tertiary-50 opacity-85">{c.date}</span>
      {'\n'}
      {PIPE} <span className="text-primary-400">Branch: </span>{' '}
      <span className="text-quaternary-400">{c.branch}</span>
      {'\n'}
      {PIPE}
      {'\n'}
      {PIPE}
      {'     '}
      <span className="text-primary-500 font-bold">
        {'feat('}
        {c.type}
        {'): '}
        <span className="text-primary-500 font-bold">{c.company}</span>
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
          <span className="text-primary-400">{line}</span>
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
    <div
      className="font-mono text-sm max-md:text-[10px] leading-[1.55] overflow-x-auto"
      data-testid="career-desktop"
    >
      <div className="text-primary-400 opacity-70 mb-3 tracking-[0.02em] text-sm max-md:text-[10px] whitespace-pre">
        <span className="text-primary-500 opacity-80 mr-1.5">erik@portfolio:~$</span>
        {' git log --graph --pretty=fuller --decorate --since="2018-06-01" ~/career'}
      </div>
      <pre className="m-0 whitespace-pre text-tertiary-50">
        {COMMITS.map((c) => renderCommit(c, c.hash))}
      </pre>
      <div className="text-primary-400 opacity-70 mt-[14px] text-sm max-md:text-[10px] tracking-[0.04em]">
        {'(END) — press '}
        <span style={{ color: 'var(--color-primary-500)' }}>q</span>
        {' to return to portfolio'}
      </div>
    </div>
  );
}

function GitLogMobile() {
  return (
    <div className="font-mono text-[13px] leading-[1.5] break-words" data-testid="career-mobile">
      <div className="text-primary-400 opacity-70 mb-4 tracking-[0.02em] whitespace-nowrap overflow-hidden text-ellipsis">
        <span className="text-primary-500 opacity-80 mr-1.5">erik@portfolio:~$</span>
        {' git log --career --graph'}
      </div>
      <ul className="m-0 p-0 list-none text-tertiary-50">
        {COMMITS.map((c) => renderCommitMobile(c, `m-${c.hash}`))}
      </ul>
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
