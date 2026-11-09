import { communityEvent } from './community';
import { credentials } from './credentials';
import { education } from './education';
import { gitLog, workModeLabel } from './git-log';
import { heroContent } from './hero';
import { HIRE_ACCESSIBLE_NAME, NAV_VOCABULARY } from './nav';
import { formatLanguages, profile, profilePresentation, profileStack } from './profile';
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
const SUMMARY_PROJECT_COUNT = 3;
const WORD_SEPARATOR = '_';

const readingViewsFor = (locale: SiteLocale): ReadingViews => {
  const pt = locale === SITE_LOCALE.pt;
  const presentation = profilePresentation[locale];
  return ReadingViewsSchema.parse({
    shared: {
      hire: {
        label: NAV_VOCABULARY[locale].hire,
        ariaLabel: HIRE_ACCESSIBLE_NAME[locale],
        href: social.linkedin,
      },
      printLabel: pt ? 'IMPRIMIR / SALVAR PDF' : 'PRINT / SAVE PDF',
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
      credentialBadges: {
        ANGULAR_DEV: pt ? 'Certificado' : 'Certified',
        ENGLISH: 'IELTS General Training',
        INTL_DEGREE: pt ? 'Verificado pela WES' : 'WES verified',
      },
      proseOverrides: pt
        ? {
            'primeiro emprego. telas de back-office em vue.js 2 para mais de 1.600 agências de turismo brasileiras':
              'Primeiro emprego: telas de back-office em Vue.js 2 para mais de 1.600 agências de turismo brasileiras.',
          }
        : {
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
      projectNames: projects[locale].slice(0, SUMMARY_PROJECT_COUNT).map((project) => project.name),
      stack: { core: profileStack.core, ai: profileStack.ai },
      stackLabels: {
        core: pt ? 'Stack principal' : 'Core stack',
        ai: pt ? 'Stack de IA' : 'AI stack',
      },
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

const badgeOf = (locale: SiteLocale, key: string): string => {
  const badge = readingViews[locale].cv.credentialBadges[key];
  if (!badge) throw new Error(`reading views: no CV badge for credential "${key}"`);
  return badge;
};

const RESUME_SUMMARY: Record<SiteLocale, string> = {
  [SITE_LOCALE.en]:
    "Senior Software Engineer with 8+ years of production software across AI-native SaaS, fintech, payments and e-commerce, on TypeScript, Python, React, Next.js, Angular and Node.js, with PostgreSQL, Docker and AWS. Payments, business insurance and equipment field service taught me audit trails, idempotent recovery and failure isolation, the same problems agent systems meet as guardrails. I build LLM systems and the evaluation that decides whether they are safe to ship: on my own site a live LLM endpoint runs behind a continuous integration (CI) harness, with an LLM judge calibrated against my own labels at a 0.85 agreement floor and jailbreak resistance gated at 1.0. I work daily in Claude Code and Codex, authoring the skills, guard policies and lifecycle hooks they run under. At Raylu I own the frontend platform behind a private-markets product's data-dense pages, and changes ship behind a production A/B, route by route. At Betsson I built a 12-agent AI-assisted engineering system a platform team adopted, on a PCI-DSS payment platform processing 40M+ transactions a year.",
  [SITE_LOCALE.pt]:
    'Engenheiro de Software Sênior com mais de 8 anos de software em produção em SaaS AI-native, fintech, pagamentos e e-commerce, com TypeScript, Python, React, Next.js, Angular e Node.js, além de PostgreSQL, Docker e AWS. Pagamentos, seguro empresarial e serviço em campo de equipamentos me ensinaram trilhas de auditoria, recuperação idempotente e isolamento de falhas, os mesmos problemas que sistemas de agentes encontram como guardrails. Construo sistemas com LLMs e a avaliação que decide se é seguro colocá-los em produção: no meu próprio site, um endpoint de LLM no ar roda atrás de um harness de integração contínua (CI), com um juiz LLM calibrado contra os meus próprios rótulos em um piso de concordância de 0,85 e resistência a jailbreak travada em 1,0. Trabalho diariamente com Claude Code e Codex, escrevendo as skills, políticas de guarda e lifecycle hooks sob os quais eles rodam. Na Raylu, sou dono da plataforma frontend por trás das páginas densas em dados de um produto de mercados privados, e as mudanças vão ao ar atrás de um A/B em produção, rota por rota. Na Betsson, construí um sistema de engenharia assistido por IA com 12 agentes que um time de plataforma adotou, sobre uma plataforma de pagamentos PCI-DSS que processa mais de 40M de transações por ano.',
};

type CvSkillGroup = { label: string; items: string[] };

const CV_SKILLS: Record<SiteLocale, CvSkillGroup[]> = {
  [SITE_LOCALE.en]: [
    {
      label: 'LLM Systems & Evaluation',
      items: [
        'eval harness design',
        'corpora graded on end state',
        'LLM-as-judge calibrated against human labels with an agreement floor',
        'pass@k and all-runs-pass',
        'control-treatment A/B',
        'failure taxonomies',
        'per-job cost caps',
        'model routing by task tier',
        'tracing (Langfuse, OpenTelemetry)',
        'Anthropic, OpenAI and Google APIs',
        'Vercel AI SDK',
        'structured output validation with Zod',
      ],
    },
    {
      label: 'Agents & Guardrails',
      items: [
        'agent and sub-agent orchestration',
        'tool-surface design',
        'Model Context Protocol (MCP) servers',
        'prompt-injection defense at the request boundary',
        'streaming leak detection',
        'kill switches',
        'content-hashed prompt versioning',
        'model-drift detection',
        'policy guards that fail closed',
      ],
    },
    {
      label: 'Backend & Data',
      items: [
        'Python',
        'Node.js',
        'Express',
        'Fastify',
        'REST APIs',
        'backend-for-frontend layers',
        'PostgreSQL',
        'MongoDB',
        'Redis',
        'MS SQL Server',
        'SQLite',
        'ETL pipelines',
        'WebSocket streaming (STOMP/SockJS)',
      ],
    },
    {
      label: 'Product Engineering',
      items: [
        'TypeScript',
        'JavaScript (ES6+)',
        'React',
        'Next.js',
        'TanStack',
        'Tailwind CSS',
        'design systems',
        'micro-frontends',
        'Angular (RxJS, NgRx)',
        'Web Components (StencilJS)',
        'Vue.js',
      ],
    },
    {
      label: 'Platform, Delivery & Quality',
      items: [
        'Docker',
        'NGINX',
        'AWS (S3, CloudFront, EC2, RDS)',
        'Vercel',
        'GitHub Actions',
        'Jenkins',
        'Nx monorepos',
        'Sentry',
        'Playwright',
        'Vitest',
        'Jest',
        'React Testing Library',
        'Storybook',
        'MSW',
        'WireMock',
        'mutation testing',
      ],
    },
  ],
  [SITE_LOCALE.pt]: [
    {
      label: 'Sistemas LLM e Avaliação',
      items: [
        'desenho de harness de avaliação',
        'corpora avaliados pelo estado final',
        'LLM-as-judge calibrado contra rótulos humanos com piso de concordância',
        'pass@k e all-runs-pass',
        'A/B controle-tratamento',
        'taxonomias de falha',
        'limites de custo por job',
        'roteamento de modelos por nível de tarefa',
        'tracing (Langfuse, OpenTelemetry)',
        'APIs da Anthropic, OpenAI e Google',
        'Vercel AI SDK',
        'validação de saída estruturada com Zod',
      ],
    },
    {
      label: 'Agentes e Guardrails',
      items: [
        'orquestração de agentes e sub-agentes',
        'desenho da superfície de ferramentas',
        'servidores Model Context Protocol (MCP)',
        'defesa contra prompt injection na borda da requisição',
        'detecção de vazamento em streaming',
        'kill switches',
        'versionamento de prompts por hash de conteúdo',
        'detecção de deriva de modelo',
        'políticas de guarda que falham fechadas',
      ],
    },
    {
      label: 'Backend e Dados',
      items: [
        'Python',
        'Node.js',
        'Express',
        'Fastify',
        'REST APIs',
        'camadas backend-for-frontend',
        'PostgreSQL',
        'MongoDB',
        'Redis',
        'MS SQL Server',
        'SQLite',
        'pipelines ETL',
        'streaming WebSocket (STOMP/SockJS)',
      ],
    },
    {
      label: 'Engenharia de Produto',
      items: [
        'TypeScript',
        'JavaScript (ES6+)',
        'React',
        'Next.js',
        'TanStack',
        'Tailwind CSS',
        'design systems',
        'micro-frontends',
        'Angular (RxJS, NgRx)',
        'Web Components (StencilJS)',
        'Vue.js',
      ],
    },
    {
      label: 'Plataforma, Entrega e Qualidade',
      items: [
        'Docker',
        'NGINX',
        'AWS (S3, CloudFront, EC2, RDS)',
        'Vercel',
        'GitHub Actions',
        'Jenkins',
        'monorepos Nx',
        'Sentry',
        'Playwright',
        'Vitest',
        'Jest',
        'React Testing Library',
        'Storybook',
        'MSW',
        'WireMock',
        'mutation testing',
      ],
    },
  ],
};

const cvDocumentFor = (locale: SiteLocale) => {
  const sentence = toSentence(locale);
  const event = communityEvent[locale];
  return CvDocumentSchema.parse({
    name: profile.displayName,
    role: profilePresentation[locale].title,
    location: `${profile.city}, ${profilePresentation[locale].country}`,
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
      context: entry.context,
      bullets: (entry.highlights.length > 0
        ? entry.highlights
        : entry.body
            .flatMap((line) => line.split(FRAGMENT_SEPARATOR_PATTERN))
            .filter((fragment) => fragment.trim().length > 0)
      ).map(sentence),
    })),
    skills: CV_SKILLS[locale],
    certifications: credentials.map((entry) => ({
      key: entry.label,
      label: labelOf(locale, entry.label),
      value: [badgeOf(locale, entry.label), entry.evidence].join(STACK_SEPARATOR),
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
    context: [
      profilePresentation[locale].location,
      profile.currentEmployer.name,
      views.summary.experienceLabel,
    ].join(STACK_SEPARATOR),
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
