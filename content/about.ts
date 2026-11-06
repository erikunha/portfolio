import { companyLinkCopy } from './company-link';
import { type AboutContent, AboutContentSchema } from './schemas';
import { SITE_LOCALE, type SiteLocale } from './site-locale';
import { social } from './social';
import { WORK_SCOPE } from './work-scope';

const codeTokens = [
  { text: '// retry an RxJS stream with', className: 'text-primary-400 italic' },
  { text: '\n', className: '' },
  { text: '// exponential backoff + jitter,', className: 'text-primary-400 italic' },
  { text: '\n', className: '' },
  { text: "// used in the cashier's deposit", className: 'text-primary-400 italic' },
  { text: '\n', className: '' },
  { text: '// polling loop; signals abort', className: 'text-primary-400 italic' },
  { text: '\n', className: '' },
  { text: '// on permanent 4xx.', className: 'text-primary-400 italic' },
  { text: '\n', className: '' },
  { text: 'type', className: 'text-primary-500 font-bold' },
  { text: ' ', className: '' },
  { text: 'Op', className: 'text-quinary-300' },
  { text: '<', className: 'text-tertiary-50' },
  { text: 'T', className: 'text-quinary-300' },
  { text: '>', className: 'text-tertiary-50' },
  { text: ' =', className: 'text-tertiary-50' },
  { text: '\n  ', className: '' },
  { text: 'MonoTypeOperatorFunction', className: 'text-quinary-300' },
  { text: '<T>;', className: 'text-tertiary-50' },
  { text: '\n\n', className: '' },
  { text: 'export function', className: 'text-primary-500 font-bold' },
  { text: ' ', className: '' },
  { text: 'withRetry', className: 'text-quaternary-400' },
  { text: '<', className: 'text-tertiary-50' },
  { text: 'T', className: 'text-quinary-300' },
  { text: '>({', className: 'text-tertiary-50' },
  { text: '\n  max = ', className: 'text-tertiary-50' },
  { text: '5', className: 'text-quinary-300' },
  { text: ',\n  base = ', className: 'text-tertiary-50' },
  { text: '300', className: 'text-quinary-300' },
  { text: ',\n  isFatal,\n', className: 'text-tertiary-50' },
  { text: '}: ', className: 'text-tertiary-50' },
  { text: 'RetryOpts', className: 'text-quinary-300' },
  { text: '): ', className: 'text-tertiary-50' },
  { text: 'Op', className: 'text-quinary-300' },
  { text: '<T> {', className: 'text-tertiary-50' },
  { text: '\n  ', className: '' },
  { text: 'return', className: 'text-primary-500 font-bold' },
  { text: ' ', className: '' },
  { text: 'retry', className: 'text-quaternary-400' },
  { text: '({', className: 'text-tertiary-50' },
  { text: '\n    count', className: '' },
  { text: ':', className: 'text-tertiary-50' },
  { text: ' max', className: '' },
  { text: ',', className: 'text-tertiary-50' },
  { text: '\n    delay', className: '' },
  { text: ': (err, attempt) => {', className: 'text-tertiary-50' },
  { text: '\n      ', className: '' },
  { text: 'if', className: 'text-primary-500 font-bold' },
  { text: ' ', className: '' },
  { text: '(', className: 'text-tertiary-50' },
  { text: 'isFatal', className: 'text-quaternary-400' },
  { text: '?.(err))', className: 'text-tertiary-50' },
  { text: '\n        ', className: '' },
  { text: 'throw', className: 'text-primary-500 font-bold' },
  { text: ' err', className: '' },
  { text: ';', className: 'text-tertiary-50' },
  { text: '\n      ', className: '' },
  { text: 'const', className: 'text-primary-500 font-bold' },
  { text: ' backoff ', className: '' },
  { text: '=', className: 'text-tertiary-50' },
  { text: '\n        ', className: '' },
  { text: 'base ', className: '' },
  { text: '* ', className: 'text-tertiary-50' },
  { text: '2', className: 'text-quinary-300' },
  { text: ' ** ', className: 'text-tertiary-50' },
  { text: 'attempt', className: '' },
  { text: ';', className: 'text-tertiary-50' },
  { text: '\n      ', className: '' },
  { text: 'const', className: 'text-primary-500 font-bold' },
  { text: ' jitter ', className: '' },
  { text: '=', className: 'text-tertiary-50' },
  { text: '\n        ', className: '' },
  { text: 'Math.random', className: 'text-quaternary-400' },
  { text: '() * ', className: 'text-tertiary-50' },
  { text: 'base', className: '' },
  { text: ';', className: 'text-tertiary-50' },
  { text: '\n      ', className: '' },
  { text: 'return', className: 'text-primary-500 font-bold' },
  { text: ' ', className: '' },
  { text: 'timer', className: 'text-quaternary-400' },
  { text: '(', className: 'text-tertiary-50' },
  { text: '\n        ', className: '' },
  { text: 'backoff', className: '' },
  { text: ' + ', className: 'text-tertiary-50' },
  { text: 'jitter', className: '' },
  { text: ',', className: 'text-tertiary-50' },
  { text: '\n      ', className: '' },
  { text: ');', className: 'text-tertiary-50' },
  { text: '\n    ', className: '' },
  { text: '}', className: 'text-tertiary-50' },
  { text: ',', className: 'text-tertiary-50' },
  { text: '\n  ', className: '' },
  { text: '});', className: 'text-tertiary-50' },
  { text: '\n', className: '' },
  { text: '}', className: 'text-tertiary-50' },
].map((token, id) => ({ ...token, id }));

