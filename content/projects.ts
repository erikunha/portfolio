import { z } from 'zod';
import { type Project, ProjectSchema } from './schemas';
import { SITE_LOCALE, type SiteLocale } from './site-locale';

export const projectPresentation: Record<
  SiteLocale,
  { command: string; mobileCommand: string; permissions: string; externalDisclosure: string }
> = {
  [SITE_LOCALE.en]: {
    command: 'LS -LA ./PROJECTS',
    mobileCommand: 'LS -LA ~/PROJECTS',
    permissions: 'drwxr-xr-x',
    externalDisclosure: '(opens in a new tab)',
  },
  [SITE_LOCALE.pt]: {
    command: 'LS -LA ./PROJETOS',
    mobileCommand: 'LS -LA ~/PROJETOS',
    permissions: 'drwxr-xr-x',
    externalDisclosure: '(abre em uma nova guia)',
  },
};

// Project names and stat values are facts (tokens and numbers stay identical
// across locales, held to the perf receipts by __tests__/metric-consistency);
// descriptions and stat labels carry the translation.
const projectsFor = (locale: SiteLocale): Project[] => {
  const pt = locale === SITE_LOCALE.pt;
  return z
    .array(ProjectSchema)
    .length(9)
    .parse([
      {
        name: 'ORIGINATION_PLATFORM_UI',
        company: 'Raylu',
        kind: 'professional',
        description: pt
          ? 'Telas de fluxo de trabalho do investidor na plataforma de mercados privados da Raylu: empresa, pipeline, comparação, prospecção. Motor de tabelas compartilhado e estado de visualização na URL para fundos com mais de US$ 500B em ativos.'
          : "Investor workflow screens on Raylu's private-markets platform: company, pipeline, comparison, outreach. Shared table engine and URL-backed view state for funds holding $500B+ in assets.",
        stats: [
          { label: pt ? 'SUPERFÍCIES' : 'SURFACES', value: 'COMPANY / PIPELINE / OUTREACH' },
          {
            label: pt ? 'ESTADO' : 'STATE',
            value: pt ? 'VERSIONADO + NA URL' : 'VERSIONED + URL-BACKED',
          },
          { label: 'STACK', value: 'REACT / NEXT 14 / TS 5' },
        ],
      },
      {
        name: 'PAYMENT_ORCHESTRA',
        company: 'Betsson Group',
        kind: 'professional',
        description: pt
          ? 'Plataforma de cashier PCI-DSS: orquestração de depósitos e saques multi-marca em mais de 15 jurisdições reguladas.'
          : 'PCI-DSS cashier platform: multi-brand deposit/withdraw orchestration across 15+ regulated jurisdictions.',
        stats: [
          { label: pt ? 'VOLUME' : 'VOLUME', value: '40M+ TX / YR' },
          { label: pt ? 'RECEITA' : 'REVENUE', value: '€1.197B (GROUP)' },
          { label: 'STACK', value: 'ANGULAR / STENCIL / NGRX / NX' },
        ],
      },
      {
        name: 'SERVICE_OPS_CONSOLE',
        company: 'Canon Medical Systems Brazil',
        kind: 'professional',
        description: pt
          ? 'Plataforma de serviço de equipamentos hospitalares: ordens de serviço, agendamento de especialistas, visitas de campo, atualizações ao vivo. Clean Architecture.'
          : 'Hospital equipment service platform: service orders, specialist scheduling, field visits, live updates. Clean Architecture.',
        stats: [
          { label: pt ? 'BUNDLE JS' : 'JS BUNDLE', value: '-33%' },
          { label: 'TTI', value: '-52%' },
          { label: 'STACK', value: 'ANGULAR / NX / RXJS' },
        ],
      },
      {
        name: 'COMMERCE_EDGE',
        company: 'Grupo SBF',
        kind: 'professional',
        description: pt
          ? 'Storefronts da Nike Brasil e Centauro: SSR/SSG/ISR, gateway BFF, monorepo Nx compartilhado, mais de 20 experimentos A/B.'
          : 'Nike Brazil & Centauro storefronts: SSR/SSG/ISR, BFF gateway, shared Nx monorepo, 20+ A/B experiments.',
        stats: [
          { label: pt ? 'ALCANCE' : 'REACH', value: '8M+ MAU' },
          { label: pt ? 'TEMPO DE CARREGAMENTO' : 'LOAD TIME', value: '-32%' },
          { label: 'STACK', value: 'NEXT.JS / REACT / TS' },
        ],
      },
      {
        name: 'AI_AGENT_MESH',
        company: 'Betsson Group',
        kind: 'professional',
        perm: '-rwx------',
        description: pt
          ? 'Sistema de engenharia GitHub Copilot cobrindo geração, revisão, depuração, testes e validação de arquitetura. Toda ação automatizada é revisável. Adotado por todo o time na Betsson.'
          : 'GitHub Copilot engineering system across generation, review, debugging, testing and architecture validation. Every automated action reviewable. Adopted team-wide at Betsson.',
        stats: [
          { label: pt ? 'REVISÃO' : 'REVIEW', value: pt ? 'TODA AÇÃO' : 'EVERY ACTION' },
          { label: pt ? 'ESCOPO' : 'SCOPE', value: pt ? 'TODO O TIME' : 'TEAM-WIDE' },
          { label: 'STACK', value: 'GITHUB COPILOT' },
        ],
      },
      {
        name: 'EDTECH_OMNI',
        company: 'MB Labs',
        kind: 'professional',
        description: pt
          ? 'App EdTech multiplataforma: uma base de código, cinco sistemas operacionais (Android / iOS / Win / macOS / Linux).'
          : 'Cross-platform EdTech app: one codebase, five OSes (Android / iOS / Win / macOS / Linux).',
        stats: [
          { label: pt ? 'COMPARTILHADO' : 'SHARED', value: pt ? '~80% DO CÓDIGO' : '~80% CODE' },
          { label: pt ? 'BUILD DESKTOP' : 'DESKTOP BUILD', value: '-40%' },
          { label: 'STACK', value: 'IONIC / ANGULAR / ELECTRON' },
        ],
      },
      {
        name: 'REACT_GOOGLE_MAPS_API',
        company: 'React Google Maps API',
        kind: 'oss',
        url: 'https://github.com/JustFly1984/react-google-maps-api/pull/3266',
        description: pt
          ? 'Corrigi um loop infinito de re-renderização no exemplo da Directions API. O loop custava ao site de docs mais de 61 mil chamadas indesejadas à API do Google Maps. Correção com callback estável, mergeada pelo mantenedor.'
          : 'Fixed an infinite React re-render loop in the Directions API example. The loop cost the docs site 61K+ unwanted Google Maps API calls. Stable-callback fix, merged by the maintainer.',
        stats: [
          {
            label: pt ? 'BIBLIOTECA' : 'LIBRARY',
            value: pt ? '~1.8M DOWNLOADS SEMANAIS NPM' : '~1.8M WEEKLY NPM DOWNLOADS',
          },
          {
            label: pt ? 'CAUSA RAIZ' : 'ROOT CAUSE',
            value: pt
              ? 'NOVA IDENTIDADE DE CALLBACK A CADA RENDER'
              : 'NEW CALLBACK IDENTITY EVERY RENDER',
          },
          { label: pt ? 'STATUS' : 'STATUS', value: pt ? 'MERGEADA' : 'MERGED' },
        ],
      },
      {
        name: 'ERIKUNHA.DEV',
        company: 'Erikunha',
        kind: 'oss',
        url: 'https://github.com/erikunha/portfolio',
        description: pt
          ? 'Este portfólio. Next.js 16 App Router, React 19, RSC-first, um endpoint Anthropic com streaming no Vercel AI SDK e um harness de avaliação em CI que decide se ele sobe.'
          : 'This portfolio. Next.js 16 App Router, React 19, RSC-first, a streaming Anthropic endpoint on the Vercel AI SDK, and a CI eval harness that decides if it ships.',
        stats: [
          { label: pt ? 'ORÇAMENTO LCP' : 'LCP BUDGET', value: '< 1.8s' },
          { label: pt ? 'ORÇAMENTO INP' : 'INP BUDGET', value: '< 200ms' },
          { label: pt ? 'REGISTRO DE DECISÕES' : 'DECISION LOG', value: '130+ RECORDS' },
        ],
      },
      {
        name: 'LAIBEMAGE',
        company: 'Erikunha',
        kind: 'oss',
        url: 'https://github.com/erikunha/LAIbemage',
        description: pt
          ? 'CLI open-source em TypeScript (MIT) que classifica imagens entre sete provedores de visão LLM: confiança auto-obtida, escalada local-para-nuvem abaixo de 0.70, consenso de dois provedores, fila de aprendizado ativo.'
          : 'Open-source TypeScript CLI (MIT) classifying images across seven LLM vision providers: self-elicited confidence, local-to-cloud escalation below 0.70, two-provider consensus, active-learning queue.',
        stats: [
          { label: pt ? 'PROVEDORES' : 'PROVIDERS', value: '7' },
          { label: 'CI', value: pt ? '8 WORKFLOWS' : '8 WORKFLOWS' },
          { label: pt ? 'GATE' : 'GATE', value: pt ? 'REGRESSÃO DE 5%' : '5% REGRESSION' },
        ],
      },
    ]);
};

export const projects: Record<SiteLocale, Project[]> = {
  [SITE_LOCALE.en]: projectsFor(SITE_LOCALE.en),
  [SITE_LOCALE.pt]: projectsFor(SITE_LOCALE.pt),
};
