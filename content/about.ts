import { companyLinkCopy } from './company-link';
import { type AboutContent, AboutContentSchema } from './schemas';
import { SITE_LOCALE, type SiteLocale } from './site-locale';
import { social } from './social';
import { WORK_SCOPE } from './work-scope';

const codeTokens = [
  { text: '// retry an RxJS stream with', className: 'text-text-secondary italic' },
  { text: '\n', className: '' },
  { text: '// exponential backoff + jitter,', className: 'text-text-secondary italic' },
  { text: '\n', className: '' },
  { text: "// used in the cashier's deposit", className: 'text-text-secondary italic' },
  { text: '\n', className: '' },
  { text: '// polling loop; signals abort', className: 'text-text-secondary italic' },
  { text: '\n', className: '' },
  { text: '// on permanent 4xx.', className: 'text-text-secondary italic' },
  { text: '\n', className: '' },
  { text: 'type', className: 'text-primary-500 font-bold' },
  { text: ' ', className: '' },
  { text: 'Op', className: 'text-primary-200' },
  { text: '<', className: 'text-tertiary-50' },
  { text: 'T', className: 'text-primary-200' },
  { text: '>', className: 'text-tertiary-50' },
  { text: ' =', className: 'text-tertiary-50' },
  { text: '\n  ', className: '' },
  { text: 'MonoTypeOperatorFunction', className: 'text-primary-200' },
  { text: '<T>;', className: 'text-tertiary-50' },
  { text: '\n\n', className: '' },
  { text: 'export function', className: 'text-primary-500 font-bold' },
  { text: ' ', className: '' },
  { text: 'withRetry', className: 'text-primary-400' },
  { text: '<', className: 'text-tertiary-50' },
  { text: 'T', className: 'text-primary-200' },
  { text: '>({', className: 'text-tertiary-50' },
  { text: '\n  max = ', className: 'text-tertiary-50' },
  { text: '5', className: 'text-primary-200' },
  { text: ',\n  base = ', className: 'text-tertiary-50' },
  { text: '300', className: 'text-primary-200' },
  { text: ',\n  isFatal,\n', className: 'text-tertiary-50' },
  { text: '}: ', className: 'text-tertiary-50' },
  { text: 'RetryOpts', className: 'text-primary-200' },
  { text: '): ', className: 'text-tertiary-50' },
  { text: 'Op', className: 'text-primary-200' },
  { text: '<T> {', className: 'text-tertiary-50' },
  { text: '\n  ', className: '' },
  { text: 'return', className: 'text-primary-500 font-bold' },
  { text: ' ', className: '' },
  { text: 'retry', className: 'text-primary-400' },
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
  { text: 'isFatal', className: 'text-primary-400' },
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
  { text: '2', className: 'text-primary-200' },
  { text: ' ** ', className: 'text-tertiary-50' },
  { text: 'attempt', className: '' },
  { text: ';', className: 'text-tertiary-50' },
  { text: '\n      ', className: '' },
  { text: 'const', className: 'text-primary-500 font-bold' },
  { text: ' jitter ', className: '' },
  { text: '=', className: 'text-tertiary-50' },
  { text: '\n        ', className: '' },
  { text: 'Math.random', className: 'text-primary-400' },
  { text: '() * ', className: 'text-tertiary-50' },
  { text: 'base', className: '' },
  { text: ';', className: 'text-tertiary-50' },
  { text: '\n      ', className: '' },
  { text: 'return', className: 'text-primary-500 font-bold' },
  { text: ' ', className: '' },
  { text: 'timer', className: 'text-primary-400' },
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
        ? 'Mais de 8 anos de software em produção em SaaS AI-native, fintech, pagamentos e e-commerce: sistemas com LLMs e a avaliação que decide se é seguro colocá-los em produção, originação de negócios em mercados privados, pagamentos PCI-DSS, serviço de equipamentos hospitalares e seguros bancários.'
        : '8+ years of production software across AI-native SaaS, fintech, payments and e-commerce: LLM systems and the evaluation that decides whether they are safe to ship, private-markets deal origination, PCI-DSS payments, hospital equipment service and bank insurance.',
      principlesTitle: pt ? '## Princípios de operação' : '## Operating Principles',
      principles: [
        pt
          ? '- Performance em primeiro lugar: LCP, INP, CLS e tamanho de bundle em orçamentos de produção.'
          : '- Performance-first: LCP, INP, CLS and bundle size in production budgets.',
        pt
          ? '- A11y e conformidade: WCAG 2.2 AA, WAI-ARIA, salvaguardas de nível PCI-DSS.'
          : '- A11y & compliance: WCAG 2.2 AA, WAI-ARIA, PCI-DSS-grade safeguards.',
        pt
          ? '- Avaliar antes de lançar: juiz LLM calibrado contra rótulos humanos, resistência a jailbreak travada em CI.'
          : '- Evals before shipping: an LLM judge calibrated against human labels, jailbreak resistance gated in CI.',
      ],
      statusTitle: pt ? '## Status atual' : '## Current Status',
      statusPrefix: pt ? 'Aberto a vagas de nível ' : 'Open to ',
      role: pt ? 'Sênior' : 'Senior',
      statusSuffix: pt
        ? ` ou contratos de impacto · ${WORK_SCOPE[locale]} · Inglês C1.`
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
          ? '- Domínios: produtos AI-native, GenAI e agentes, avaliação de LLMs, plataformas de produto densas em dados, pagamentos'
          : '- Domains: AI-native products, GenAI and agents, LLM evaluation, data-dense product platforms, payments',
      ],
      gutterLines: 64,
    },
    now: {
      title: 'CAT ~/.NOW',
      rows: [
        {
          k: pt ? 'Atualmente' : 'Currently',
          v: pt
            ? 'construindo o frontend do fluxo de trabalho do investidor na Raylu · originação de negócios com IA'
            : 'building the investor workflow frontend at Raylu · AI deal origination',
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
          label: pt ? 'IA/LLM' : 'AI/LLM',
          items: ['LLM SYSTEMS', 'EVALS', 'AGENTS', 'GUARDRAILS', 'MCP', 'PROMPT ENGINEERING'],
        },
        {
          label: pt ? 'NÚCLEO' : 'CORE',
          items: ['REACT', 'NEXT.JS', 'NODE', 'PYTHON', 'EXPRESS', 'AWS', 'DOCKER'],
        },
        {
          label: 'ANGULAR',
          items: ['NGRX', 'RXJS', 'NX', 'STENCIL', 'MICRO-FRONTENDS'],
        },
        { label: pt ? 'DADOS' : 'LANG_DATA', items: ['TS', 'CSS', 'POSTGRES', 'MONGO', 'REDIS'] },
        { label: pt ? 'QUALIDADE' : 'QUALITY', items: ['JEST', 'VITEST', 'PLAYWRIGHT', 'A11Y'] },
        {
          label: pt ? 'FERRAMENTAS' : 'TOOLING',
          items: ['COPILOT', 'CLAUDE', 'CODEX', 'STORYBOOK', 'VERCEL', 'TANSTACK'],
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
