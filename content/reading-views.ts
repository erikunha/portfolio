import { communityEvent } from './community';
import { credentials } from './credentials';
import { education } from './education';
import { gitLog, workModeLabel } from './git-log';
import { heroContent } from './hero';
import { HIRE_ACCESSIBLE_NAME, NAV_VOCABULARY } from './nav';
import {
  formatLanguages,
  profile,
  profileCityLine,
  profileLocation,
  profilePresentation,
} from './profile';
import { projects } from './projects';
import { READING_PATHS } from './reading-paths';
import {
  CvDocumentSchema,
  CvJsonLdSchema,
  type ReadingViews,
  ReadingViewsSchema,
  SummaryDocumentSchema,
} from './schemas';
import { localizedPath, SITE_LOCALE, type SiteLocale } from './site-locale';
import { social } from './social';

export { READING_PATHS };

const SITE_ORIGIN_PATTERN = /^(https?:\/\/)www\./;
const PROTOCOL_PATTERN = /^https?:\/\//;
const TRAILING_PERIOD_PATTERN = /\.$/;
const TERMINAL_PUNCTUATION_PATTERN = /[.!?]$/;
const FRAGMENT_SEPARATOR_PATTERN = /;\s+/;
const STACK_SEPARATOR = ' · ';
const WORD_SEPARATOR = '_';

