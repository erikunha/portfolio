import type { ReactNode } from 'react';
import { IconReadme } from '../Icons';
import { Module } from '../responsive/Module';

type ReadmeLine = { text?: string; node?: ReactNode; cls?: string };

const README_DESKTOP: ReadmeLine[] = [
  { text: '# Erik Henrique Alves Cunha — Senior Software Engineer', cls: 'h1' },
  { text: '8+ years building frontend systems for regulated, high-traffic platforms in fintech (PCI-DSS), healthcare, and global e-commerce.' },
  { text: '## Core Stack', cls: 'h2' },
  { text: '- Angular · React · Next.js · TypeScript · Node.js · RxJS · NgRx' },
  { text: '- Micro-frontends · Nx monorepos · Clean Architecture · Web Components' },
  { text: '## Operating Principles', cls: 'h2' },
  { text: '- Performance-first: LCP, TBT, bundle reduction in production budgets.' },
  { text: '- A11y & compliance: WCAG 2.1 AA, ARIA, PCI-DSS-grade safeguards.' },
  { text: '## Current Status', cls: 'h2' },
  {
    node: (
      <>{'Open to '}<span className="pill">{'[Senior / Staff / Principal]'}</span>{' roles or high-stakes contracts · remote-first · EU/US/CA · English C1.'}</>
    ),
  },
];

const README_MOBILE: ReadmeLine[] = [
  { text: '# erik cunha', cls: 'h2' },
  { text: ' ' },
  { text: 'senior frontend engineer.' },
  {
    node: (
      <>{'currently shipping the '}<span className="pill">{'betsson'}</span>{' cashier — 40M+ tx/yr,'}</>
    ),
  },
  { text: '€1B+ annual revenue, PCI-DSS, micro-frontends.' },
  { text: ' ' },
  { text: '## what i do', cls: 'h1' },
  { text: "build regulated, high-traffic frontends that don't break" },
  { text: 'when finance / health / commerce regulators show up.' },
];

function ReadmeBlock({ lines }: { lines: ReadmeLine[] }) {
  return (
    <div className="readme">
      <div className="readme__gutter" aria-hidden="true">
        {lines.map((_, i) => (
          <span key={i}>{i + 1}</span>
        ))}
      </div>
      <div className="readme__code">
        {lines.map((line, i) => (
          <div key={i} className={line.cls ? `readme__row readme__row--${line.cls}` : 'readme__row'}>
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
      <div className="readme--desktop">
        <ReadmeBlock lines={README_DESKTOP} />
      </div>
      <div className="readme--mobile">
        <ReadmeBlock lines={README_MOBILE} />
      </div>

      <div className="readme-codesample">
      <div className="codesample">
        <div className="codesample__bar">
          <span>{'$ cat src/lib/with-retry.ts'}</span>
          <a href="https://github.com/erikunha" target="_blank" rel="noopener noreferrer">
            {'// view full repo →'}
          </a>
        </div>
        <pre className="codesample__pre">
          <span className="tk-c">{'// retry an RxJS stream with exponential backoff + jitter — used in'}</span>{'\n'}
          <span className="tk-c">{"// the cashier's deposit polling loop. signals abort on permanent 4xx."}</span>{'\n'}
          <span className="tk-k">{'export function'}</span>{' '}
          <span className="tk-f">{'withRetry'}</span>
          <span className="tk-p">{'<'}</span>
          <span className="tk-t">{'T'}</span>
          <span className="tk-p">{'>'}</span>
          <span className="tk-p">{'('}</span>{'\n'}
          {'  '}
          <span className="tk-p">{'{ max = '}</span>
          <span className="tk-t">{'5'}</span>
          <span className="tk-p">{', base = '}</span>
          <span className="tk-t">{'300'}</span>
          <span className="tk-p">{', isFatal }: '}</span>
          <span className="tk-t">{'RetryOpts'}</span>
          <span className="tk-p">{','}</span>{'\n'}
          <span className="tk-p">{'): '}</span>
          <span className="tk-t">{'MonoTypeOperatorFunction'}</span>
          <span className="tk-p">{'<'}</span>
          <span className="tk-t">{'T'}</span>
          <span className="tk-p">{'> {'}</span>{'\n'}
          {'  '}
          <span className="tk-k">{'return'}</span>{' '}
          <span className="tk-f">{'retry'}</span>
          <span className="tk-p">{'({'}</span>{'\n'}
          {'    count'}
          <span className="tk-p">{':'}</span>
          {' max'}
          <span className="tk-p">{','}</span>{'\n'}
          {'    delay'}
          <span className="tk-p">{': (err, attempt) => {'}</span>{'\n'}
          {'      '}
          <span className="tk-k">{'if'}</span>
          {' '}
          <span className="tk-p">{'('}</span>
          <span className="tk-f">{'isFatal'}</span>
          <span className="tk-p">{'?.(err)) '}</span>
          <span className="tk-k">{'throw'}</span>
          {' err'}
          <span className="tk-p">{';'}</span>{'\n'}
          {'      '}
          <span className="tk-k">{'const'}</span>
          {' wait '}
          <span className="tk-p">{'='}</span>
          {' base '}
          <span className="tk-p">{'* '}</span>
          <span className="tk-t">{'2'}</span>
          <span className="tk-p">{'**'}</span>
          {'attempt '}
          <span className="tk-p">{'+ '}</span>
          <span className="tk-f">{'Math.random'}</span>
          <span className="tk-p">{'() * '}</span>
          {'base'}
          <span className="tk-p">{';'}</span>{'\n'}
          {'      '}
          <span className="tk-k">{'return'}</span>
          {' '}
          <span className="tk-f">{'timer'}</span>
          <span className="tk-p">{'(wait);'}</span>{'\n'}
          {'    '}
          <span className="tk-p">{'}'}</span>
          <span className="tk-p">{','}</span>{'\n'}
          {'  '}
          <span className="tk-p">{'});'}</span>{'\n'}
          <span className="tk-p">{'}'}</span>
        </pre>
      </div>
      </div>
    </Module>
  );
}
