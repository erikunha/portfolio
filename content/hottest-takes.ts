import { z } from 'zod';
import { type HottestTake, HottestTakeSchema, TAKE_PLACEMENT } from './schemas';
import { SITE_LOCALE, type SiteLocale } from './site-locale';

const hottestTakesFor = (locale: SiteLocale): HottestTake[] => {
  const pt = locale === SITE_LOCALE.pt;
  return z.array(HottestTakeSchema).parse([
    {
      num: '01.',
      placement: TAKE_PLACEMENT.home,
      order: 1,
      category: 'ARCH',
      thesis: pt
        ? 'Angular é a escolha padrão certa para qualquer plataforma regulada em 2026.'
        : 'Angular is the right default for any regulated platform in 2026.',
      body: pt
        ? 'O ecossistema do React evolui mais rápido, mas é menos auditável. NgRx + RxJS entregam estado serializável por padrão, e isso importa quando um regulador intima o seu fluxo de depósito. O argumento "Angular é lento" é uma opinião de 2018 que sobreviveu à sua validade.'
        : 'React\'s ecosystem moves faster but is less audit-friendly. NgRx + RxJS give you serializable state by default, that matters when a regulator subpoenas your deposit flow. The "Angular is slow" argument is a 2018 take that survived past its expiration date.',
    },
    {
      num: '02.',
      placement: TAKE_PLACEMENT.home,
      order: 2,
      category: 'MFE',
      thesis: pt
        ? 'Micro-frontends são um problema de contrato, não de roteamento.'
        : 'Micro-frontends are a contract problem, not a routing problem.',
      body: pt
        ? 'A maioria dos times os adota por razões de Conway (temos 4 times, queremos 4 apps) e paga o imposto errado. A parte difícil são os contratos de eventos e a autenticação/estado compartilhados, não a configuração do Module Federation. Se os seus MFEs não podem ser deployados de forma independente sem uma matriz de versões em runtime, você construiu um monólito distribuído.'
        : "Most teams adopt them for Conway-shaped reasons (we have 4 teams, we want 4 apps) and pay the wrong tax. The hard part is event contracts and shared auth/state, not Module Federation config. If your MFEs can't be deployed independently without a runtime version matrix, you built a distributed monolith.",
    },
    {
      num: '03.',
      placement: TAKE_PLACEMENT.home,
      order: 3,
      category: 'TEST',
      thesis: pt
        ? 'A pirâmide de testes está errada para frontends B2C.'
        : 'The testing pyramid is wrong for B2C frontends.',
      body: pt
        ? 'Pirâmide invertida: muito E2E, poucos testes unitários, quase zero snapshots rasos, ganha quando a UX é o produto. Testes unitários pegam refatorações; E2E pega o que o cliente realmente vê. No cashier da Betsson, os fluxos de Playwright e WireMock me diziam se os pagamentos estavam em risco.'
        : 'Inverted pyramid: heavy E2E, lean units, near-zero shallow snapshots, wins when UX is the product. Unit tests catch refactors; E2E catches what the customer actually sees. On the Betsson cashier, Playwright and WireMock flows told me whether payments were at risk.',
    },
    {
      num: '07.',
      placement: TAKE_PLACEMENT.docs,
      order: 7,
      category: 'DS',
      thesis: pt
        ? 'Design systems framework-agnostic só vencem quando o contrato é o que está em produção, não teoria.'
        : 'Framework-agnostic design systems lose unless the contract is shipping, not theory.',
      body: pt
        ? 'Web Components só se pagam quando você tem mais de 1 framework consumindo-os em produção. Caso contrário, você comprou overhead de distribuição para resolver um problema que não tem. Stencil na Betsson funcionou porque Angular, React e Ember estavam de fato downstream, não porque alguém leu um blog post.'
        : "Web Components only pay off when you have >1 framework consuming them in production. Otherwise you bought distribution overhead to solve a problem you don't have. Stencil at Betsson worked because Angular, React, and Ember were all actually downstream, not because someone read a blog post.",
    },
    {
      num: '09.',
      placement: TAKE_PLACEMENT.home,
      order: 4,
      category: 'AI',
      thesis: pt
        ? 'Spec-first é a única forma disciplinada de entregar com LLMs e agentes.'
        : 'Spec-first is the only disciplined way to ship with LLMs and agents.',
      body: pt
        ? 'Vibe-coding gera output que ninguém consegue revisar. Spec-driven development inverte isso: escreva o contrato, o comportamento esperado e os modos de falha primeiro, e o agente implementa contra um alvo legível. A spec é o artefato de revisão, não o código gerado. Foi assim que dirigi um sistema de engenharia assistido por IA na Betsson: toda ação automatizada revisável. Sem a spec, você tem uma caixa-preta que não dá para auditar, não dá para reverter e não dá para passar adiante.'
        : 'Vibe-coding generates output nobody can review. Spec-driven development inverts it: write the contract, expected behavior, and failure modes first, then the agent implements against a legible target. The spec is the review artifact, not the generated code. That is how I ran an AI-assisted engineering system at Betsson: every automated action reviewable. Without the spec, you have a black box you cannot audit, cannot roll back, and cannot hand off.',
    },
  ]);
};

export const hottestTakes: Record<SiteLocale, HottestTake[]> = {
  [SITE_LOCALE.en]: hottestTakesFor(SITE_LOCALE.en),
  [SITE_LOCALE.pt]: hottestTakesFor(SITE_LOCALE.pt),
};

export const homeTakes = (locale: SiteLocale): HottestTake[] =>
  hottestTakes[locale]
    .filter((take) => take.placement === TAKE_PLACEMENT.home)
    .sort((left, right) => left.order - right.order);

const DESIGN_SYSTEM_CATEGORY = 'DS';

export const designSystemTake = (locale: SiteLocale): HottestTake | undefined =>
  hottestTakes[locale].find(
    (take) => take.category === DESIGN_SYSTEM_CATEGORY && take.placement === TAKE_PLACEMENT.docs,
  );

export const designSystemOpinionConfig = z
  .object({ topic: z.string().min(1) })
  .parse({ topic: 'design systems' });

const takesConfigFor = (locale: SiteLocale) => {
  const pt = locale === SITE_LOCALE.pt;
  return z
    .object({
      header: z.string().min(1),
      command: z.string().min(1),
      preamble: z.string().min(1),
      footer: z.string().min(1),
      docsLink: z.object({
        marker: z.string().min(1),
        label: z.string().min(1),
        href: z.string().startsWith('/'),
        arrow: z.string().min(1),
      }),
    })
    .parse({
      header: pt ? 'CAT ~/OPINIÕES.MD' : 'CAT ~/HOTTEST_TAKES.MD',
      command: pt ? 'cat ~/opinioes.md' : 'cat ~/hottest_takes.md',
      preamble: pt
        ? '// opiniões que defendo em entrevista de whiteboard'
        : "// opinions i'll defend in a whiteboard interview",
      footer: pt
        ? 'posso estar errado em qualquer uma delas. mas topo argumentar primeiro.'
        : 'willing to be wrong on any of these. willing to argue first.',
      docsLink: {
        marker: '>',
        label: pt
          ? 'a opinião sobre design system está na documentação do design system'
          : 'the design-system opinion lives in the design system docs',
        href: '/design-system#opinion-07',
        arrow: '→',
      },
    });
};

export const hottestTakesConfig: Record<SiteLocale, ReturnType<typeof takesConfigFor>> = {
  [SITE_LOCALE.en]: takesConfigFor(SITE_LOCALE.en),
  [SITE_LOCALE.pt]: takesConfigFor(SITE_LOCALE.pt),
};
