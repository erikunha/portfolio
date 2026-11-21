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
      `Rebuild the investor workflow screens of a private-markets platform (company, pipeline, comparison, outreach) on the Next.js App Router and React over a shared server-side data grid and URL-encoded view state, giving funds holding ${FUNDS_ASSETS} in assets one surface to shortlist, compare and contact founders, in Next.js 14 with TypeScript 5, TanStack, Plate, Tailwind CSS 4, Radix, Nx and Storybook, with Jest, React Testing Library, Playwright and Chromatic on Node.js 24`,
      "Deliver Fastify and TypeORM changes on PostgreSQL: a hand-written migration with a rehearsed backfill and tested rollback, and a team filter rewritten as an EXISTS subquery that raised one owner's matches from 14 to the correct 75",
      'Design the versioned view-state contract the data-grid pages share (sort, typed filters, search, column order and size, grouping, pagination), serialized into URL query params by namespaced TypeScript codecs so several tables coexist on one page, with a backward-compatible migration chain that falls back to a working default instead of throwing on a stale or malformed link',
      'Measure the data-platform migration on eight production builds run locally, four Next.js routes against their parent commits on one shared backend: button-name accessibility violations down to 1 on every route, from 55 on the worst, and on the pipelines route Cumulative Layout Shift (CLS) from 0.166 to zero, Largest Contentful Paint (LCP) from 2,544 to 1,308 ms and Lighthouse performance from 79 to 96, with performance flat on the other routes',
      'Engineer the table engine from zero, with one other engineer co-developing it from the second month: client mode on a TanStack Table core with no react-dom or JSX imports, and server mode on React Query with cancellable requests, deterministic caching, faceted filter counts and shape validation at the seam, held to 94.7% line and 85.4% branch coverage against library baselines of 85.4% and 65.8%',
      "Specify the grid's accessibility contract in design documents before code (decision records, an evidence log citing code by path and line, EARS acceptance criteria, a WCAG criterion-by-criterion table and a rollback plan keyed to a named signal): th headers with scope, aria-sort and an aria-live status region announcing the result range and sort, and roving-tabindex toolbars, built under jsdom unit tests, with flat and grouped rows virtualized over a native table element rather than display:grid to keep native table semantics",
      'Build the shared outreach editor on Plate and React, chosen over Lexical, TipTap and ProseMirror against an evidence log, holding personalization variables as elements of the Plate document tree, so authors see which fields resolve, and which fall back, before sending',
    ],
  },
  'career/betsson': {
    context: `Payment and cashier platform on the operator's proprietary Player Account Management system, under card-industry security audit (PCI-DSS), at a Nasdaq Stockholm-listed operator: ${PROFILE_FACT.groupRevenue} revenue and 31.1M registered customers in 2025, local licences in 24 countries, about 2,900 staff across 20 countries.`,
    highlights: [
      `Built the cashier micro-frontend platform every deposit and payout across the group's brands passes through, isolating per-brand orchestration from the shared payment primitives behind module boundaries, so each brand changed without touching payment code, on ${PROFILE_FACT.txPerYear} transactions a year, in Angular 19 and Nx with TypeScript, RxJS, NgRx, StencilJS Web Components and Storybook`,
      'Implemented the shared payment primitives as framework-agnostic StencilJS Web Components in TypeScript, driven by white-label configuration, rendering the right frontend per country, jurisdiction and product across 5+ brands, 8+ languages and 10+ currencies (zero-decimal ones included)',
      'Designed the multi-step deposit and withdrawal flows as async state machines in RxJS and NgRx, with recovery paths for failed steps, across 15+ regulated jurisdictions',
      'Integrated Trustly open-banking deposits for the Nordic markets as a StencilJS component configured per country and brand, and Yape payments for Peru, where Yape reaches about 16M monthly users (phone number plus app approval code, status polling, and handling for timed-out and declined payments), with WireMock and Playwright mocks of both providers',
      'Covered KYC and payment flows with Jest, Playwright and WireMock against mocked providers so provider outages and API changes never broke the suite, and enforced path-scoped standards with Husky Git hooks and secret scanning',
      'Built a 12-agent AI-assisted engineering system on GitHub Copilot spanning generation, review, debugging, testing and architecture validation, adopted across the team with every automated action reviewable',
    ],
  },
  'career/forward-deployed-engineer': {
    context:
      'Forward-deployed engineering on a hospital equipment maintenance platform: service orders and field service, with specialist scheduling, field visits and parts collection.',
    highlights: [
      'Rebuilt a hospital equipment maintenance platform as an Angular progressive web app in an Nx monorepo, replacing a legacy tool with layered domain, data, infrastructure and presentation code, so the rules for service orders, specialist schedules and field visits stayed free of framework code, on Angular 17 to 19 with TypeScript 5, RxJS, PrimeNG, Chart.js and WebSocket (STOMP/SockJS)',
      'Built specialist visit scheduling on Bryntum Scheduler, FullCalendar and the Google Maps API with travel-time checks, plus a 29-permission role-based access control (RBAC) model and an HTTP interceptor that retries with backoff and de-duplicates in-flight requests',
      'Automated releases with Bash, SSH and NGINX, cutting production updates from about 5 minutes to about 45 seconds and rollbacks to about 1 minute',
      'Staged the upgrade from Angular 17 to 19 and Nx 17 to 20 (52 of 54 components to OnPush with standalone components, signals and the new control flow) and built the operations dashboard and a customer-satisfaction module with a survey form builder, goals and metrics per client, with Lighthouse accessibility near 100',
      'Cut time to interactive about 52% by replacing waterfall request chains with concurrent RxJS loading and tuning change detection, and the bundle about 33%, layout-shell CSS about 98% and initial load about 25% through lazy loading and a PrimeFlex utility refactor',
    ],
  },
  'career/grupo-sbf': {
    context:
      "B3-listed owner of Centauro and of Fisia, Nike's exclusive Brazil distributor through 2034: R$7.9B gross revenue in 2022 with 31.9% of sales digital, and group storefronts holding 21% of Brazil's online fashion, apparel and footwear traffic.",
    highlights: [
      "Rebuilt Nike Brazil's storefront on Next.js and React behind a backend-for-frontend (BFF) gateway, on the commerce platform Grupo SBF shares with Centauro, cut over in a phased rollout, with server-side rendering, static generation and incremental static regeneration, in Next.js 12 to 13 with TypeScript, styled-components, NextAuth, Sentry, Nx, Webpack and Storybook",
      'Built the product listing, product detail and search pages, with filters, sorting, size grids and stock availability, and integrated a WebAR try-on into the purchase journey',
      `Kept the Nike and Centauro storefronts, serving ${PROFILE_FACT.peakMau} monthly users, isolated inside the shared Nx monorepo with enforced module boundaries, without forking the codebase, and built the design system they share with styled-components, Storybook and brand theming`,
      'Cut page load about 32% on storefronts carrying R$2.5B of 2022 digital revenue through Webpack code splitting, dynamic imports, image optimization and caching, with Core Web Vitals about 12% better, led by LCP',
      'Lifted e-commerce conversion about 10% through 20+ Google Optimize 360 A/B experiments fed by Google Analytics data layer events, each with pre-agreed stop-loss criteria',
      'Implemented technical SEO (schema.org structured data, meta tags, sitemaps, canonical URLs, incremental static regeneration for product pages) and data layer analytics (view_item, add_to_cart, purchase) feeding the conversion funnel and the A/B experiments',
      'Covered the four revenue-critical checkout journeys with Jest and React Testing Library integration tests against MSW-mocked APIs, at about 70% code coverage, and mentored four junior engineers on component patterns, testing and code review',
    ],
  },
  'career/encora': {
    context:
      "VMware Pathfinder, the self-service portal fronting VMware's Hands-on Labs, Test Drives and assessment tools across Tanzu, Anywhere Workspace and VMware Cloud on AWS: a catalogue of live interactive labs, retired after the Broadcom acquisition. Delivered from Daitan, acquired by Encora in July 2021.",
    highlights: [
      `Engineered VMware Pathfinder, the evaluation portal behind ${PROFILE_FACT.labsDelivered} labs, where customers run live labs in the browser before buying, on Angular 11 and NgRx with switchMap and exhaustMap effects that cancel stale requests and stop duplicate lab launches, with TypeScript, RxJS, Reactive Forms and i18n`,
      'Fed catalogue pages from CMS content so copy changed without a deploy, localized the portal through i18n, and instrumented funnel analytics for lab starts, completions and assessments',
      'Held unit-test coverage at about 70% with Karma and Jasmine on the workflows that gate a lab launch, and shipped through AWS CodeBuild to S3 and CloudFront with cache invalidation per release, per-environment configuration and frontend error monitoring',
    ],
  },
  'career/zup-itau': {
    context: `Itaú Unibanco's in-house engineering company, acquired in 2019 and 1,994 strong by the end of 2020, building for Latin America's largest bank: ${PROFILE_FACT.bankingClients} digital clients at the end of 2020, 1.2M of them businesses, selling partner insurers' policies through an open platform.`,
    highlights: [
      "Built micro-frontends to replace Itaú's legacy business insurance application journey by journey, packaged with Angular Elements as custom elements and rendered at runtime by the bank's internal host platform, in Angular 9 with TypeScript, RxJS and Reactive Forms",
      'Shipped each micro-frontend through its own AWS CodePipeline and CodeBuild pipeline to S3 and CloudFront, so it deployed on its own schedule instead of waiting for a full release of the web app',
      "Defined each micro-frontend's contract with the host platform (custom-element attributes in, DOM CustomEvents out) and drove each insurer's flow from configuration, so a new partner insurer needed no frontend code",
      "Built the offer showcase where businesses compare health, dental and life plans from 4+ partner insurers on Itaú's open platform (e.g. MetLife, Amil), each insurer's rules, fields and copy driven by configuration, plus quote forms validating CNPJ and covered lives",
      'Built proposal and policy tracking after contracting (status, pending items, documents), applied semantic HTML, ARIA and keyboard navigation across the screens, and covered the micro-frontends with Jasmine unit tests',
    ],
  },
  'career/venturus': {
    context:
      "Built through a non-profit Brazilian R&D institute born inside Ericsson in 1995, one of the country's largest private research and innovation centres, with Motorola and Sony among its clients. Transportation infrastructure: a toll-road concession with a 319.8 km corridor carrying 850,000 vehicles a day (2019). Agribusiness foreign trade: a B2B customs-documentation consultancy active since 1989.",
    highlights: [
      'Developed the Angular and NgRx traffic-monitoring dashboards for CCR AutoBAn (now Motiva), whose 24/7 control centre watches 106 cameras and 36 traffic sensors along a 319.8 km corridor carrying 850,000 vehicles a day, in Angular 8 with TypeScript and RxJS',
      "Replaced the concession's spreadsheet billing with an Angular workflow: CSV import and export in TypeScript, row-by-row validation before saving, and a monthly close that locked edits and totalled gross revenue, equivalent vehicles and average tariff",
      "Built CGO Assessoria's customs-compliance platform end to end, an Angular frontend over an Express REST API on PostgreSQL, cutting its reporting API from about 40s to under 1s and other endpoints from 2s to 200ms, in Angular 8 with TypeScript, RxJS, Node.js, Express, PostgreSQL, MongoDB, Pug, Docker Compose and JWT",
      'Built the API layer with input validation, central error middleware and paginated listings, with multi-step writes in database transactions and API integration tests',
      'Traced the slow Node.js reporting endpoint to how the ORM built its queries and fixed it by rewriting the queries and adding PostgreSQL indexes, instead of caching a slow read',
      'Migrated document-heavy workloads from MongoDB to relational PostgreSQL tables through a Node.js ETL pipeline that transformed and validated each record, validating the cutover by matching row counts and reports, with MongoDB read-only as the rollback path',
      'Modelled each foreign-trade process as a state machine (import licence, MAPA consent, release), with a document checklist per process type and deadline alerts, and generated the reports server-side in Node.js, with Pug templates rendered to PDF alongside Excel exports, emailing clients when a process changed status',
      "Built document upload per process and a dashboard of every client's processes, secured by JWT with an HTTP interceptor and route guards, and containerized the API and database with Docker Compose after environment drift kept producing machine-specific bugs",
    ],
  },
  'career/mb-labs': {
    context:
      "Custom builds by a Campinas software house, founded 2013, for fintech, retail and education clients. Education publishing: Edições SM, the Brazilian arm of Grupo SM, the Spanish educational publisher operating across Spain and nine Latin American markets. Retail workforce training: a B2B chat platform used across Cia Hering's 800+ stores.",
    highlights: [
      "Delivered SM Aprendizagem, Edições SM's offline-first textbook app for Android, iOS, Windows, macOS and Linux, as React Native and Electron shells over one TypeScript core in a Yarn Workspaces and Lerna monorepo, whose domain rules stayed free of React, Redux and platform APIs behind ports and ran under plain Node tests",
      'Built the offline book installer in native iOS and Android modules and the desktop main process, keeping ZIPs off the JavaScript bridge: resumable HTTP Range downloads, SHA-256 checks, extraction that blocks ../ paths and symlinks (Zip Slip), and versioned install folders with a journal reconciled at start-up, so the app never froze and never opened a half-installed book',
      "Hosted the publisher's interactive HTML books (iframes, exercises, forms) in a native reader on WKWebView, Android WebView and desktop Chromium with Node integration off, where a typed, validated message protocol from iframe to host turned each answer, right or wrong, each field edit and the reading position into semantic events, and built the sync that merges two devices' offline reading histories on reconnection, so a student's devices converge instead of the last one winning",
      "Built Hondana INDICA, a chat-based training platform for frontline retail staff across Cia Hering's 800+ stores, as a React PWA over a Node.js and Express API on MS SQL Server through Sequelize, ingesting chat webhooks and fanning campaigns out as push notifications, with an admin panel where the client created training campaigns and read each store's ratings, open-text answers and quiz answers",
      'Built the push dispatcher that fanned one campaign out to Firebase Cloud Messaging and Facebook Workplace, each channel with its own retry and backpressure, so a failure on one channel never dropped the campaign on the other',
      'Made webhook ingestion idempotent on the Workplace message id after redelivered webhooks counted the same answer twice',
    ],
  },
};