const readingViewsFor = (locale: SiteLocale): ReadingViews => {
  const pt = locale === SITE_LOCALE.pt;
  const presentation = profilePresentation[locale];
  return ReadingViewsSchema.parse({
    shared: {
      skipLabel: pt ? 'Pular para o conteúdo' : 'Skip to main content',
      navLabel: pt ? 'Navegação do site' : 'Site navigation',
      nav: [
        { label: NAV_VOCABULARY[locale].about, href: localizedPath(locale, '/#sec-readme') },
        { label: NAV_VOCABULARY[locale].work, href: localizedPath(locale, '/#sec-projects') },
        { label: NAV_VOCABULARY[locale].career, href: localizedPath(locale, '/#sec-git-log') },
        { label: NAV_VOCABULARY[locale].contact, href: localizedPath(locale, '/#sec-contact') },
        { label: NAV_VOCABULARY[locale].designSystem, href: '/design-system' },
      ],
      hire: {
        label: NAV_VOCABULARY[locale].hire,
        ariaLabel: HIRE_ACCESSIBLE_NAME[locale],
        href: social.linkedin,
      },
      printLabel: pt ? 'IMPRIMIR / SALVAR PDF' : 'PRINT / SAVE PDF',
      newTabRel: 'noopener noreferrer',
      newTabHint: pt ? '(abre em uma nova guia)' : '(opens in a new tab)',
      ogImage: { path: '/og.png', width: 1200, height: 630 },
    },
    cv: {
      path: localizedPath(locale, READING_PATHS.cv),
      title: pt ? `Currículo · ${profile.displayName}` : `CV · ${profile.displayName}`,
      description: pt
        ? `${profile.displayName}, ${presentation.title}. Currículo legível e imprimível.`
        : `${profile.displayName}, ${profile.title}. Readable, printable CV.`,
      summaryLinkLabel: NAV_VOCABULARY[locale].summary,
      headings: {
        summary: pt ? 'Resumo' : 'Summary',
        experience: pt ? 'Experiência' : 'Experience',
        skills: pt ? 'Habilidades' : 'Skills',
        certifications: pt ? 'Certificações' : 'Certifications',
        community: pt ? 'Comunidade' : 'Community',
        education: pt ? 'Formação' : 'Education',
        contact: pt ? 'Contato' : 'Contact',
      },
      credentialLabels: {
        ANGULAR_DEV: pt ? 'Desenvolvedor Angular' : 'Angular Developer',
        ENGLISH: pt ? 'Inglês' : 'English',
        INTL_DEGREE: pt ? 'Diploma internacional' : 'International degree',
      },
      proseOverrides: pt
        ? {
            'buscava escala de produto ai-native': 'Entrou para escalar um produto AI-native.',
            'buscava escala regulada em múltiplos mercados':
              'Entrou para atuar em escala regulada e multi-mercado.',
            'obteve 40m+ transações/ano em mais de 15 jurisdições e 31,1m clientes em uma plataforma de pagamentos pci-dss':
              'Entregou uma plataforma de pagamentos PCI-DSS com 40M+ transações por ano em mais de 15 jurisdições e 31,1M clientes.',
            'reconstruiu uma plataforma de serviço de equipamentos hospitalares: ordens de serviço, agendamento de especialistas, visitas de campo':
              'Reconstruiu uma plataforma de serviço de equipamentos hospitalares.',
            'angular 17 para 19': 'Atualizou a plataforma de Angular 17 para 19.',
            'primeiro trabalho regulado / bancário': 'Primeiro trabalho bancário regulado.',
            'começou no backend': 'Começou no backend.',
            'api de relatórios de 40s para <1s':
              'Cortou uma API de relatórios de 40s para menos de 1s.',
            'migração mongodb para postgresql com pipeline etl em node.js':
              'Migrou MongoDB para PostgreSQL com um pipeline ETL em Node.js.',
            'primeiro emprego. telas de back-office em vue.js 2 para mais de 1.600 agências de turismo brasileiras':
              'Primeiro emprego: telas de back-office em Vue.js 2 para mais de 1.600 agências de turismo brasileiras.',
          }
        : {
            'wanted ai-native product scale': 'Joined to scale an AI-native product.',
            'wanted regulated multi-market scale':
              'Joined to work at regulated, multi-market scale.',
            'got 40m+ tx/yr across 15+ jurisdictions and 31.1m customers on a pci-dss payment platform':
              'Shipped a PCI-DSS payment platform handling 40M+ transactions a year across 15+ jurisdictions and 31.1M customers.',
            'angular 17 to 19': 'Upgraded the platform from Angular 17 to 19.',
            'next.js storefronts for nike brazil and centauro (8m+ mau)':
              'Shipped Next.js storefronts for Nike Brazil and Centauro (8M+ MAU).',
            'vmware pathfinder lab portal on angular 11':
              'Shipped the VMware Pathfinder lab portal on Angular 11.',
            'ngrx effects, reactive forms, 2.1m+ labs':
              'Used NgRx effects and Reactive Forms across 2.1M+ labs.',
            'first regulated / banking work': 'First regulated banking work.',
            "angular elements micro-frontends for itaú's business insurance (24.2m digital clients)":
              "Shipped Angular Elements micro-frontends for Itaú's business insurance (24.2M digital clients).",
            'cut teeth on backend': 'Started on the backend.',
            'reporting api 40s → <1s': 'Cut a reporting API from 40s to under 1s.',
            'mongodb → postgresql migration with a node.js etl pipeline':
              'Migrated MongoDB to PostgreSQL with a Node.js ETL pipeline.',
            'first job. vue.js 2 back-office screens for 1,600+ brazilian travel agencies':
              'First role: Vue.js 2 back-office screens for 1,600+ Brazilian travel agencies.',
          },
    },
    summary: {
      path: localizedPath(locale, READING_PATHS.summary),
      title: pt ? `Resumo de 30s · ${profile.displayName}` : `30s summary · ${profile.displayName}`,
      description: pt
        ? `${profile.displayName}, ${presentation.title}. Números, projetos, stack e contato em uma tela.`
        : `${profile.displayName}, ${profile.title}. Stats, projects, stack and contact on one screen.`,
      cvLinkLabel: pt ? 'VER_CV' : 'VIEW_CV',
      statsLabel: pt ? 'Números-chave' : 'Key numbers',
      experienceLabel: pt ? 'mais de 8 anos' : '8+ years',
      projectNames: ['PAYMENT_ORCHESTRA', 'SERVICE_OPS_CONSOLE', 'AI_AGENT_MESH'],
      stack: [
        'REACT',
        'NEXT.JS',
        'TS',
        'NODE',
        'ANGULAR',
        'AWS',
        'POSTGRES',
        'PLAYWRIGHT',
        'A11Y',
        'CLAUDE',
      ],
      headings: {
        projects: pt ? 'Projetos' : 'Projects',
        stack: pt ? 'Stack' : 'Tech stack',
        contact: pt ? 'Contato' : 'Contact',
      },
    },
  });
};

export const readingViews: Record<SiteLocale, ReadingViews> = {
  [SITE_LOCALE.en]: readingViewsFor(SITE_LOCALE.en),
  [SITE_LOCALE.pt]: readingViewsFor(SITE_LOCALE.pt),
};

const capitalise = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

export const toSentence =
  (locale: SiteLocale) =>
  (fragment: string): string => {
    const key = fragment.trim().replace(TRAILING_PERIOD_PATTERN, '').toLowerCase();
    const override = readingViews[locale].cv.proseOverrides[key];
    if (override) return override;
    const sentence = capitalise(fragment.trim());
    return TERMINAL_PUNCTUATION_PATTERN.test(sentence) ? sentence : `${sentence}.`;
  };

const spaced = (label: string) => label.replaceAll(WORD_SEPARATOR, ' ');

const siteHref = social.site.replace(SITE_ORIGIN_PATTERN, '$1');
const siteLabel = siteHref.replace(PROTOCOL_PATTERN, '');

const labelOf = (locale: SiteLocale, key: string): string => {
  const label = readingViews[locale].cv.credentialLabels[key];
  if (!label) throw new Error(`reading views: no CV label for credential "${key}"`);
  return label;
};

