import { z } from 'zod';
import { companyLinkCopy } from './company-link';
import { localizeDecimals, PROFILE_FACT } from './profile';
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
    externalDisclosure: companyLinkCopy[SITE_LOCALE.en].disclosure,
  },
  [SITE_LOCALE.pt]: {
    command: 'LS -LA ./PROJETOS',
    mobileCommand: 'LS -LA ~/PROJETOS',
    permissions: 'drwxr-xr-x',
    externalDisclosure: companyLinkCopy[SITE_LOCALE.pt].disclosure,
  },
};

const projectsFor = (locale: SiteLocale): Project[] => {
  const pt = locale === SITE_LOCALE.pt;
  return z
    .array(ProjectSchema)
    .length(11)
    .parse([
      {
        name: 'ORIGINATION_PLATFORM_UI',
        company: 'Raylu',
        kind: 'professional',
        description: pt
          ? 'Telas de fluxo de trabalho do investidor na plataforma de originação de negócios com IA da Raylu para mercados privados: empresa, pipeline, comparação, prospecção. Motor de tabelas compartilhado e estado de visualização na URL para fundos com mais de US$ 500B em ativos.'
          : "Investor workflow screens on Raylu's AI deal origination platform for private markets: company, pipeline, comparison, outreach. Shared table engine and URL-backed view state for funds holding $500B+ in assets.",
        stats: [
          {
            label: pt ? 'SUPERFÍCIES' : 'SURFACES',
            value: pt ? 'EMPRESA / PIPELINE / PROSPECÇÃO' : 'COMPANY / PIPELINE / OUTREACH',
          },
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
          { label: 'VOLUME', value: `${PROFILE_FACT.txPerYear} ${pt ? 'TX / ANO' : 'TX / YR'}` },
          {
            label: pt ? 'RECEITA' : 'REVENUE',
            value: `${localizeDecimals(PROFILE_FACT.groupRevenue, locale)} (${pt ? 'GRUPO' : 'GROUP'})`,
          },
          { label: 'STACK', value: 'ANGULAR / STENCIL / NGRX / NX' },
        ],
      },
      {
        name: 'SERVICE_OPS_CONSOLE',
        company: 'Forward Deployed Engineer',
        kind: 'professional',
        description: pt
          ? 'Plataforma de serviço de equipamentos hospitalares: ordens de serviço, agendamento de especialistas com checagem de deslocamento, visitas de campo, perfis de segurança com 29 permissões, atualizações ao vivo.'
          : 'Hospital equipment service platform: service orders, specialist scheduling with travel-time checks, field visits, a 29-permission security-profile model, live updates.',
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
          { label: pt ? 'ALCANCE' : 'REACH', value: `${PROFILE_FACT.peakMau} MAU` },
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
          ? 'Sistema de engenharia com 12 agentes no GitHub Copilot, cobrindo geração, revisão, depuração, testes e validação de arquitetura. Toda ação automatizada é revisável. Adotado por todo o time na Betsson.'
          : '12-agent GitHub Copilot engineering system across generation, review, debugging, testing and architecture validation. Every automated action reviewable. Adopted team-wide at Betsson.',
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
            value: pt ? '~1,8M DOWNLOADS SEMANAIS NPM' : '~1.8M WEEKLY NPM DOWNLOADS',
          },
          {
            label: pt ? 'CAUSA' : 'CAUSE',
            value: pt
              ? 'NOVA IDENTIDADE DE CALLBACK A CADA RENDER'
              : 'NEW CALLBACK IDENTITY EVERY RENDER',
          },
          { label: 'STATUS', value: pt ? 'MERGEADA' : 'MERGED' },
        ],
      },
      {
        name: 'ERIKUNHA.DEV',
        company: 'Erikunha',
        kind: 'oss',
        url: 'https://github.com/erikunha/portfolio',
        description: pt
          ? 'Este portfólio, um endpoint Anthropic governado e seu harness de avaliação. Um gate de prompt injection rejeita antes da inferência, um detector de vazamento em streaming sobrevive a limites de chunk e há um kill switch. O CI avalia o endpoint com um juiz LLM calibrado em rótulos humanos (piso de concordância de 0,85), com correção travada em 0,9, resistência a jailbreak em 1,0 e teto de US$ 2 de custo por job.'
          : 'This portfolio, a governed Anthropic endpoint and its eval harness. A prompt-injection gate rejects before inference, a streaming leak detector survives chunk boundaries, and a kill switch is in place. CI grades the endpoint with an LLM judge calibrated on human labels (0.85 agreement floor), with correctness gated at 0.9, jailbreak resistance at 1.0 and a $2 per-job cost cap.',
        stats: [
          {
            label: pt ? 'JUIZ LLM' : 'LLM JUDGE',
            value: pt ? 'CONCORDÂNCIA >= 0,85' : 'AGREEMENT >= 0.85',
          },
          { label: pt ? 'GATE JAILBREAK' : 'JAILBREAK GATE', value: pt ? '1,0' : '1.0' },
          { label: pt ? 'TETO POR JOB' : 'PER-JOB CAP', value: pt ? 'US$ 2' : '$2' },
        ],
      },
      {
        name: 'LAIBEMAGE',
        company: 'Erikunha',
        kind: 'oss',
        url: 'https://github.com/erikunha/LAIbemage',
        description: pt
          ? 'CLI open-source em TypeScript (MIT) que classifica imagens entre sete provedores de visão LLM: confiança auto-obtida, escalada local-para-nuvem abaixo de 0,70, consenso de dois provedores, fila de aprendizado ativo.'
          : 'Open-source TypeScript CLI (MIT) classifying images across seven LLM vision providers: self-elicited confidence, local-to-cloud escalation below 0.70, two-provider consensus, active-learning queue.',
        stats: [
          { label: pt ? 'PROVEDORES' : 'PROVIDERS', value: '7' },
          { label: 'CI', value: '8 WORKFLOWS' },
          { label: 'GATE', value: pt ? 'REGRESSÃO DE 5%' : '5% REGRESSION' },
        ],
      },
      {
        name: 'LEDGERLENS',
        company: 'Erikunha',
        kind: 'oss',
        url: 'https://github.com/erikunha/ledgerlens',
        description: pt
          ? 'Agente Python open-source (MIT) que investiga reclamações de pagamento: text-to-SQL somente leitura atrás de um guard, busca em políticas, câmbio de referência e uma calculadora em Decimal, e um verificador confere cada afirmação contra a evidência citada e escala para revisão humana por regra. Nunca altera dados e roda offline, sem chaves. Em trinta casos, correção de 0,82 contra 0,55 de um agente ReAct, mas trajetória de ferramentas em 0,73 contra uma meta de 0,80. Trinta casos mostram uma tendência, não significância estatística.'
          : 'Open-source Python agent (MIT) that investigates payment complaints: read-only text-to-SQL behind a guard, policy search, reference exchange rates and a Decimal calculator, then a verifier checks every claim against its cited evidence and escalates to human review by rule. It never changes data and runs offline with no keys. On thirty cases, 0.82 correctness against 0.55 for a ReAct agent, but tool trajectory 0.73 against a 0.80 target. Thirty cases show a trend, not significance.',
        stats: [
          {
            label: pt ? 'CORREÇÃO' : 'CORRECTNESS',
            value: pt ? '0,82 CONTRA 0,55 REACT' : '0.82 VS 0.55 REACT',
          },
          { label: pt ? 'REVISÃO HUMANA' : 'HUMAN REVIEW', value: pt ? '9,3 DE 30' : '9.3 OF 30' },
          { label: 'STACK', value: 'PYTHON / LANGCHAIN' },
        ],
      },
      {
        name: 'VAULT_OF_LOCI',
        company: 'Erikunha',
        kind: 'oss',
        url: 'https://github.com/erikunha/vault-of-loci',
        description: pt
          ? 'Template de vault do Obsidian open-source (MIT, Python) em que os agentes de IA dão aula em vez de responder: um AGENTS.md conduz sete ferramentas de agente, a tentativa vem antes da dica e a revelação espera a nota de confiança. Um teste de 17 cenários, avaliado por um modelo de outra família, segura as regras de tutor, e um ledger mede retenção em 7, 30 e 90 dias.'
          : 'Open-source Obsidian vault template (MIT, Python) where AI agents tutor instead of answering: one AGENTS.md drives seven agent tools, the attempt comes before the hint, and the reveal waits for a confidence rating. A 17-scenario test graded by a model of another family holds the tutor rules, and a ledger measures retention at 7, 30 and 90 days.',
        stats: [
          { label: pt ? 'CENÁRIOS' : 'SCENARIOS', value: '17' },
          { label: pt ? 'BARRA' : 'PASS BAR', value: '28/34' },
          { label: pt ? 'FERRAMENTAS' : 'AGENT TOOLS', value: '7 · ONE AGENTS.MD' },
        ],
      },
    ]);
};

export const projects: Record<SiteLocale, Project[]> = {
  [SITE_LOCALE.en]: projectsFor(SITE_LOCALE.en),
  [SITE_LOCALE.pt]: projectsFor(SITE_LOCALE.pt),
};