const experienceDetailPt: Record<string, ExperienceDetail> = {
  'career/raylu': {
    context: `Plataforma de originação de negócios com IA para mercados privados, usada por mais de ${FUNDS_SERVED} fundos de venture, growth e private equity com US$ ${ASSETS_UNDER_MANAGEMENT_BILLIONS}B+ em ativos para ir de uma tese de investimento a reuniões marcadas com fundadores, varrendo mais de 300.000 fontes. Série A de US$ 8M, auditada em segurança (SOC 2 Tipo I e II).`,
    highlights: [
      `Reconstruo as telas de fluxo de trabalho do investidor de uma plataforma de mercados privados (empresa, pipeline, comparação, prospecção) no App Router do Next.js e em React, sobre um data grid compartilhado no servidor e estado de visualização codificado na URL, dando a fundos com US$ ${ASSETS_UNDER_MANAGEMENT_BILLIONS}B+ em ativos uma única superfície para selecionar, comparar e contatar fundadores, em Next.js 14 com TypeScript 5, TanStack, Plate, Tailwind CSS 4, Radix, Nx e Storybook, com Jest, React Testing Library, Playwright e Chromatic em Node.js 24`,
      'Entrego mudanças em Fastify e TypeORM sobre PostgreSQL: uma migration escrita à mão com backfill ensaiado e rollback testado, e um filtro de time reescrito como subquery EXISTS que elevou de 14 para os 75 corretos as correspondências de um proprietário',
      'Projeto o contrato de estado de visualização versionado que as páginas de data grid compartilham (ordenação, filtros tipados, busca, ordem e tamanho de colunas, agrupamento, paginação), serializado em query params da URL por codecs TypeScript com namespace, para que várias tabelas convivam na mesma página, com uma cadeia de migração retrocompatível que recorre a um padrão funcional em vez de lançar erro diante de um link antigo ou malformado',
      'Meço a migração da plataforma de dados em oito builds de produção rodados localmente, quatro rotas Next.js contra os commits pai em um mesmo backend compartilhado: violações de acessibilidade de nome de botão reduzidas a 1 em todas as rotas, de 55 na pior, e, na rota de pipelines, o Cumulative Layout Shift (CLS) de 0,166 para zero, o Largest Contentful Paint (LCP) de 2.544 para 1.308 ms e a performance do Lighthouse de 79 para 96, com performance estável nas demais rotas',
      'Construo o motor de tabelas do zero, com outro engenheiro co-desenvolvendo a partir do segundo mês: modo cliente sobre um núcleo TanStack Table sem imports de react-dom ou JSX, e modo servidor em React Query com requisições canceláveis, cache determinístico, contagens de filtros facetados e validação de shape na fronteira, mantido em 94,7% de cobertura de linhas e 85,4% de ramos, contra bases de comparação de bibliotecas de 85,4% e 65,8%',
      'Especifico o contrato de acessibilidade do grid em documentos de design antes do código (registros de decisão, um log de evidências que cita o código por caminho e linha, critérios de aceite em EARS, uma tabela WCAG critério a critério e um plano de rollback atrelado a um sinal nomeado): cabeçalhos th com scope, aria-sort e uma região de status aria-live que anuncia o intervalo de resultados e a ordenação, e toolbars com roving tabindex, construído sob testes unitários em jsdom, com linhas planas e agrupadas virtualizadas sobre um elemento table nativo em vez de display:grid para preservar a semântica nativa de tabela',
      'Construo o editor de prospecção compartilhado em Plate e React, escolhido entre Lexical, TipTap e ProseMirror a partir de um log de evidências, mantendo as variáveis de personalização como elementos da árvore de documento do Plate, para que os autores vejam quais campos serão resolvidos, e quais recorrem a um padrão, antes do envio',
    ],
  },
  'career/betsson': {
    context:
      'Plataforma de pagamentos e cashier sobre o sistema proprietário de Player Account Management da operadora, sob auditoria de segurança do setor de cartões (PCI-DSS), em uma operadora listada na Nasdaq Estocolmo: receita de €1,197B e 31,1M de clientes registrados em 2025, licenças locais em 24 países, cerca de 2.900 funcionários em 20 países.',
    highlights: [
      `Construí a plataforma de micro-frontends do cashier por onde passam todos os depósitos e saques das marcas do grupo, isolando a orquestração de cada marca das primitivas de pagamento compartilhadas atrás de limites de módulo, para que cada marca mudasse sem tocar no código de pagamento, em ${PROFILE_FACT.txPerYear} transações por ano, em Angular 19 e Nx com TypeScript, RxJS, NgRx, Web Components StencilJS e Storybook`,
      'Implementei as primitivas de pagamento compartilhadas como Web Components StencilJS agnósticos de framework em TypeScript, conduzidas por configuração white-label, renderizando o frontend certo por país, jurisdição e produto em mais de 5 marcas, mais de 8 idiomas e mais de 10 moedas (inclusive as sem casas decimais)',
      'Desenhei os fluxos de depósito e saque em várias etapas como máquinas de estado assíncronas em RxJS e NgRx, com caminhos de recuperação para etapas que falham, em mais de 15 jurisdições reguladas',
      'Integrei depósitos open banking da Trustly para os mercados nórdicos como um componente StencilJS configurado por país e marca, e pagamentos Yape para o Peru, onde o Yape alcança cerca de 16M de usuários mensais (número de telefone mais código de aprovação no app, polling de status e tratamento de pagamentos expirados e recusados), com mocks de WireMock e Playwright dos dois provedores',
      'Cobri os fluxos de KYC e pagamento com Jest, Playwright e WireMock contra provedores simulados, para que quedas de provedor e mudanças de API nunca quebrassem a suíte, e impus padrões por caminho com hooks Git do Husky e varredura de segredos',
      'Construí um sistema de engenharia assistido por IA com 12 agentes no GitHub Copilot, cobrindo geração, revisão, depuração, testes e validação de arquitetura, adotado pelo time com toda ação automatizada revisável',
    ],
  },
  'career/forward-deployed-engineer': {
    context:
      'Engenharia implantada em uma plataforma de manutenção de equipamentos hospitalares: ordens de serviço e serviço em campo, com agendamento de especialistas, visitas de campo e coleta de peças.',
    highlights: [
      'Reconstruí uma plataforma de manutenção de equipamentos hospitalares como um progressive web app Angular em um monorepo Nx, substituindo uma ferramenta legada por código em camadas de domínio, dados, infraestrutura e apresentação, para que as regras de ordens de serviço, agendas de especialistas e visitas de campo ficassem livres de código de framework, em Angular 17 a 19 com TypeScript 5, RxJS, PrimeNG, Chart.js e WebSocket (STOMP/SockJS)',
      'Construí o agendamento de visitas de especialistas em Bryntum Scheduler, FullCalendar e a API do Google Maps com checagem de tempo de deslocamento, além de um modelo de controle de acesso baseado em papéis (RBAC) com 29 permissões e um interceptor HTTP que refaz tentativas com backoff e elimina requisições duplicadas em andamento',
      'Automatizei releases com Bash, SSH e NGINX, reduzindo atualizações de produção de cerca de 5 minutos para cerca de 45 segundos e rollbacks para cerca de 1 minuto',
      'Conduzi a atualização do Angular 17 para o 19 e do Nx 17 para o 20 em etapas (52 de 54 componentes em OnPush com componentes standalone, signals e o novo control flow) e construí o dashboard operacional e um módulo de satisfação do cliente com construtor de formulários de pesquisa, metas e métricas por cliente, com acessibilidade no Lighthouse próxima de 100',
      'Reduzi o time to interactive em cerca de 52% trocando cadeias de requisições em cascata por carregamento concorrente em RxJS e ajustando a change detection, e o bundle em cerca de 33%, o CSS do shell de layout em cerca de 98% e o carregamento inicial em cerca de 25% com lazy loading e uma refatoração para utilitários PrimeFlex',
    ],
  },
  'career/grupo-sbf': {
    context:
      'Dona da Centauro e da Fisia, distribuidora exclusiva da Nike no Brasil até 2034, listada na B3: R$ 7,9B de receita bruta em 2022, com 31,9% das vendas digitais, e storefronts do grupo com 21% do tráfego online brasileiro de moda, vestuário e calçados.',
    highlights: [
      'Reconstruí o storefront da Nike Brasil em Next.js e React atrás de um gateway backend-for-frontend (BFF), sobre a plataforma de commerce que o Grupo SBF compartilha com a Centauro, com virada em lançamento por fases, com server-side rendering, geração estática e regeneração estática incremental, em Next.js 12 a 13 com TypeScript, styled-components, NextAuth, Sentry, Nx, Webpack e Storybook',
      'Construí as páginas de listagem, detalhe de produto e busca, com filtros, ordenação, grades de tamanho e disponibilidade em estoque, e integrei um provador de realidade aumentada na web (WebAR) à jornada de compra',
      `Mantive os storefronts da Nike e da Centauro, com ${PROFILE_FACT.peakMau} usuários mensais, isolados dentro do monorepo Nx compartilhado por limites de módulo impostos, sem bifurcar o código, e construí o design system que eles compartilham com styled-components, Storybook e tematização por marca`,
      'Reduzi o carregamento de página em cerca de 32% em storefronts que carregavam R$ 2,5B da receita digital de 2022, com code splitting do Webpack, dynamic imports, otimização de imagens e cache, com os Core Web Vitals cerca de 12% melhores, puxados pelo LCP',
      'Elevei a conversão do e-commerce em cerca de 10% com mais de 20 experimentos A/B no Google Optimize 360 alimentados por eventos de data layer do Google Analytics, cada um com critérios de stop-loss combinados de antemão',
      'Implementei SEO técnico (dados estruturados schema.org, meta tags, sitemaps, URLs canônicas, regeneração estática incremental para páginas de produto) e analytics de data layer (view_item, add_to_cart, purchase) que alimentavam o funil de conversão e os experimentos A/B',
      'Cobri as quatro jornadas de checkout críticas para a receita com testes de integração em Jest e React Testing Library contra APIs simuladas com MSW, com cerca de 70% de cobertura de código, e mentorei quatro desenvolvedores juniores em padrões de componentes, testes e revisão de código',
    ],
  },
  'career/encora': {
    context:
      'VMware Pathfinder, o portal de autoatendimento à frente dos Hands-on Labs, Test Drives e ferramentas de avaliação da VMware em Tanzu, Anywhere Workspace e VMware Cloud on AWS: um catálogo de labs interativos ao vivo, desativado após a aquisição pela Broadcom. Entregue pela Daitan, adquirida pela Encora em julho de 2021.',
    highlights: [
      `Desenvolvi o VMware Pathfinder, o portal de avaliação por trás de ${localizeDecimals(PROFILE_FACT.labsDelivered, SITE_LOCALE.pt)} labs, onde clientes executam labs ao vivo no navegador antes de comprar, em Angular 11 e NgRx com efeitos switchMap e exhaustMap que cancelam requisições obsoletas e impedem inícios duplicados de lab, com TypeScript, RxJS, Reactive Forms e i18n`,
      'Alimentei as páginas do catálogo com conteúdo de CMS para que o texto mudasse sem deploy, localizei o portal com i18n e instrumentei analytics do funil para inícios de lab, conclusões e avaliações',
      'Mantive cerca de 70% de cobertura de testes unitários com Karma e Jasmine nos fluxos que liberam o início de um lab, e entreguei com AWS CodeBuild para S3 e CloudFront com invalidação de cache a cada release, configuração por ambiente e monitoramento de erros do frontend',
    ],
  },
  'career/zup-itau': {
    context: `Empresa de engenharia interna do Itaú Unibanco, adquirida em 2019 e com 1.994 pessoas ao fim de 2020, construindo para o maior banco da América Latina: ${localizeDecimals(PROFILE_FACT.bankingClients, SITE_LOCALE.pt)} de clientes digitais ao fim de 2020, 1,2M deles empresas, vendendo apólices de seguradoras parceiras por uma plataforma aberta.`,
    highlights: [
      'Construí micro-frontends para substituir, jornada a jornada, a jornada legada de contratação de seguro empresarial do Itaú, empacotados com Angular Elements como custom elements e renderizados em tempo de execução pela plataforma host interna do banco, em Angular 9 com TypeScript, RxJS e Reactive Forms',
      'Entreguei cada micro-frontend por seu próprio pipeline de AWS CodePipeline e CodeBuild até S3 e CloudFront, para que fosse publicado no seu próprio ritmo, sem esperar um release completo do web app',
      'Defini o contrato de cada micro-frontend com a plataforma host (atributos de custom element na entrada, CustomEvents do DOM na saída) e conduzi o fluxo de cada seguradora por configuração, de modo que uma nova seguradora parceira não exigia código frontend',
      'Construí a vitrine de ofertas em que empresas comparam planos de saúde, odontológicos e de vida de mais de 4 seguradoras parceiras na plataforma aberta do Itaú (ex.: MetLife, Amil), com regras, campos e textos de cada seguradora conduzidos por configuração, além de formulários de cotação que validam CNPJ e vidas cobertas',
      'Construí o acompanhamento de propostas e apólices após a contratação (status, pendências, documentos), apliquei HTML semântico, ARIA e navegação por teclado nas telas e cobri os micro-frontends com testes unitários em Jasmine',
    ],
  },
  'career/venturus': {
    context:
      'Construído por um instituto brasileiro de P&D sem fins lucrativos nascido dentro da Ericsson em 1995, um dos maiores centros privados de pesquisa e inovação do país, com Motorola e Sony entre seus clientes. Infraestrutura de transporte: uma concessão de rodovia com corredor de 319,8 km e 850.000 veículos por dia (2019). Comércio exterior do agronegócio: uma consultoria B2B de documentação aduaneira, ativa desde 1989.',
    highlights: [
      'Desenvolvi os dashboards de monitoramento de tráfego em Angular e NgRx da CCR AutoBAn (hoje Motiva), cujo centro de controle 24/7 acompanha 106 câmeras e 36 sensores de tráfego ao longo de um corredor de 319,8 km com 850.000 veículos por dia, em Angular 8 com TypeScript e RxJS',
      'Substituí o faturamento em planilhas da concessão por um fluxo em Angular: importação e exportação de CSV em TypeScript, validação linha a linha antes de salvar e um fechamento mensal que travava edições e totalizava receita bruta, veículos equivalentes e tarifa média',
      'Construí de ponta a ponta a plataforma de conformidade aduaneira da CGO Assessoria, um frontend Angular sobre uma API REST em Express com PostgreSQL, reduzindo a API de relatórios de cerca de 40s para menos de 1s e outros endpoints de 2s para 200ms, em Angular 8 com TypeScript, RxJS, Node.js, Express, PostgreSQL, MongoDB, Pug, Docker Compose e JWT',
      'Construí a camada de API com validação de entrada, middleware central de erros e listagens paginadas, com escritas em várias etapas dentro de transações de banco e testes de integração da API',
      'Rastreei o endpoint lento de relatórios em Node.js até a forma como o ORM montava as queries e o corrigi reescrevendo as queries e criando índices no PostgreSQL, em vez de colocar em cache uma leitura lenta',
      'Migrei cargas com muitos documentos do MongoDB para tabelas relacionais no PostgreSQL com um pipeline ETL em Node.js que transformava e validava cada registro, conferindo a virada por contagens de linhas e relatórios, com o MongoDB em somente leitura como caminho de rollback',
      'Modelei cada processo de comércio exterior como máquina de estados (licença de importação, anuência do MAPA, liberação), com checklist de documentos por tipo de processo e alertas de prazo, e gerei os relatórios no servidor em Node.js, com templates Pug renderizados em PDF junto com exportações em Excel, enviando e-mail aos clientes quando um processo mudava de status',
      'Construí o upload de documentos por processo e um dashboard com os processos de cada cliente, protegidos por JWT com interceptor HTTP e route guards, e containerizei a API e o banco com Docker Compose depois que a divergência entre ambientes continuou gerando bugs específicos de cada máquina',
    ],
  },
  'career/mb-labs': {
    context:
      'Software house de Campinas, fundada em 2013, construindo produtos sob medida para clientes de fintech, varejo e educação. Entregue para as Edições SM, o braço brasileiro do Grupo SM, a editora educacional espanhola que atua na Espanha e em nove mercados latino-americanos. Treinamento de equipes de varejo: uma plataforma B2B de chat usada nas mais de 800 lojas da Cia Hering.',
    highlights: [
      'Entreguei o SM Aprendizagem, app de livros didáticos offline-first das Edições SM para Android, iOS, Windows, macOS e Linux, como shells React Native e Electron sobre um único núcleo TypeScript em um monorepo Yarn Workspaces e Lerna, cujas regras de domínio ficavam livres de React, Redux e APIs de plataforma atrás de portas e rodavam em testes Node puros',
      'Construí o instalador de livros offline em módulos nativos de iOS e Android e no processo principal do desktop, mantendo os ZIPs fora da ponte JavaScript: downloads retomáveis com HTTP Range, verificação SHA-256, extração que bloqueia caminhos ../ e symlinks (Zip Slip) e pastas de instalação versionadas com um journal reconciliado na inicialização, para que o app nunca travasse nem abrisse um livro instalado pela metade',
      'Hospedei os livros HTML interativos da editora (iframes, exercícios, formulários) em um leitor nativo sobre WKWebView, Android WebView e Chromium no desktop com a integração Node desligada, onde um protocolo de mensagens tipado e validado do iframe ao host transformava cada resposta, certa ou errada, cada edição de campo e a posição de leitura em eventos semânticos, e construí a sincronização que mescla os históricos de leitura offline de dois dispositivos na reconexão, para que os dispositivos de um aluno convirjam em vez de o último vencer',
      'Construí o Hondana INDICA, plataforma de treinamento por chat para equipes de linha de frente nas mais de 800 lojas da Cia Hering, como um PWA em React sobre uma API Node.js e Express com MS SQL Server via Sequelize, recebendo webhooks de chat e distribuindo campanhas como notificações push, com um painel administrativo em que o cliente criava campanhas de treinamento e lia as avaliações, respostas abertas e respostas de quiz de cada loja',
      'Construí o dispatcher de push que distribuía uma mesma campanha para o Firebase Cloud Messaging e o Facebook Workplace, cada canal com seu próprio retry e backpressure, para que a falha de um canal nunca derrubasse a campanha no outro',
      'Tornei a ingestão de webhooks idempotente pelo id da mensagem do Workplace depois que webhooks reentregues contaram a mesma resposta duas vezes',
    ],
  },
};

export const experienceDetail: Record<SiteLocale, Record<string, ExperienceDetail>> = {
  [SITE_LOCALE.en]: experienceDetailEn,
  [SITE_LOCALE.pt]: experienceDetailPt,
};