const aboutFor = (locale: SiteLocale): AboutContent => {
  const pt = locale === SITE_LOCALE.pt;
  return AboutContentSchema.parse({
    title: pt ? 'Sobre' : 'About',
    command: 'CAT README.MD',
    marker: '▌',
    whoami: {
      title: '# Whoami',
      intro: pt
        ? 'Mais de 8 anos construindo software web de produção para plataformas reguladas e de alto tráfego: fintech de mercados privados, pagamentos PCI-DSS, saúde, e-commerce de varejo e seguros bancários.'
        : '8+ years building production web software for regulated, high-traffic platforms: private-markets fintech, PCI-DSS payments, healthcare, retail e-commerce and bank insurance.',
      principlesTitle: pt ? '## Princípios de operação' : '## Operating Principles',
      principles: [
        pt
          ? '- Performance em primeiro lugar: LCP, INP, CLS e tamanho de bundle em orçamentos de produção.'
          : '- Performance-first: LCP, INP, CLS and bundle size in production budgets.',
        pt
          ? '- A11y e conformidade: WCAG 2.2 AA, WAI-ARIA, salvaguardas de nível PCI-DSS.'
          : '- A11y & compliance: WCAG 2.2 AA, WAI-ARIA, PCI-DSS-grade safeguards.',
      ],
      statusTitle: pt ? '## Status atual' : '## Current Status',
      statusPrefix: pt ? 'Aberto a ' : 'Open to ',
      role: pt ? '[Sênior]' : '[Senior]',
      statusSuffix: pt
        ? ` cargos ou contratos de impacto · ${WORK_SCOPE[locale]} · Inglês C1.`
        : ` roles or impactful contract roles · ${WORK_SCOPE[locale]} · English C1.`,
      details: [
        pt ? '- Nível: Sênior' : '- Level: Senior',
        pt
          ? '- Trilha: contribuidor individual ou tech lead'
          : '- Track: individual contributor or technical lead',
        pt
          ? '- Contratação: tempo integral ou contrato de prazo fixo'
          : '- Engagement: full-time or fixed-term contract',
        pt
          ? '- Domínios: plataformas frontend, pagamentos, saúde, produtos AI-native'
          : '- Domains: frontend platforms, payments, healthcare, AI-native products',
      ],
      gutterLines: 64,
    },
    now: {
      title: 'CAT ~/.NOW',
      rows: [
        {
          k: pt ? 'Atualmente' : 'Currently',
          v: pt
            ? 'construindo o frontend do fluxo de trabalho do investidor na Raylu · fintech de mercados privados'
            : 'building the investor workflow frontend at Raylu · private-markets fintech',
          company: { name: 'Raylu', url: 'https://raylu.ai' },
        },
        {
          k: pt ? 'Lendo' : 'Reading',
          v: 'AI Engineering · Chip Huyen; LangGraph, LangSmith, Langfuse',
        },
        {
          k: pt ? 'Construindo' : 'Building',
          v: pt
            ? 'este portfólio. você está olhando para ele.'
            : 'this portfolio. you are looking at it.',
        },
        { k: pt ? 'Atualizado' : 'Updated', v: '2026-11-04' },
      ],
    },
    responsibilities: {
      title: 'LS -LA ~/RESPONSIBILITIES',
      command: pt
        ? '$ ls -la ~/responsibilities // limites do papel, em termos unix'
        : '$ ls -la ~/responsibilities // role boundaries, in unix terms',
    },
    stack: {
      title: 'NPM LIST --GLOBAL',
      groups: [
        {
          label: pt ? 'NÚCLEO' : 'CORE',
          items: ['REACT', 'NEXT.JS', 'NODE', 'EXPRESS', 'AWS', 'DOCKER'],
        },
        {
          label: 'ANGULAR',
          items: ['ANGULAR', 'NGRX', 'RXJS', 'NX', 'STENCIL', 'MICRO-FRONTENDS'],
        },
        { label: pt ? 'DADOS' : 'LANG_DATA', items: ['TS', 'CSS', 'POSTGRES', 'MONGO', 'REDIS'] },
        { label: pt ? 'QUALIDADE' : 'QUALITY', items: ['JEST', 'VITEST', 'PLAYWRIGHT', 'A11Y'] },
        {
          label: pt ? 'FERRAMENTAS' : 'TOOLING',
          items: ['COPILOT', 'CLAUDE', 'STORYBOOK', 'VERCEL', 'TANSTACK'],
        },
      ],
    },
    code: {
      title: '$ cat src/lib/with-retry.ts',
      repoLabel: 'github',
      repoGlyph: '↗',
      repoHref: social.github,
      repoNewTabNote: companyLinkCopy[locale].disclosure,
      tokens: codeTokens,
    },
  });
};

export const aboutContent: Record<SiteLocale, AboutContent> = {
  [SITE_LOCALE.en]: aboutFor(SITE_LOCALE.en),
  [SITE_LOCALE.pt]: aboutFor(SITE_LOCALE.pt),
};
