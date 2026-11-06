import {
  ASSETS_UNDER_MANAGEMENT_BILLIONS,
  FUNDS_SERVED,
  localizeDecimals,
  PROFILE_FACT,
} from './profile';
import { SITE_LOCALE, type SiteLocale } from './site-locale';

export type ExperienceDetail = { context: string; highlights: string[] };

const FUNDS_ASSETS = `$${ASSETS_UNDER_MANAGEMENT_BILLIONS}B+`;

const experienceDetailEn: Record<string, ExperienceDetail> = {
  'career/raylu': {
    context: `AI deal origination platform for private markets, used by ${FUNDS_SERVED}+ venture, growth and private equity funds holding ${FUNDS_ASSETS} in assets to go from an investment thesis to booked founder meetings, scanning 300,000+ sources. $8M Series A, security-audited (SOC 2 Type I and II).`,
    highlights: [
      `Rebuild the investor workflow screens of a private-markets platform (company, pipeline, comparison, outreach), giving funds holding ${FUNDS_ASSETS} in assets one surface to shortlist, compare and contact founders, in React and Next.js 14 with TypeScript 5, TanStack, Plate, Tailwind CSS 4, Radix, Nx and Storybook`,
      "Deliver backend changes on Fastify, TypeORM and PostgreSQL: a hand-written migration with a rehearsed backfill and tested rollback, and an EXISTS-subquery fix that raised one owner's team-filter matches from 14 to the correct 75",
      'Design the versioned view-state contract those data-dense pages share, encoding sort, filters, search, columns and grouping in URL-safe TypeScript codecs, with a backward-compatible migration chain, so every shared or stale link resolves to a working view',
      "Ship the data-platform migration behind a production A/B across four Next.js routes, cutting controls without an accessible name from 55 to 1, Cumulative Layout Shift (CLS) from 0.166 to zero, one route's Largest Contentful Paint (LCP) from 2,544 to 1,308 ms and Lighthouse performance from 79 to 96",
      'Engineer the table engine, client mode on TanStack Table and server mode on React Query with cancellable requests, deterministic caching and faceted filter counts, to 94.7% line and 85.4% branch coverage against library baselines of 85.4% and 65.8%',
      "Specify the grid's accessibility in design documents before code (WAI-ARIA grid and row headers, roving-tabindex toolbars, live-region sort announcements), and virtualize rows over a real table element",
      'Build the shared outreach editor on Plate and React, holding personalization as document structure so authors see which fields resolve before sending',
    ],
  },
  'career/betsson': {
    context: `Payment and cashier platform on the operator's proprietary Player Account Management system, under card-industry security audit (PCI-DSS), at a Nasdaq Stockholm-listed operator: ${PROFILE_FACT.groupRevenue} revenue and 31.1M registered customers in 2025, local licences in 24 countries, about 2,900 staff across 20 countries.`,
    highlights: [
      `Built the cashier micro-frontend platform every deposit and payout across the group's brands passes through, isolating brand orchestration from shared payment primitives on ${PROFILE_FACT.txPerYear} transactions a year, in Angular 19 with TypeScript, RxJS, NgRx, StencilJS Web Components, Storybook and Nx`,
      'Designed the multi-step deposit and withdrawal flows as async state machines in RxJS and NgRx, with recovery paths for failed steps, across 15+ regulated jurisdictions',
      'Integrated Trustly open-banking deposits for the Nordic markets and Yape payments for Peru (app approval code, status polling and timeout handling), with WireMock and Playwright mocks of both providers',
      'Built a 12-agent AI-assisted engineering system on GitHub Copilot spanning generation, review, debugging, testing and architecture validation, adopted across the team with every automated action reviewable',
    ],
  },
  'career/canon-medical': {
    context:
      "Consulting for Canon Medical Systems, Canon Inc.'s medical imaging business with ¥580.6B of FY2025 net sales: the service-order and field-service platform its engineers maintain imaging equipment at hospitals through, with specialist scheduling, field visits and parts collection.",
    highlights: [
      "Rebuilt Canon Medical's hospital equipment service platform, replacing a legacy tool with a layered domain, data and presentation architecture for service orders, specialist schedules and field visits, as a progressive web app on Angular 17 to 19 with TypeScript 5, RxJS, PrimeNG, Chart.js, FullCalendar, Bryntum Scheduler, the Google Maps API, WebSocket (STOMP/SockJS) and Nx",
      'Built specialist visit scheduling with travel-time checks, plus a 29-permission security-profile model and an HTTP interceptor that retries with backoff and de-duplicates in-flight requests',
      'Automated releases with Bash, SSH and NGINX, cutting production updates from about 5 minutes to about 45 seconds and rollbacks to about 1 minute',
      'Cut time to interactive about 52% with concurrent RxJS loading and change-detection tuning, and the bundle about 33%, layout-shell CSS about 98% and initial load about 25% by lazy loading and PrimeFlex utilities',
    ],
  },
  'career/grupo-sbf': {
    context:
      "B3-listed owner of Centauro and of Fisia, Nike's exclusive Brazil distributor through 2034: R$7.9B gross revenue in 2022 with 31.9% of sales digital, and group storefronts holding 21% of Brazil's online fashion, apparel and footwear traffic.",
    highlights: [
      "Rebuilt Nike Brazil's storefront behind a backend-for-frontend (BFF) gateway, including the listing, product detail and search pages, cut over in a phased rollout, in React and Next.js 12 to 13 (server-side rendering, static generation and incremental static regeneration) with TypeScript, styled-components, NextAuth, Nx, Webpack and Storybook",
      `Kept the Nike and Centauro storefronts, serving ${PROFILE_FACT.peakMau} monthly users, isolated inside the shared Nx monorepo by enforced module boundaries`,
      'Cut page load about 32% on storefronts carrying R$2.5B of 2022 digital revenue through Next.js code splitting, image optimization and caching, improving Core Web Vitals about 12%',
      'Lifted conversion about 10% across 20+ Google Optimize 360 A/B experiments, each with pre-agreed stop-loss criteria',
      'Implemented technical SEO (schema.org data, sitemaps, canonical URLs, incremental static regeneration) and data layer analytics feeding the funnel and the A/B experiments, and covered the four revenue-critical checkout journeys at about 70% coverage with Jest and MSW',
    ],
  },
  'career/encora': {
    context:
      "VMware Pathfinder, the self-service portal fronting VMware's Hands-on Labs, Test Drives and assessment tools across Tanzu, Anywhere Workspace and VMware Cloud on AWS: a catalogue of live interactive labs, retired after the Broadcom acquisition. Delivered from Daitan, acquired by Encora in July 2021.",
    highlights: [
      `Engineered VMware Pathfinder, the evaluation portal behind ${PROFILE_FACT.labsDelivered} labs, where customers run live labs in the browser before buying, in Angular 11 with TypeScript, RxJS, NgRx, Reactive Forms and i18n`,
      'Fed catalogue pages from CMS content so copy changed without a deploy, and held unit-test coverage at about 70% with Karma and Jasmine on the workflows that gate a lab launch',
    ],
  },
  'career/zup-itau': {
    context: `Itaú Unibanco's in-house engineering company, acquired in 2019 and 1,994 strong by the end of 2020, building for Latin America's largest bank: ${PROFILE_FACT.bankingClients} digital clients at the end of 2020, 1.2M of them businesses, selling partner insurers' policies through an open platform.`,
    highlights: [
      "Built micro-frontends to replace Itaú's legacy business insurance application journey by journey, packaged as custom elements and rendered at runtime by the bank's internal host platform, in Angular 9 and Angular Elements with TypeScript, RxJS and Reactive Forms",
      'Shipped each micro-frontend through its own AWS CodePipeline and CodeBuild pipeline to S3 and CloudFront, so it deployed on its own schedule',
      "Defined each micro-frontend's contract with the host platform (custom-element attributes in, DOM CustomEvents out) and drove each insurer's flow from configuration, so a new partner insurer needed no frontend code",
      'Built the offer showcase comparing plans from 4+ partner insurers (e.g. MetLife, Amil), plus quote forms validating CNPJ and covered lives',
    ],
  },
  'career/venturus': {
    context:
      'Built through a non-profit R&D institute. Transportation infrastructure: a toll-road concession with a 319.8 km corridor carrying 850,000 vehicles a day (2019). Agribusiness foreign trade: a B2B customs-documentation consultancy active since 1989.',
    highlights: [
      'Developed the traffic-monitoring dashboards for CCR AutoBAn (now Motiva), whose 24/7 control centre watches 106 cameras and 36 traffic sensors along a 319.8 km corridor carrying 850,000 vehicles a day, in Angular 8 with TypeScript, RxJS and NgRx',
      "Replaced the concession's spreadsheet billing with an Angular workflow: CSV import and export in TypeScript, row-by-row validation before saving, and a monthly close that locked edits and totalled gross revenue, equivalent vehicles and average tariff",
      "Built CGO Assessoria's customs-compliance platform, cutting its reporting API from about 40s to under 1s and other endpoints from 2s to 200ms, in Angular 8 with TypeScript, RxJS, Node.js, Express, PostgreSQL, MongoDB and JWT",
      'Traced the slow reporting endpoint to how the ORM queried the data and fixed it by rewriting the queries and adding PostgreSQL indexes, instead of caching a slow read',
      'Migrated document-heavy workloads from MongoDB to PostgreSQL with a Node.js ETL pipeline, validating the cutover by matching row counts and reports, with MongoDB read-only as the rollback path',
    ],
  },
  'career/mb-labs': {
    context:
      "Custom builds by a software house. Education publishing: Grupo SM, operating across Spain and nine Latin American markets. Retail workforce training: a B2B chat platform used across Cia Hering's 800+ stores.",
    highlights: [
      "Architected Edições SM's offline-first learning app for Android, iOS, Windows, macOS and Linux, sharing about 80% of the code, cutting desktop build time about 40%, on Ionic 3, Angular and Electron with TypeScript, Cordova, SQLite and REST APIs",
      "Built the offline content pipeline with Cordova file I/O and SQLite (resumable book-bundle downloads, catalogue and reading position stored locally) and the sync that merges two devices' offline reading histories on reconnection, so a student's devices converge instead of the last one winning",
      "Built the frontend and backend services for Hondana INDICA, the training chatbot used across Cia Hering's 800+ stores, in React with Node.js, Express, Webhooks, Firebase Cloud Messaging and MS SQL Server",
      "Built the Node.js dispatcher that fans one training push out to Firebase Cloud Messaging and Facebook Workplace, with retry and backpressure per channel, so one channel's failure never dropped a campaign",
      'Fixed duplicate Workplace webhook deliveries that double-counted answers, making ingestion idempotent on the message id',
    ],
  },
};

