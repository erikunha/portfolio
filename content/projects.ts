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
          ? 'Este portfólio: um endpoint Anthropic em produção, em streaming, sobre o Haiku 5.5 e o Vercel AI SDK, e o harness que decide se ele vai para produção. O CI avalia o endpoint contra o modelo vivo num corpus de casos factuais, de limite, de jailbreak e de validação de saída, com correção travada em 0,9 e resistência a jailbreak em 1,0. Um juiz LLM calibrado em rótulos humanos é travado em casos de referência construídos em torno de armadilhas (uma omissão por pouco, um extra inventado, um número errado): abaixo de 0,85 de concordância ou de uma taxa de verdadeiros negativos de 11 em 12, a execução para, e cada resposta chega dentro de uma cerca aleatória por chamada, para que não possa instruir o próprio avaliador. Guardrails: um gate de prompt injection na borda da requisição, um detector de vazamento em streaming que sobrevive a limites de chunk, versionamento de prompt por hash de conteúdo e detecção de model drift, um orçamento de gasto reservado no Redis antes de cada chamada ao modelo, que falha fechado quando o Redis cai, e um kill switch. Um servidor MCP expõe o endpoint como ferramenta.'
          : 'This portfolio: a production streaming Anthropic endpoint on Haiku 5.5 and the Vercel AI SDK, and the harness that decides whether it ships. CI grades the endpoint against the live model over a corpus of factual, edge, jailbreak and output-validation cases, with correctness gated at 0.9 and jailbreak resistance at 1.0. An LLM judge calibrated on human labels is gated on gold cases built around traps (a near-miss omission, a fabricated extra, a wrong number): below 0.85 agreement or an 11 of 12 true-negative rate the run stops, and each answer arrives inside a random per-call fence so it cannot instruct its own grader. Guardrails: a prompt-injection gate at the request boundary, a streaming leak detector that survives chunk boundaries, content-hashed prompt versioning and model-drift detection, a spend budget reserved in Redis before every model call that fails closed when the store is down, and a kill switch. An MCP server exposes the endpoint as a tool.',
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
          ? 'CLI open-source em TypeScript (MIT) que classifica imagens entre sete provedores de visão LLM, um estudo de como tornar auditável um pipeline probabilístico: confiança auto-obtida, escalada local-para-nuvem abaixo de 0,70 ou diante de um rótulo desconhecido, consenso de dois provedores resolvido pela confiança, fila de aprendizado ativo.'
          : 'Open-source TypeScript CLI (MIT) classifying images across seven LLM vision providers, a study in making a probabilistic pipeline auditable: self-elicited confidence, local-to-cloud escalation below 0.70 or on an unknown label, two-provider consensus resolved by confidence, active-learning queue.',
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
          ? 'Template de vault do Obsidian open-source (MIT, Python) em que os agentes de IA dão aula em vez de responder: um AGENTS.md conduz cinco ferramentas de agente, a tentativa vem antes da dica e a revelação espera a nota de confiança. Um teste de 17 cenários, avaliado por um modelo de outra família, segura as regras de tutor, e um ledger mede retenção em 7, 30 e 90 dias.'
          : 'Open-source Obsidian vault template (MIT, Python) where AI agents tutor instead of answering: one AGENTS.md drives five agent tools, the attempt comes before the hint, and the reveal waits for a confidence rating. A 17-scenario test graded by a model of another family holds the tutor rules, and a ledger measures retention at 7, 30 and 90 days.',
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
