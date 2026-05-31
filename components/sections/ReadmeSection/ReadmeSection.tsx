import type { ReactNode } from 'react';
import { readmeCopy as c } from '@/content/readme';
import { RoleTyper } from '../../client/RoleTyper';
import { IconReadme } from '../../Icons';
import { Module } from '../../responsive/Module';

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
        {/* min-width reserves longest role label ([Principal] = 11 chars) to prevent
            text reflow as roles cycle. Update if ROLES array in RoleTyper.tsx changes. */}
        <span className="inline-block min-w-[9em]">
          <RoleTyper className="bg-primary-500 text-secondary-950 px-1.5 py-px font-bold tracking-[0.04em]" />
        </span>
        {' roles or impactful contract roles · remote-first · EU/US/CA · English C1.'}
      </>
    ),
  },
];

function ReadmeBlock({ lines }: { lines: ReadmeLine[] }) {
  return (
    <div className="grid grid-cols-[44px_1fr] font-mono text-sm leading-[1.85] text-tertiary-50 max-[768px]:grid-cols-[28px_1fr] max-[768px]:text-xs">
      <div
        className="text-primary-300 text-right pr-4 border-r border-primary-quiet select-none"
        aria-hidden="true"
      >
        {lines.map((line, i) => (
          <span key={line.key} className="block">
            {i + 1}
          </span>
        ))}
      </div>
      <div className="pl-4">
        {lines.map((line) => (
          <div
            key={line.key}
            className={
              line.cls === 'h1'
                ? 'text-primary-500 font-bold text-2xl leading-[1.4]'
                : line.cls === 'h2'
                  ? 'text-primary-500 font-bold text-sm mt-1 max-[768px]:text-sm'
                  : 'leading-[1.85]'
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

      {/* Hidden on mobile (max-[768px]:hidden) */}
      <div className="max-[768px]:hidden">
        <div className="mt-[22px] border-t border-dashed border-primary-quiet pt-[18px]">
          <div className="flex justify-between items-center text-primary-400 text-xs tracking-[0.14em] mb-2.5 font-mono">
            <span>{'$ cat src/lib/with-retry.ts'}</span>
            <a
              href="https://github.com/erikunha"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary-500 no-underline"
            >
              {'// view full repo →'}
            </a>
          </div>
          <pre className="m-0 font-mono text-sm leading-[1.7] text-tertiary-50 overflow-x-auto px-4 py-[14px] bg-glow-03 border border-primary-quiet whitespace-pre">
            <span className="text-primary-400 italic">
              {'// retry an RxJS stream with exponential backoff + jitter — used in'}
            </span>
            {'\n'}
            <span className="text-primary-400 italic">
              {"// the cashier's deposit polling loop. signals abort on permanent 4xx."}
            </span>
            {'\n'}
            <span className="text-primary-500 font-bold">{'export function'}</span>{' '}
            <span className="text-quaternary-400">{'withRetry'}</span>
            <span className="text-tertiary-50 opacity-85">{'<'}</span>
            <span className="text-quinary-300">{'T'}</span>
            <span className="text-tertiary-50 opacity-85">{'>'}</span>
            <span className="text-tertiary-50 opacity-85">{'('}</span>
            {'\n'}
            {'  '}
            <span className="text-tertiary-50 opacity-85">{'{ max = '}</span>
            <span className="text-quinary-300">{'5'}</span>
            <span className="text-tertiary-50 opacity-85">{', base = '}</span>
            <span className="text-quinary-300">{'300'}</span>
            <span className="text-tertiary-50 opacity-85">{', isFatal }: '}</span>
            <span className="text-quinary-300">{'RetryOpts'}</span>
            <span className="text-tertiary-50 opacity-85">{','}</span>
            {'\n'}
            <span className="text-tertiary-50 opacity-85">{'): '}</span>
            <span className="text-quinary-300">{'MonoTypeOperatorFunction'}</span>
            <span className="text-tertiary-50 opacity-85">{'<'}</span>
            <span className="text-quinary-300">{'T'}</span>
            <span className="text-tertiary-50 opacity-85">{'> {'}</span>
            {'\n'}
            {'  '}
            <span className="text-primary-500 font-bold">{'return'}</span>{' '}
            <span className="text-quaternary-400">{'retry'}</span>
            <span className="text-tertiary-50 opacity-85">{'({'}</span>
            {'\n'}
            {'    count'}
            <span className="text-tertiary-50 opacity-85">{':'}</span>
            {' max'}
            <span className="text-tertiary-50 opacity-85">{','}</span>
            {'\n'}
            {'    delay'}
            <span className="text-tertiary-50 opacity-85">{': (err, attempt) => {'}</span>
            {'\n'}
            {'      '}
            <span className="text-primary-500 font-bold">{'if'}</span>{' '}
            <span className="text-tertiary-50 opacity-85">{'('}</span>
            <span className="text-quaternary-400">{'isFatal'}</span>
            <span className="text-tertiary-50 opacity-85">{'?.(err)) '}</span>
            <span className="text-primary-500 font-bold">{'throw'}</span>
            {' err'}
            <span className="text-tertiary-50 opacity-85">{';'}</span>
            {'\n'}
            {'      '}
            <span className="text-primary-500 font-bold">{'const'}</span>
            {' wait '}
            <span className="text-tertiary-50 opacity-85">{'='}</span>
            {' base '}
            <span className="text-tertiary-50 opacity-85">{'* '}</span>
            <span className="text-quinary-300">{'2'}</span>
            <span className="text-tertiary-50 opacity-85">{'**'}</span>
            {'attempt '}
            <span className="text-tertiary-50 opacity-85">{'+ '}</span>
            <span className="text-quaternary-400">{'Math.random'}</span>
            <span className="text-tertiary-50 opacity-85">{'() * '}</span>
            {'base'}
            <span className="text-tertiary-50 opacity-85">{';'}</span>
            {'\n'}
            {'      '}
            <span className="text-primary-500 font-bold">{'return'}</span>{' '}
            <span className="text-quaternary-400">{'timer'}</span>
            <span className="text-tertiary-50 opacity-85">{'(wait);'}</span>
            {'\n'}
            {'    '}
            <span className="text-tertiary-50 opacity-85">{'}'}</span>
            <span className="text-tertiary-50 opacity-85">{','}</span>
            {'\n'}
            {'  '}
            <span className="text-tertiary-50 opacity-85">{'});'}</span>
            {'\n'}
            <span className="text-tertiary-50 opacity-85">{'}'}</span>
          </pre>
        </div>
      </div>
    </Module>
  );
}
