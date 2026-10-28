import { profile } from './profile';
import { AboutContentSchema } from './schemas';
import { social } from './social';

export const aboutContent = AboutContentSchema.parse({
  title: 'About',
  command: 'CAT README.MD',
  marker: '▌',
  whoami: {
    title: '# Whoami',
    intro:
      '8+ years building production web software for regulated, high-traffic platforms: private-markets fintech, PCI-DSS payments, healthcare, retail e-commerce and bank insurance.',
    principlesTitle: '## Operating Principles',
    principles: [
      '- Performance-first: LCP, INP, CLS and bundle size in production budgets.',
      '- A11y & compliance: WCAG 2.2 AA, WAI-ARIA, PCI-DSS-grade safeguards.',
    ],
    statusTitle: '## Current Status',
    statusPrefix: 'Open to ',
    role: '[Senior]',
    statusSuffix: ' roles or impactful contract roles · remote-first · EU/US/CA · English C1.',
    details: [
      '- Level: Senior',
      '- Track: individual contributor or technical lead',
      '- Engagement: full-time or fixed-term contract',
      '- Domains: frontend, payments, healthcare, AI tooling',
    ],
    gutterLines: 13,
  },
  now: {
    title: 'CAT ~/.NOW',
    rows: [
      {
        k: 'Currently',
        v: `building the investor workflow frontend at ${profile.currentEmployer.name} · private-markets fintech`,
      },
      { k: 'Reading', v: 'AI Engineering · Chip Huyen, applied LLM eval in prod' },
      { k: 'Building', v: 'this portfolio. you are looking at it.' },
      { k: 'Updated', v: '2026-10-16' },
    ],
  },
  responsibilities: {
    title: 'LS -LA ~/RESPONSIBILITIES',
    command: '$ ls -la ~/responsibilities // role boundaries, in unix terms',
  },
  stack: {
    title: 'NPM LIST --GLOBAL',
    groups: [
      { label: 'CORE', items: ['REACT', 'NEXT.JS', 'NODE', 'EXPRESS', 'AWS', 'DOCKER'] },
      { label: 'ANGULAR', items: ['ANGULAR', 'NGRX', 'RXJS', 'NX', 'STENCIL', 'MICRO-FRONTENDS'] },
      { label: 'LANG_DATA', items: ['TS', 'CSS', 'POSTGRES', 'MONGO', 'REDIS'] },
      { label: 'QUALITY', items: ['JEST', 'VITEST', 'PLAYWRIGHT', 'A11Y'] },
      { label: 'TOOLING', items: ['COPILOT', 'CLAUDE', 'STORYBOOK', 'VERCEL', 'TANSTACK'] },
    ],
  },
  code: {
    title: '$ cat src/lib/with-retry.ts',
    label: 'README code',
    repoLabel: '// view full repo →',
    repoHref: social.github,
    repoAccessibleLabel: 'View full repo, opens in a new tab',
    tokens: [
      {
        text: '// retry an RxJS stream with exponential backoff + jitter, used in',
        className: 'text-primary-400 italic',
      },
      {
        text: '\n',
        className: '',
      },
      {
        text: "// the cashier's deposit polling loop. signals abort on permanent 4xx.",
        className: 'text-primary-400 italic',
      },
      {
        text: '\n',
        className: '',
      },
      {
        text: 'export function',
        className: 'text-primary-500 font-bold',
      },
      {
        text: ' ',
        className: '',
      },
      {
        text: 'withRetry',
        className: 'text-quaternary-400',
      },
      {
        text: '<',
        className: 'text-tertiary-50',
      },
      {
        text: 'T',
        className: 'text-quinary-300',
      },
      {
        text: '>',
        className: 'text-tertiary-50',
      },
      {
        text: '(',
        className: 'text-tertiary-50',
      },
      {
        text: '\n  ',
        className: '',
      },
      {
        text: '{ max = ',
        className: 'text-tertiary-50',
      },
      {
        text: '5',
        className: 'text-quinary-300',
      },
      {
        text: ', base = ',
        className: 'text-tertiary-50',
      },
      {
        text: '300',
        className: 'text-quinary-300',
      },
      {
        text: ', isFatal }: ',
        className: 'text-tertiary-50',
      },
      {
        text: 'RetryOpts',
        className: 'text-quinary-300',
      },
      {
        text: ',',
        className: 'text-tertiary-50',
      },
      {
        text: '\n',
        className: '',
      },
      {
        text: '): ',
        className: 'text-tertiary-50',
      },
      {
        text: 'MonoTypeOperatorFunction',
        className: 'text-quinary-300',
      },
      {
        text: '<',
        className: 'text-tertiary-50',
      },
      {
        text: 'T',
        className: 'text-quinary-300',
      },
      {
        text: '> {',
        className: 'text-tertiary-50',
      },
      {
        text: '\n  ',
        className: '',
      },
      {
        text: 'return',
        className: 'text-primary-500 font-bold',
      },
      {
        text: ' ',
        className: '',
      },
      {
        text: 'retry',
        className: 'text-quaternary-400',
      },
      {
        text: '({',
        className: 'text-tertiary-50',
      },
      {
        text: '\n    count',
        className: '',
      },
      {
        text: ':',
        className: 'text-tertiary-50',
      },
      {
        text: ' max',
        className: '',
      },
      {
        text: ',',
        className: 'text-tertiary-50',
      },
      {
        text: '\n    delay',
        className: '',
      },
      {
        text: ': (err, attempt) => {',
        className: 'text-tertiary-50',
      },
      {
        text: '\n      ',
        className: '',
      },
      {
        text: 'if',
        className: 'text-primary-500 font-bold',
      },
      {
        text: ' ',
        className: '',
      },
      {
        text: '(',
        className: 'text-tertiary-50',
      },
      {
        text: 'isFatal',
        className: 'text-quaternary-400',
      },
      {
        text: '?.(err)) ',
        className: 'text-tertiary-50',
      },
      {
        text: 'throw',
        className: 'text-primary-500 font-bold',
      },
      {
        text: ' err',
        className: '',
      },
      {
        text: ';',
        className: 'text-tertiary-50',
      },
      {
        text: '\n      ',
        className: '',
      },
      {
        text: 'const',
        className: 'text-primary-500 font-bold',
      },
      {
        text: ' wait ',
        className: '',
      },
      {
        text: '=',
        className: 'text-tertiary-50',
      },
      {
        text: ' base ',
        className: '',
      },
      {
        text: '* ',
        className: 'text-tertiary-50',
      },
      {
        text: '2',
        className: 'text-quinary-300',
      },
      {
        text: '**',
        className: 'text-tertiary-50',
      },
      {
        text: 'attempt ',
        className: '',
      },
      {
        text: '+ ',
        className: 'text-tertiary-50',
      },
      {
        text: 'Math.random',
        className: 'text-quaternary-400',
      },
      {
        text: '() * ',
        className: 'text-tertiary-50',
      },
      {
        text: 'base',
        className: '',
      },
      {
        text: ';',
        className: 'text-tertiary-50',
      },
      {
        text: '\n      ',
        className: '',
      },
      {
        text: 'return',
        className: 'text-primary-500 font-bold',
      },
      {
        text: ' ',
        className: '',
      },
      {
        text: 'timer',
        className: 'text-quaternary-400',
      },
      {
        text: '(wait);',
        className: 'text-tertiary-50',
      },
      {
        text: '\n    ',
        className: '',
      },
      {
        text: '}',
        className: 'text-tertiary-50',
      },
      {
        text: ',',
        className: 'text-tertiary-50',
      },
      {
        text: '\n  ',
        className: '',
      },
      {
        text: '});',
        className: 'text-tertiary-50',
      },
      {
        text: '\n',
        className: '',
      },
      {
        text: '}',
        className: 'text-tertiary-50',
      },
    ].map((token, id) => ({ ...token, id })),
  },
});
