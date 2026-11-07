import { experienceDetail } from './experience-detail';
import {
  ASSETS_UNDER_MANAGEMENT_BILLIONS,
  FUNDS_PHRASE,
  FUNDS_SERVED,
  localizeDecimals,
  PROFILE_FACT,
  profile,
  profilePresentation,
} from './profile';
import { CV_LINK_LABEL, READING_PATHS } from './reading-paths';
import { CareerCopySchema, type GitCommit, GitCommitSchema } from './schemas';
import { localizedPath, SITE_LOCALE, type SiteLocale } from './site-locale';

const gitLogFor = (locale: SiteLocale): GitCommit[] => {
  const pt = locale === SITE_LOCALE.pt;
  const entries = [
    {
      hash: 'b2e6a19f4c8d3057e1a9b6c2d8f40e73a5c1908d',
      deco: '(HEAD -> main, tag: v9.0)',
      date: pt ? 'jun/2026 - atual' : 'Jun 2026 - Present',
      branch: 'career/raylu',
      type: 'career',
      company: profile.currentEmployer.name,
      companyUrl: profile.currentEmployer.url,
      role: pt ? 'Engenheiro de Software Sênior' : 'Senior Software Engineer',
      startMonth: '2026-06',
      endMonth: null,
      location: pt ? 'Nova York, EUA' : 'New York, US',
      workMode: 'remote',
      domain: profilePresentation[locale].employerContext,
      body: [
        pt
          ? `buscava escala de produto AI-native; reconstruiu as telas de fluxo de trabalho do investidor de uma plataforma de mercados privados para mais de ${FUNDS_SERVED} fundos com US$ ${ASSETS_UNDER_MANAGEMENT_BILLIONS}B+ em ativos.`
          : `wanted AI-native product scale; rebuilt the investor workflow screens of a private-markets platform for ${FUNDS_PHRASE}.`,
      ],
    },
    {
      hash: '7f3a2bc09f8e1d4c2b6a5d3e8c1f2a7b9d4e6c0a',
      deco: '(tag: v8.0)',
      date: pt ? 'mar/2025 - mai/2026' : 'Mar 2025 - May 2026',
      branch: 'career/betsson',
      type: 'career',
      company: 'Betsson Group',
      companyUrl: 'https://betssongroup.com',
      role: pt ? 'Engenheiro de Software Sênior' : 'Senior Software Engineer',
      startMonth: '2025-03',
      endMonth: '2026-05',
      location: 'Malta',
      workMode: 'hybrid',
      domain: pt ? 'jogos online e pagamentos' : 'online gaming and payments',
      body: [
        pt
          ? `buscava escala regulada em múltiplos mercados; obteve ${PROFILE_FACT.txPerYear} transações/ano em mais de 15 jurisdições e 31,1M clientes em uma plataforma de pagamentos PCI-DSS.`
          : `wanted regulated multi-market scale; got ${PROFILE_FACT.txPerYear} tx/yr across 15+ jurisdictions and 31.1M customers on a PCI-DSS payment platform.`,
      ],
    },
    {
      hash: '4a9e1d886b3f2c7e0a8d5b9c1e6f4a2b3d7e8c01',
      deco: '(tag: v7.0)',
      date: pt ? 'mar/2023 - mar/2025' : 'Mar 2023 - Mar 2025',
      branch: 'career/canon-medical',
      type: 'career',
      company: 'Canon Medical Systems Brazil',
      companyUrl: 'https://br.medical.canon',
      role: pt
        ? 'Engenheiro de Software Sênior (consultor independente)'
        : 'Senior Software Engineer (independent consultant)',
      startMonth: '2023-03',
      endMonth: '2025-03',
      location: pt ? 'Canadá' : 'Canada',
      workMode: 'remote',
      domain: pt ? 'tecnologia em saúde' : 'healthcare technology',
      body: [
        pt
          ? 'reconstruiu uma plataforma de serviço de equipamentos hospitalares: ordens de serviço, agendamento de especialistas, visitas de campo; Angular 17 para 19.'
          : 'rebuilt a hospital equipment service platform: service orders, specialist scheduling, field visits; Angular 17 to 19.',
      ],
    },
    {
      hash: '5b6f0a4c8d9e1b3a7c2f5d8b0a4e6c9f1b3d7a02',
      deco: '(tag: v6.0)',
      date: pt ? 'dez/2021 - mar/2023' : 'Dec 2021 - Mar 2023',
      branch: 'career/grupo-sbf',
      type: 'career',
      company: 'Grupo SBF (Nike / Centauro)',
      companyUrl: 'https://www.gruposbf.com.br',
      role: pt ? 'Engenheiro de Software' : 'Software Engineer',
      startMonth: '2021-12',
      endMonth: '2023-03',
      location: pt ? 'São Paulo, Brasil' : 'São Paulo, Brazil',
      workMode: 'remote',
      domain: pt ? 'e-commerce de varejo esportivo' : 'sports retail e-commerce',
      body: [
        pt
          ? `storefronts Next.js para Nike Brasil e Centauro (${PROFILE_FACT.peakMau} MAU); elevou a conversão em ~10% com mais de 20 experimentos A/B e cortou o carregamento da página em -32%; R$ 7,9B de receita bruta, R$ 2,5B digital.`
          : `Next.js storefronts for Nike Brazil and Centauro (${PROFILE_FACT.peakMau} MAU); lifted conversion ~10% through 20+ A/B experiments and cut page load -32%; R$7.9B gross revenue, R$2.5B digital.`,
      ],
    },
    {
      hash: '3d4e8c1a5b9f2c7e6d3a8b1c4e5f9d2a7b6c0e8d',
      deco: '(tag: v5.0)',
      date: pt ? 'jan/2021 - dez/2021' : 'Jan 2021 - Dec 2021',
      branch: 'career/encora',
      type: 'career',
      company: pt ? 'Encora (antiga Daitan)' : 'Encora (formerly Daitan)',
      companyUrl: 'https://www.linkedin.com/company/encorainc/',
      role: pt
        ? 'Desenvolvedor Frontend · alocado na VMware'
        : 'Frontend Developer · assigned to VMware',
      startMonth: '2021-01',
      endMonth: '2021-12',
      location: pt ? 'Campinas, Brasil' : 'Campinas, Brazil',
      workMode: null,
      domain: pt ? 'software enterprise em nuvem' : 'enterprise cloud software',
      body: [
        pt
          ? `portal do laboratório VMware Pathfinder em Angular 11; efeitos NgRx, Reactive Forms, ${localizeDecimals(PROFILE_FACT.labsDelivered, locale)} labs.`
          : `VMware Pathfinder lab portal on Angular 11; NgRx effects, Reactive Forms, ${PROFILE_FACT.labsDelivered} labs.`,
      ],
    },
    {
      hash: '1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a01',
      deco: '(tag: v4.0)',
      date: pt ? 'abr/2020 - jan/2021' : 'Apr 2020 - Jan 2021',
      branch: 'career/zup-itau',
      type: 'career',
      company: 'Zup Innovation (Itaú Unibanco)',
      companyUrl: 'https://zup.com.br',
      role: pt ? 'Desenvolvedor Frontend' : 'Frontend Developer',
      startMonth: '2020-04',
      endMonth: '2021-01',
      location: pt ? 'Campinas, Brasil' : 'Campinas, Brazil',
      workMode: null,
      domain: pt ? 'seguros empresariais' : 'business insurance',
      body: [
        pt
          ? 'primeiro trabalho regulado / bancário; micro-frontends com Angular Elements para o seguro empresarial do Itaú (24,2M clientes digitais).'
          : `first regulated / banking work; Angular Elements micro-frontends for Itaú's business insurance (${PROFILE_FACT.bankingClients} digital clients).`,
      ],
    },
    {
      hash: '9c8b7a6e5d4f3c2b1a0e9d8c7b6a5e4f3d2c1b0a',
      deco: '(tag: v3.0)',
      date: pt ? 'fev/2019 - abr/2020' : 'Feb 2019 - Apr 2020',
      branch: 'career/venturus',
      type: 'career',
      company: 'Venturus',
      companyUrl: 'https://www.venturus.org.br',
      role: pt
        ? 'Engenheiro Full Stack → Desenvolvedor Frontend'
        : 'Full Stack Engineer → Frontend Developer',
      startMonth: '2019-02',
      endMonth: '2020-04',
      location: pt ? 'Campinas, Brasil' : 'Campinas, Brazil',
      workMode: null,
      domain: pt ? 'P&D aplicado' : 'applied R&D',
      body: [
        pt
          ? 'começou no backend; API de relatórios de 40s para <1s; migração MongoDB para PostgreSQL com pipeline ETL em Node.js.'
          : 'cut teeth on backend; reporting API 40s → <1s; MongoDB → PostgreSQL migration with a Node.js ETL pipeline.',
      ],
    },
    {
      hash: '0e0f0a0b0c0d0e0f0a0b0c0d0e0f0a0b0c0d0e0f',
      deco: '(tag: v2.0)',
      date: pt ? 'jul/2018 - fev/2019' : 'Jul 2018 - Feb 2019',
      branch: 'career/mb-labs',
      type: 'career',
      company: 'MB Labs',
      companyUrl: 'https://mblabs.com.br',
      role: pt
        ? 'Engenheiro Full Stack → Engenheiro de Software'
        : 'Full Stack Engineer → Software Engineer',
      startMonth: '2018-07',
      endMonth: '2019-02',
      location: pt ? 'Campinas, Brasil' : 'Campinas, Brazil',
      workMode: null,
      domain: pt ? 'educação e treinamento de varejo' : 'education and retail training',
      body: [
        pt
          ? 'entregou app multiplataforma em 5 SOs a partir de uma base Ionic + Angular + Electron (~80% de código compartilhado).'
          : 'shipped 5-OS cross-platform from one Ionic + Angular + Electron codebase (~80% shared code).',
      ],
    },
    {
      hash: '0d1c2b3a4e5f67890123456789abcdef01234567',
      deco: '(tag: v1.0, root-commit)',
      date: pt ? 'out/2017 - mai/2018' : 'Oct 2017 - May 2018',
      branch: 'career/monde-sistemas',
      type: 'career',
      company: 'Monde Sistemas',
      companyUrl: 'https://monde.com.br',
      role: pt ? 'Estagiário' : 'Intern',
      startMonth: '2017-10',
      endMonth: '2018-05',
      location: pt ? 'Americana, Brasil' : 'Americana, Brazil',
      workMode: null,
      domain: pt ? 'tecnologia em turismo' : 'travel technology',
      body: [
        pt
          ? 'primeiro emprego. Telas de back-office em Vue.js 2 para mais de 1.600 agências de turismo brasileiras.'
          : 'first job. Vue.js 2 back-office screens for 1,600+ Brazilian travel agencies.',
      ],
      isRoot: true,
    },
  ];
  return GitCommitSchema.array().parse(
    entries.map((entry) => ({ ...entry, ...experienceDetail[locale][entry.branch] })),
  );
};