const RESUME_SUMMARY: Record<SiteLocale, string> = {
  [SITE_LOCALE.en]:
    'I build frontend and product platforms: design systems, micro-frontend topologies, versioned state contracts, rendering and state architecture, and the backend-for-frontend (BFF) layers underneath them. I name the boundary, write the contract, and design the error path before the happy path, on web platforms, design systems and AI product surfaces where divergence is a regulated, financial, or clinical consequence.',
  [SITE_LOCALE.pt]:
    'Construo plataformas frontend e de produto: design systems, topologias de micro-frontend, contratos de estado versionados, arquitetura de renderização e estado, e as camadas de backend-for-frontend (BFF) por baixo delas. Nomeio o limite, escrevo o contrato e desenho o caminho de erro antes do caminho feliz, em plataformas web, design systems e superfícies de produto de IA onde a divergência é consequência regulada, financeira ou clínica.',
};

const CV_SKILLS: Record<SiteLocale, string[]> = {
  [SITE_LOCALE.en]: [
    'Frontend & Product Architecture: React, Next.js, TypeScript, JavaScript (ES6+), TanStack Table and Query, Plate, Tailwind CSS, Radix UI, styled-components, design systems and Storybook, micro-frontend topologies, Web Components (StencilJS), SSR, SSG, ISR, rendering and state architecture, async state machines with RxJS, NgRx and Redux Toolkit, URL-synchronized and versioned view state, grid virtualization, Core Web Vitals (LCP, INP, CLS), time to interactive (TTI), Web Content Accessibility Guidelines (WCAG) 2.2 AA, WAI-ARIA, i18n, technical SEO',
    'Testing, Quality & Release Engineering: Playwright, Jest, Vitest, React Testing Library, Storybook interaction testing, Chromatic visual regression, MSW, WireMock, mutation testing (Stryker), Nx monorepos, Husky, ESLint, continuous integration and delivery (CI/CD) on GitHub Actions, AWS CodePipeline and CodeBuild, Jenkins, Docker, NGINX, AWS (S3, CloudFront, EC2, RDS), Vercel, Sentry',
    'BFF, APIs & Data: Node.js, Fastify, Express, Python, REST APIs, backend-for-frontend layers, JSON:API, webhooks, WebSocket streaming (STOMP/SockJS), PostgreSQL, TypeORM, Drizzle ORM, MongoDB, MS SQL Server, SQLite, Redis, query optimization, ETL pipelines',
    'AI-Native Product & Agent Engineering: Vercel AI SDK and AI Gateway, streaming responses, Anthropic API, OpenAI, Google Generative AI and Vertex AI, Model Context Protocol (MCP) servers, structured output validation with Zod, eval harnesses with an LLM judge calibrated against human labels, per-job cost caps, prompt-injection defense, agent and sub-agent orchestration, Claude Code and Codex skills, lifecycle hooks, spec-driven development, model routing with cost ceilings, quality gates that fail closed',
  ],
  [SITE_LOCALE.pt]: [
    'Arquitetura Frontend e de Produto: React, Next.js, TypeScript, JavaScript (ES6+), TanStack Table e Query, Plate, Tailwind CSS, Radix UI, styled-components, design systems e Storybook, topologias de micro-frontend, Web Components (StencilJS), SSR, SSG, ISR, arquitetura de renderização e estado, máquinas de estado assíncronas com RxJS, NgRx e Redux Toolkit, estado de visualização versionado e sincronizado com a URL, virtualização de grids, Core Web Vitals (LCP, INP, CLS), time to interactive (TTI), Web Content Accessibility Guidelines (WCAG) 2.2 AA, WAI-ARIA, i18n, SEO técnico',
    'Engenharia de Testes, Qualidade e Release: Playwright, Jest, Vitest, React Testing Library, testes de interação no Storybook, regressão visual com Chromatic, MSW, WireMock, mutation testing (Stryker), monorepos Nx, Husky, ESLint, integração e entrega contínuas (CI/CD) com GitHub Actions, AWS CodePipeline e CodeBuild, Jenkins, Docker, NGINX, AWS (S3, CloudFront, EC2, RDS), Vercel, Sentry',
    'BFF, APIs e Dados: Node.js, Fastify, Express, Python, REST APIs, camadas backend-for-frontend, JSON:API, webhooks, streaming WebSocket (STOMP/SockJS), PostgreSQL, TypeORM, Drizzle ORM, MongoDB, MS SQL Server, SQLite, Redis, otimização de queries, pipelines ETL',
    'Engenharia de Produto AI-Native e Agentes: Vercel AI SDK e AI Gateway, respostas com streaming, Anthropic API, OpenAI, Google Generative AI e Vertex AI, servidores Model Context Protocol (MCP), validação de saída estruturada com Zod, harnesses de avaliação com juiz LLM calibrado contra labels humanas, limites de custo por job, defesa contra prompt injection, orquestração de agentes e sub-agentes, skills de Claude Code e Codex, lifecycle hooks, desenvolvimento spec-driven, roteamento de modelos com tetos de custo, gates de qualidade que falham fechados',
  ],
};

