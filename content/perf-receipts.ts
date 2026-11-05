import { z } from 'zod';
import { type PerfReceipt, PerfReceiptSchema } from './schemas';
import { SITE_LOCALE, type SiteLocale } from './site-locale';

const perfReceiptsFor = (locale: SiteLocale): PerfReceipt[] => {
  const pt = locale === SITE_LOCALE.pt;
  return z.array(PerfReceiptSchema).parse([
    {
      metric: 'API_LATENCY',
      delta: '-97.5%',
      company: '@ VENTURUS',
      note: pt
        ? 'API de relatórios em uma plataforma de cliente. Reescrita de query + índices PostgreSQL.'
        : 'reporting API at a client platform. Query rewrite + PostgreSQL indexes.',
      project: true,
      displayValue: '40s→<1s',
      before: 40,
      after: 1,
    },
    {
      metric: 'BUNDLE_CSS',
      delta: '-98%',
      company: '@ CANON_MEDICAL',
      note: pt
        ? 'Refatoração de utilitários PrimeFlex no shell de layout, mais lazy load'
        : 'PrimeFlex utility refactor on the layout shell, plus lazy load',
      project: true,
    },
    {
      metric: 'TTI',
      delta: '-52%',
      company: '@ CANON_MEDICAL',
      note: pt ? 'async concorrente + OnPush.' : 'concurrent async + OnPush.',
    },
    {
      metric: 'INITIAL_LOAD',
      delta: '-25%',
      company: '@ CANON_MEDICAL',
      note: pt
        ? 'Módulos lazy-loaded e code splitting por rota'
        : 'Lazy-loaded modules and route-level code splitting',
      project: true,
    },
    {
      metric: 'BUNDLE_JS',
      delta: '-33%',
      company: '@ CANON_MEDICAL',
      note: pt ? 'code splitting + dynamic imports.' : 'code splitting + dynamic imports.',
    },
    {
      metric: 'PAGE_LOAD',
      delta: '-32%',
      company: '@ GRUPO_SBF',
      note: pt
        ? 'Code splitting do Next.js, dynamic imports, otimização de imagem e cache.'
        : 'Next.js code splitting, dynamic imports, image optimization and caching.',
    },
    {
      metric: 'CONVERSION',
      delta: '+10%',
      company: '@ GRUPO_SBF',
      note: pt ? 'mais de 20 experimentos A/B.' : '20+ A/B experiments.',
      project: true,
    },
    {
      metric: 'DESKTOP_BUILD',
      delta: '-40%',
      company: '@ MB_LABS',
      note: pt
        ? 'uma base Ionic + Angular + Electron, ~80% compartilhada entre 5 SOs.'
        : 'one Ionic + Angular + Electron codebase, ~80% shared across 5 OSes.',
      project: true,
    },
    {
      metric: 'CLS',
      delta: '-100%',
      company: '@ RAYLU',
      note: pt
        ? 'layout shift de 0.166 para 0 na rota de empresa.'
        : 'layout shift 0.166 to 0 on the company route.',
      displayValue: '0.166→0',
      before: 0.166,
      after: 0,
    },
    {
      metric: 'LIGHTHOUSE',
      delta: '+21.5%',
      company: '@ RAYLU',
      note: pt
        ? 'pontuação de performance de 79 para 96 na rota de empresa.'
        : 'performance score 79 to 96 on the company route.',
      displayValue: '79→96',
      before: 79,
      after: 96,
    },
    {
      metric: 'RELEASE_TIME',
      delta: '-85%',
      company: '@ CANON_MEDICAL',
      note: pt
        ? 'pipeline de release de ~5 min para ~45 s.'
        : 'release pipeline about 5 min to about 45 s.',
      displayValue: '~5min→~45s',
      before: 300,
      after: 45,
    },
    {
      metric: 'LCP',
      delta: '-48.6%',
      company: '@ RAYLU',
      note: pt
        ? 'uma rota, migração de plataforma de dados atrás de um A/B em produção.'
        : 'one route, data-platform migration behind a production A/B.',
      project: true,
      displayValue: '2,544→1,308ms',
      before: 2544,
      after: 1308,
    },
  ]);
};

export const perfReceipts: Record<SiteLocale, PerfReceipt[]> = {
  [SITE_LOCALE.en]: perfReceiptsFor(SITE_LOCALE.en),
  [SITE_LOCALE.pt]: perfReceiptsFor(SITE_LOCALE.pt),
};

export const projectReceipts = (locale: SiteLocale): PerfReceipt[] =>
  perfReceipts[locale].filter((receipt) => receipt.project);

export const receiptsHeading = z.string().min(1).parse('PERF_RECEIPTS --HARD-NUMBERS');