export const gitLog: Record<SiteLocale, GitCommit[]> = {
  [SITE_LOCALE.en]: gitLogFor(SITE_LOCALE.en),
  [SITE_LOCALE.pt]: gitLogFor(SITE_LOCALE.pt),
};

const COMPANY_DETAIL_SEPARATOR = ' (';
const companyBrand = (company: string) => company.split(COMPANY_DETAIL_SEPARATOR)[0] ?? company;

export const companyUrlFor = (brand: string): string => {
  const entry = gitLog[SITE_LOCALE.en].find((job) => companyBrand(job.company) === brand);
  if (!entry) throw new Error(`git-log: no career entry for company "${brand}"`);
  return entry.companyUrl;
};

const GRAPH_CONTINUATION_LINES = 80;
const SHORT_HASH_LENGTH = 7;

const careerCopyFor = (locale: SiteLocale) => {
  const pt = locale === SITE_LOCALE.pt;
  return CareerCopySchema.parse({
    heading: pt ? 'Carreira' : 'Career',
    headerCommand: 'GIT LOG --ONELINE --DECORATE --GRAPH',
    mobileHeaderCommand: 'GIT LOG --ONELINE',
    prompt: 'erik@portfolio:~$',
    command: pt
      ? 'git log --oneline --decorate --graph ~/carreira'
      : 'git log --oneline --decorate --graph ~/career',
    cvLabel: CV_LINK_LABEL[locale],
    cvHref: localizedPath(locale, READING_PATHS.cv),
    scrollLabel: pt ? 'Histórico profissional, rolável' : 'Career history, scrollable',
    pipe: '|',
    graph: `*\n${'|\n'.repeat(GRAPH_CONTINUATION_LINES)}`,
  });
};