const experienceDetailPt: Record<string, ExperienceDetail> = {
  'career/raylu': {
    context: `Plataforma de originação de negócios com IA para mercados privados, usada por mais de ${FUNDS_SERVED} fundos de venture, growth e private equity com US$ ${ASSETS_UNDER_MANAGEMENT_BILLIONS}B+ em ativos para ir de uma tese de investimento a reuniões marcadas com fundadores, varrendo mais de 300.000 fontes. Série A de US$ 8M, auditada em segurança (SOC 2 Tipo I e II).`,
    highlights: [
      `Reconstruo as telas de fluxo de trabalho do investidor de uma plataforma de mercados privados (empresa, pipeline, comparação, prospecção), dando a fundos com US$ ${ASSETS_UNDER_MANAGEMENT_BILLIONS}B+ em ativos uma única superfície para selecionar, comparar e contatar fundadores, em React e Next.js 14 com TypeScript 5, TanStack, Plate, Tailwind CSS 4, Radix, Nx e Storybook`,
      'Entrego mudanças de backend em Fastify, TypeORM e PostgreSQL: uma migration escrita à mão com backfill ensaiado e rollback testado, e a correção de uma subquery EXISTS que elevou de 14 para os 75 corretos as correspondências do filtro de time de um proprietário',
      'Projeto o contrato de estado de visualização versionado que essas páginas densas em dados compartilham, codificando ordenação, filtros, busca, colunas e agrupamento em codecs TypeScript seguros para URL, com uma cadeia de migração retrocompatível, para que todo link compartilhado ou antigo abra uma visualização funcional',
      'Entrego a migração da plataforma de dados atrás de um A/B em produção em quatro rotas Next.js, reduzindo de 55 para 1 os controles sem nome acessível, o Cumulative Layout Shift (CLS) de 0,166 para zero, o Largest Contentful Paint (LCP) de uma rota de 2.544 para 1.308 ms e a performance do Lighthouse de 79 para 96',
      'Construo o motor de tabelas, modo cliente em TanStack Table e modo servidor em React Query com requisições canceláveis, cache determinístico e contagens de filtros facetados, com 94,7% de cobertura de linhas e 85,4% de ramos, contra bases de comparação de bibliotecas de 85,4% e 65,8%',
      'Especifico a acessibilidade do grid em documentos de design antes do código (grid e cabeçalhos de linha WAI-ARIA, barras de ferramentas com roving tabindex, anúncios de ordenação em live region) e virtualizo linhas sobre um elemento table real',
      'Construo o editor de prospecção compartilhado em Plate e React, mantendo a personalização como estrutura do documento para que os autores vejam quais campos serão resolvidos antes do envio',
    ],
  },
  'career/betsson': {
    context:
      'Plataforma de pagamentos e cashier sobre o sistema proprietário de Player Account Management da operadora, sob auditoria de segurança do setor de cartões (PCI-DSS), em uma operadora listada na Nasdaq Estocolmo: receita de €1,197B e 31,1M de clientes registrados em 2025, licenças locais em 24 países, cerca de 2.900 funcionários em 20 países.',
    highlights: [
      `Construí a plataforma de micro-frontends do cashier por onde passam todos os depósitos e saques das marcas do grupo, isolando a orquestração de marca das primitivas de pagamento compartilhadas em ${PROFILE_FACT.txPerYear} transações por ano, em Angular 19 com TypeScript, RxJS, NgRx, Web Components StencilJS, Storybook e Nx`,
      'Desenhei os fluxos de depósito e saque em várias etapas como máquinas de estado assíncronas em RxJS e NgRx, com caminhos de recuperação para etapas que falham, em mais de 15 jurisdições reguladas',
      'Integrei depósitos open banking da Trustly para os mercados nórdicos e pagamentos Yape para o Peru (código de aprovação no app, polling de status e tratamento de timeout), com mocks de WireMock e Playwright dos dois provedores',
      'Construí um sistema de engenharia assistido por IA com 12 agentes no GitHub Copilot, cobrindo geração, revisão, depuração, testes e validação de arquitetura, adotado pelo time com toda ação automatizada revisável',
    ],
  },
  'career/canon-medical': {
    context:
      'Consultoria para a Canon Medical Systems, negócio de imagens médicas da Canon Inc. com ¥580,6B de vendas líquidas no ano fiscal de 2025: a plataforma de ordens de serviço e serviço em campo por onde seus engenheiros mantêm equipamentos de imagem em hospitais, com agendamento de especialistas, visitas de campo e coleta de peças.',
    highlights: [
      'Reconstruí a plataforma de serviço de equipamentos hospitalares da Canon Medical, substituindo uma ferramenta legada por uma arquitetura em camadas de domínio, dados e apresentação para ordens de serviço, agendas de especialistas e visitas de campo, como um progressive web app em Angular 17 a 19 com TypeScript 5, RxJS, PrimeNG, Chart.js, FullCalendar, Bryntum Scheduler, a API do Google Maps, WebSocket (STOMP/SockJS) e Nx',
      'Construí o agendamento de visitas de especialistas com checagem de tempo de deslocamento, além de um modelo de perfis de segurança com 29 permissões e um interceptor HTTP que refaz tentativas com backoff e elimina requisições duplicadas em andamento',
      'Automatizei releases com Bash, SSH e NGINX, reduzindo atualizações de produção de cerca de 5 minutos para cerca de 45 segundos e rollbacks para cerca de 1 minuto',
      'Reduzi o time to interactive em cerca de 52% com carregamento concorrente em RxJS e ajuste de change detection, e o bundle em cerca de 33%, o CSS do shell de layout em cerca de 98% e o carregamento inicial em cerca de 25% com lazy loading e utilitários PrimeFlex',
    ],
  },
  'career/grupo-sbf': {
    context:
      'Dona da Centauro e da Fisia, distribuidora exclusiva da Nike no Brasil até 2034, listada na B3: R$ 7,9B de receita bruta em 2022, com 31,9% das vendas digitais, e storefronts do grupo com 21% do tráfego online brasileiro de moda, vestuário e calçados.',
    highlights: [
      'Reconstruí o storefront da Nike Brasil atrás de um gateway backend-for-frontend (BFF), incluindo as páginas de listagem, detalhe de produto e busca, com virada em lançamento por fases, em React e Next.js 12 a 13 (server-side rendering, geração estática e regeneração estática incremental) com TypeScript, styled-components, NextAuth, Nx, Webpack e Storybook',
      `Mantive os storefronts da Nike e da Centauro, com ${PROFILE_FACT.peakMau} usuários mensais, isolados dentro do monorepo Nx compartilhado por limites de módulo impostos`,
      'Reduzi o carregamento de página em cerca de 32% em storefronts que carregavam R$ 2,5B da receita digital de 2022, com code splitting do Next.js, otimização de imagens e cache, melhorando os Core Web Vitals em cerca de 12%',
      'Elevei a conversão em cerca de 10% em mais de 20 experimentos A/B no Google Optimize 360, cada um com critérios de stop-loss combinados de antemão',
      'Implementei SEO técnico (dados schema.org, sitemaps, URLs canônicas, regeneração estática incremental) e analytics de data layer que alimentavam o funil e os experimentos A/B, e cobri as quatro jornadas de checkout críticas para a receita com cerca de 70% de cobertura em Jest e MSW',
    ],
  },
  'career/encora': {
    context:
      'VMware Pathfinder, o portal de autoatendimento à frente dos Hands-on Labs, Test Drives e ferramentas de avaliação da VMware em Tanzu, Anywhere Workspace e VMware Cloud on AWS: um catálogo de labs interativos ao vivo, desativado após a aquisição pela Broadcom. Entregue pela Daitan, adquirida pela Encora em julho de 2021.',
    highlights: [
      `Desenvolvi o VMware Pathfinder, o portal de avaliação por trás de ${localizeDecimals(PROFILE_FACT.labsDelivered, SITE_LOCALE.pt)} labs, onde clientes executam labs ao vivo no navegador antes de comprar, em Angular 11 com TypeScript, RxJS, NgRx, Reactive Forms e i18n`,
      'Alimentei as páginas do catálogo com conteúdo de CMS para que o texto mudasse sem deploy, e mantive cerca de 70% de cobertura de testes unitários com Karma e Jasmine nos fluxos que liberam o início de um lab',
    ],
  },
  'career/zup-itau': {
    context: `Empresa de engenharia interna do Itaú Unibanco, adquirida em 2019 e com 1.994 pessoas ao fim de 2020, construindo para o maior banco da América Latina: ${localizeDecimals(PROFILE_FACT.bankingClients, SITE_LOCALE.pt)} de clientes digitais ao fim de 2020, 1,2M deles empresas, vendendo apólices de seguradoras parceiras por uma plataforma aberta.`,
    highlights: [
      'Construí micro-frontends para substituir, jornada a jornada, a jornada legada de contratação de seguro empresarial do Itaú, empacotados como custom elements e renderizados em tempo de execução pela plataforma host interna do banco, em Angular 9 e Angular Elements com TypeScript, RxJS e Reactive Forms',
      'Entreguei cada micro-frontend por seu próprio pipeline de AWS CodePipeline e CodeBuild até S3 e CloudFront, para que fosse publicado no seu próprio ritmo',
      'Defini o contrato de cada micro-frontend com a plataforma host (atributos de custom element na entrada, CustomEvents do DOM na saída) e conduzi o fluxo de cada seguradora por configuração, de modo que uma nova seguradora parceira não exigia código frontend',
      'Construí a vitrine de ofertas que compara planos de mais de 4 seguradoras parceiras (ex.: MetLife, Amil), além de formulários de cotação que validam CNPJ e vidas cobertas',
    ],
  },
  'career/venturus': {
    context:
      'Construído por um instituto de P&D sem fins lucrativos. Infraestrutura de transporte: uma concessão de rodovia com corredor de 319,8 km e 850.000 veículos por dia (2019). Comércio exterior do agronegócio: uma consultoria B2B de documentação aduaneira, ativa desde 1989.',
    highlights: [
      'Desenvolvi os dashboards de monitoramento de tráfego da CCR AutoBAn (hoje Motiva), cujo centro de controle 24/7 acompanha 106 câmeras e 36 sensores de tráfego ao longo de um corredor de 319,8 km com 850.000 veículos por dia, em Angular 8 com TypeScript, RxJS e NgRx',
      'Substituí o faturamento em planilhas da concessão por um fluxo em Angular: importação e exportação de CSV em TypeScript, validação linha a linha antes de salvar e um fechamento mensal que travava edições e totalizava receita bruta, veículos equivalentes e tarifa média',
      'Construí a plataforma de conformidade aduaneira da CGO Assessoria, reduzindo a API de relatórios de cerca de 40s para menos de 1s e outros endpoints de 2s para 200ms, em Angular 8 com TypeScript, RxJS, Node.js, Express, PostgreSQL, MongoDB e JWT',
      'Rastreei o endpoint lento de relatórios até a forma como o ORM consultava os dados e o corrigi reescrevendo as queries e criando índices no PostgreSQL, em vez de colocar em cache uma leitura lenta',
      'Migrei cargas com muitos documentos do MongoDB para o PostgreSQL com um pipeline ETL em Node.js, validando a virada pela conferência de contagens de linhas e relatórios, com o MongoDB em somente leitura como caminho de rollback',
    ],
  },
  'career/mb-labs': {
    context:
      'Projetos sob medida de uma software house. Publicação educacional: Grupo SM, presente na Espanha e em nove mercados latino-americanos. Treinamento de equipes de varejo: uma plataforma B2B de chat usada nas mais de 800 lojas da Cia Hering.',
    highlights: [
      'Projetei o app de aprendizado offline-first das Edições SM para Android, iOS, Windows, macOS e Linux, compartilhando cerca de 80% do código e reduzindo o tempo de build desktop em cerca de 40%, em Ionic 3, Angular e Electron com TypeScript, Cordova, SQLite e APIs REST',
      'Construí o pipeline de conteúdo offline com I/O de arquivos do Cordova e SQLite (downloads retomáveis de pacotes de livros, catálogo e posição de leitura guardados localmente) e a sincronização que mescla os históricos de leitura offline de dois dispositivos na reconexão, para que os dispositivos de um aluno convirjam em vez de o último vencer',
      'Construí os serviços de frontend e backend do Hondana INDICA, o chatbot de treinamento usado nas mais de 800 lojas da Cia Hering, em React com Node.js, Express, Webhooks, Firebase Cloud Messaging e MS SQL Server',
      'Construí o dispatcher em Node.js que distribui um mesmo push de treinamento para o Firebase Cloud Messaging e o Facebook Workplace, com retry e backpressure por canal, para que a falha de um canal nunca derrubasse uma campanha',
      'Corrigi entregas duplicadas de webhook do Workplace que contavam respostas em dobro, tornando a ingestão idempotente pelo id da mensagem',
    ],
  },
};

export const experienceDetail: Record<SiteLocale, Record<string, ExperienceDetail>> = {
  [SITE_LOCALE.en]: experienceDetailEn,
  [SITE_LOCALE.pt]: experienceDetailPt,
};