const cvDocumentFor = (locale: SiteLocale) => {
  const sentence = toSentence(locale);
  const event = communityEvent[locale];
  return CvDocumentSchema.parse({
    name: profile.displayName,
    role: profilePresentation[locale].title,
    location: profileCityLine,
    links: [
      { label: social.email, href: `mailto:${social.email}`, external: false },
      { label: siteLabel, href: siteHref, external: true },
      { label: 'LinkedIn', href: social.linkedin, external: true },
      { label: 'GitHub', href: social.github, external: true },
    ],
    summary: RESUME_SUMMARY[locale],
    experience: gitLog[locale].map((entry) => ({
      key: entry.hash,
      company: entry.company,
      companyUrl: entry.companyUrl,
      meta: [
        entry.role,
        `${entry.location}${entry.workMode ? ` (${workModeLabel(locale, entry.workMode)})` : ''}`,
        entry.date,
      ].join(STACK_SEPARATOR),
      bullets: entry.body
        .flatMap((line) => line.split(FRAGMENT_SEPARATOR_PATTERN))
        .filter((fragment) => fragment.trim().length > 0)
        .map(sentence),
    })),
    skills: CV_SKILLS[locale],
    certifications: credentials.map((entry) => ({
      key: entry.label,
      label: labelOf(locale, entry.label),
      value: [entry.badge, entry.evidence].join(STACK_SEPARATOR),
    })),
    community: {
      heading: [spaced(event.name), event.year, event.role].join(STACK_SEPARATOR),
      href: event.link.href,
      bullets: event.bullets.map(sentence),
      status: sentence(event.statusLine),
    },
    education: education[locale].map((entry) => ({
      key: entry.id,
      label: entry.degree,
      value: [entry.institution, entry.location, entry.period, entry.focus]
        .filter((part): part is string => Boolean(part))
        .join(STACK_SEPARATOR),
    })),
    languages:
      locale === SITE_LOCALE.pt
        ? profilePresentation[SITE_LOCALE.pt].languagesLine
        : formatLanguages(profile.languages),
    email: social.email,
  });
};

export const cvDocument: Record<SiteLocale, ReturnType<typeof cvDocumentFor>> = {
  [SITE_LOCALE.en]: cvDocumentFor(SITE_LOCALE.en),
  [SITE_LOCALE.pt]: cvDocumentFor(SITE_LOCALE.pt),
};

const summaryDocumentFor = (locale: SiteLocale) => {
  const views = readingViews[locale];
  const summaryProjects = views.summary.projectNames.map((name) => {
    const project = projects[locale].find((entry) => entry.name === name);
    const stat = project?.stats[0];
    if (!project || !stat) throw new Error(`reading views: project "${name}" has no stat to show`);
    return { name, label: stat.label, value: stat.value, description: project.description };
  });
  return SummaryDocumentSchema.parse({
    name: profile.displayName,
    tagline: profilePresentation[locale].title,
    technologyLine: profile.technologyLine,
    context: [profileLocation, profile.currentEmployer.name, views.summary.experienceLabel].join(
      STACK_SEPARATOR,
    ),
    employer: { name: profile.currentEmployer.name, url: profile.currentEmployer.url },
    stats: heroContent[locale].stats,
    projects: summaryProjects,
    languages: cvDocument[locale].languages,
    email: social.email,
  });
};

export const summaryDocument: Record<SiteLocale, ReturnType<typeof summaryDocumentFor>> = {
  [SITE_LOCALE.en]: summaryDocumentFor(SITE_LOCALE.en),
  [SITE_LOCALE.pt]: summaryDocumentFor(SITE_LOCALE.pt),
};

const PROFILE_PAGE_TYPE = 'ProfilePage';

export const cvJsonLd = CvJsonLdSchema.parse({
  '@context': 'https://schema.org',
  '@type': PROFILE_PAGE_TYPE,
  url: `${social.site}${READING_PATHS.cv}`,
  name: readingViews[SITE_LOCALE.en].cv.title,
  mainEntity: {
    '@type': 'Person',
    name: profile.fullName,
    jobTitle: profile.title,
    url: social.site,
    sameAs: [social.linkedin, social.github],
    worksFor: {
      '@type': 'Organization',
      name: profile.currentEmployer.name,
      url: profile.currentEmployer.url,
    },
  },
});