export const careerCopy: Record<SiteLocale, ReturnType<typeof careerCopyFor>> = {
  [SITE_LOCALE.en]: careerCopyFor(SITE_LOCALE.en),
  [SITE_LOCALE.pt]: careerCopyFor(SITE_LOCALE.pt),
};

export const careerCommand = (locale: SiteLocale): string => careerCopy[locale].command;
export const careerScrollLabel = (locale: SiteLocale): string => careerCopy[locale].scrollLabel;

const COMPANY_SEPARATOR = ' ';
const COMPANY_JOINER = '_';
const COUNTRY_LABELS: Record<SiteLocale, { full: string; short: string }> = {
  [SITE_LOCALE.en]: { full: ', Brazil', short: ', BR' },
  [SITE_LOCALE.pt]: { full: ', Brasil', short: ', BR' },
};

export const WORK_MODE_LABELS: Record<SiteLocale, Record<string, string>> = {
  [SITE_LOCALE.en]: { remote: 'remote', hybrid: 'hybrid', 'on-site': 'on-site' },
  [SITE_LOCALE.pt]: { remote: 'remoto', hybrid: 'híbrido', 'on-site': 'presencial' },
};

export const workModeLabel = (locale: SiteLocale, mode: string): string =>
  WORK_MODE_LABELS[locale][mode] ?? mode;

export const careerEntries = (locale: SiteLocale) => {
  const countryLabels = COUNTRY_LABELS[locale];
  const workModeLabels = WORK_MODE_LABELS[locale];
  return gitLog[locale].map((entry) => {
    const [name = '', ...details] = entry.company.split(COMPANY_DETAIL_SEPARATOR);
    const detail = details.map((part) => `${COMPANY_DETAIL_SEPARATOR}${part}`).join('');
    return {
      ...entry,
      shortHash: entry.hash.slice(0, SHORT_HASH_LENGTH),
      displayBrand: name.replaceAll(COMPANY_SEPARATOR, COMPANY_JOINER).toUpperCase(),
      displayDetail: detail.toUpperCase(),
      displayRole: entry.role.toUpperCase(),
      displayLocation: `${entry.location.replace(countryLabels.full, countryLabels.short)}${
        entry.workMode ? ` (${workModeLabels[entry.workMode] ?? entry.workMode})` : ''
      }`,
    };
  });
};
