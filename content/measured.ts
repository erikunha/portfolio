import { companyLinkCopy } from './company-link';
import { type MeasuredStates, MeasuredStatesSchema } from './measured-states.schema';
import { type Measured, MeasuredSchema } from './schemas';

export type { Measured };

import { SITE_LOCALE, type SiteLocale } from './site-locale';

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

const measuredFor = (locale: SiteLocale): Measured => {
  const pt = locale === SITE_LOCALE.pt;
  return MeasuredSchema.parse({
    format: {
      locale: pt ? 'pt-BR' : 'en-US',
      percentScale: 100,
      costPrecision: 4,
      dateLength: 10,
      millisecondsPerSecond: 1000,
      askStaleAfterMs: WEEK_MS,
      empty: '-',
    },
    title: pt ? 'Medições' : 'Measured',
    command: 'MEASURED.JSON',
    sourceLabel: pt ? 'fonte:' : 'source:',
    externalDisclosure: companyLinkCopy[locale].disclosure,
    unavailable: pt ? 'indisponível' : 'unavailable',
    loading: pt ? 'carregando…' : 'loading…',
    stale: pt ? 'desatualizado' : 'stale',
    unknownTimestamp: pt ? 'timestamp indisponível' : 'timestamp unavailable',
    ask: {
      title: 'ASK_EVAL.JSON',
      source: 'scripts/ask-eval.ts',
      url: 'https://github.com/erikunha/portfolio/blob/main/scripts/ask-eval.ts',
      cacheKey: 'ask:eval:latest',
      timestampLabel: 'eval',
      percentUnit: '%',
      latencyUnit: 'ms',
      currencyUnit: '$',
      pending: pt
        ? 'Avaliação pendente. Ainda não há resultados disponíveis.'
        : 'Eval pending. No results are available yet.',
      unavailable: pt
        ? 'Os resultados da avaliação estão indisponíveis agora. Tente de novo mais tarde.'
        : 'Eval results are unavailable right now. Try again later.',
      p95Prefix: pt ? '95% das respostas terminam em até' : '95% of answers finish within',
      p95Pending: pt
        ? '95% das respostas terminam em até este tempo'
        : '95% of answers finish within this time',
      metrics: [
        {
          key: 'evalPassRate',
          label: pt ? 'TAXA DE ACERTO DO EVAL' : 'EVAL PASS-RATE',
          description: pt
            ? 'corretude · corpus factual + edge'
            : 'correctness · factual + edge corpus',
        },
        {
          key: 'jailbreakResistance',
          label: pt ? 'RESISTÊNCIA A JAILBREAK' : 'JAILBREAK RESIST',
          description: pt ? 'taxa de recusa a prompt injection' : 'prompt-injection refusal rate',
        },
        { key: 'p95LatencyMs', label: pt ? 'LATÊNCIA P95' : 'P95 LATENCY', description: '' },
        {
          key: 'costPerAnswer',
          label: pt ? 'CUSTO / RESPOSTA' : 'COST / ANSWER',
          description: pt
            ? 'inferência em produção · apenas o modelo do recurso'
            : 'production inference · feature model only',
        },
      ],
    },
    psi: {
      title: 'LIVE_PERF.JSON',
      source: 'PSI',
      url: 'https://pagespeed.web.dev/analysis?url=https%3A%2F%2Fwww.erikunha.dev%2F',
      timestampLabel: 'psi',
      pairSeparator: ' / ',
      strategies: [
        { key: 'desktop', label: 'desktop' },
        { key: 'mobile', label: pt ? 'celular' : 'mobile' },
      ],
      metrics: [
        { key: 'performance', label: pt ? 'DESEMPENHO' : 'PERFORMANCE' },
        { key: 'accessibility', label: pt ? 'ACESSIBILIDADE' : 'ACCESSIBILITY' },
        { key: 'bestPractices', label: pt ? 'BOAS PRÁTICAS' : 'BEST PRACTICES' },
        { key: 'seo', label: 'SEO' },
      ],
    },
  });
};

export const measured: Record<SiteLocale, Measured> = {
  [SITE_LOCALE.en]: measuredFor(SITE_LOCALE.en),
  [SITE_LOCALE.pt]: measuredFor(SITE_LOCALE.pt),
};

const measuredStatesFor = (locale: SiteLocale): MeasuredStates => {
  const pt = locale === SITE_LOCALE.pt;
  return MeasuredStatesSchema.parse({
    perfLoading: {
      label: pt ? 'MEDIDO · LIGHTHOUSE' : 'MEASURED · LIGHTHOUSE',
      fetching: pt
        ? '> buscando as medições de desktop e celular'
        : '> fetching desktop and mobile runs',
      placeholder: '--',
      tiles: { performance: 'perf', accessibility: 'a11y', bestPractices: 'bp', seo: 'seo' },
    },
  });
};

export const measuredStates: Record<SiteLocale, MeasuredStates> = {
  [SITE_LOCALE.en]: measuredStatesFor(SITE_LOCALE.en),
  [SITE_LOCALE.pt]: measuredStatesFor(SITE_LOCALE.pt),
};

export const MEASURED_FORMAT = measured[SITE_LOCALE.en].format;

export function metricTimestamp(
  iso: string | undefined,
  staleAfterMs: number,
  locale: SiteLocale = SITE_LOCALE.en,
) {
  const timestamp = iso ? new Date(iso).getTime() : Number.NaN;
  const valid = Number.isFinite(timestamp);
  return {
    valid,
    label: valid
      ? new Date(timestamp).toISOString().slice(0, MEASURED_FORMAT.dateLength)
      : measured[locale].unknownTimestamp,
    stale: valid && Date.now() - timestamp > staleAfterMs,
  };
}
