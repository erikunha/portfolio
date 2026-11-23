import { z } from 'zod';
import { companyLinkCopy } from './company-link';
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
    .length(5)
    .parse([
      {
        name: 'REACT_GOOGLE_MAPS_API',
        company: 'React Google Maps API',
        kind: 'oss',
        url: 'https://github.com/JustFly1984/react-google-maps-api/pull/3266',
        description: pt
          ? 'Diagnostiquei um loop infinito de re-renderização no exemplo da Directions API. O loop custava ao site de docs mais de 61 mil chamadas indesejadas à API do Google Maps. Rastreei até uma prop de callback com nova identidade a cada render, reproduzi em um StackBlitz mínimo e entreguei a correção com callback estável, revisada e mergeada pelo mantenedor.'
          : 'Diagnosed an infinite React re-render loop in the Directions API example. The loop cost the docs site 61K+ unwanted Google Maps API calls. Traced it to a callback prop with a new identity on every render, reproduced it on a minimal StackBlitz and shipped the stable-callback fix, reviewed and merged by the maintainer.',
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
          ? 'Este portfólio roda um endpoint Anthropic em produção sobre o Haiku 5.5 e o Vercel AI SDK, e o CI decide se ele vai ao ar: avalia o endpoint contra o modelo vivo, com correção travada em 0,9, jailbreak em 1,0 e um juiz LLM calibrado em rótulos humanos. Guardrails: gate de prompt injection, detector de vazamento, orçamento de gasto que falha fechado e kill switch.'
          : 'This portfolio runs a production Anthropic endpoint on Haiku 5.5 and the Vercel AI SDK, and CI decides whether it ships: it grades the endpoint against the live model, gating correctness at 0.9 and jailbreak resistance at 1.0, with an LLM judge calibrated on human labels. Guardrails: a prompt-injection gate, a leak detector, a fail-closed spend budget and a kill switch.',
        stats: [
          {
            label: pt ? 'JUIZ LLM' : 'LLM JUDGE',
            value: pt ? 'CONCORDÂNCIA >= 0,85' : 'AGREEMENT >= 0.85',
          },
          { label: pt ? 'GATE JAILBREAK' : 'JAILBREAK GATE', value: pt ? '1,0' : '1.0' },
          { label: pt ? 'TNR DO JUIZ' : 'JUDGE TNR', value: '>= 11/12' },
        ],
      },
      {
        name: 'VISIONLENS',
        company: 'Erikunha',
        kind: 'oss',
        url: 'https://github.com/erikunha/VisionLens',
        description: pt
          ? 'Um pipeline probabilístico de visão é difícil de auditar. Este CLI open-source em TypeScript (MIT) classifica imagens entre sete provedores LLM, cada resposta com confiança auto-obtida. Escala de local para nuvem abaixo de 0,70 ou com rótulo desconhecido, resolve o consenso de dois provedores pela confiança e alimenta uma fila de aprendizado ativo.'
          : 'A probabilistic vision pipeline is hard to audit. This open-source TypeScript CLI (MIT) classifies images across seven LLM providers, each answer with a self-elicited confidence. It escalates from local to cloud below 0.70 or on an unknown label, resolves two-provider consensus by confidence and feeds an active-learning queue.',
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
          ? 'Este agente Python open-source (MIT) investiga reclamações de pagamento com text-to-SQL somente leitura atrás de um guard, e um verificador confere cada afirmação contra a evidência citada, escalando para revisão humana por regra. Em trinta casos: correção de 0,82 contra 0,55 de um agente ReAct, mas trajetória de ferramentas em 0,73 contra uma meta de 0,80. Trinta casos mostram uma tendência, não significância estatística.'
          : 'This open-source Python agent (MIT) investigates payment complaints with read-only text-to-SQL behind a guard, and a verifier checks every claim against its cited evidence, escalating to human review by rule. On thirty cases: 0.82 correctness against 0.55 for a ReAct agent, but tool trajectory 0.73 against a 0.80 target. Thirty cases show a trend, not significance.',
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
          ? 'Agentes de IA costumam responder, não ensinar. Neste template de vault do Obsidian open-source (MIT, Python), um AGENTS.md conduz cinco ferramentas de agente: a tentativa vem antes da dica e a revelação espera a nota de confiança. Um teste de 17 cenários, avaliado por um modelo de outra família, segura as regras de tutor, e um ledger mede retenção em 7, 30 e 90 dias.'
          : 'AI agents tend to answer instead of teach. In this open-source Obsidian vault template (MIT, Python), one AGENTS.md drives five agent tools: the attempt comes before the hint and the reveal waits for a confidence rating. A 17-scenario test graded by a model of another family holds the tutor rules, and a ledger measures retention at 7, 30 and 90 days.',
        stats: [
          { label: pt ? 'CENÁRIOS' : 'SCENARIOS', value: '17' },
          { label: pt ? 'BARRA' : 'PASS BAR', value: '28/34' },
          {
            label: pt ? 'FERRAMENTAS' : 'AGENT TOOLS',
            value: pt ? '5 · UM AGENTS.MD' : '5 · ONE AGENTS.MD',
          },
        ],
      },
    ]);
};

export const projects: Record<SiteLocale, Project[]> = {
  [SITE_LOCALE.en]: projectsFor(SITE_LOCALE.en),
  [SITE_LOCALE.pt]: projectsFor(SITE_LOCALE.pt),
};
