export const dynamic = 'force-static';

const PROFILE = {
  '@type': 'HiringProfile',
  name: 'Erik Henrique Alves Cunha',
  alias: 'Erik Cunha',
  url: 'https://erikunha.dev',
  email: 'erikhenriquealvescunha@gmail.com',
  github: 'https://github.com/erikunha',
  linkedin: 'https://www.linkedin.com/in/erikunha/',

  seniority: ['senior', 'staff', 'principal'],
  yoe: 8,

  stack_primary: ['Angular', 'React', 'Next.js', 'TypeScript', 'RxJS', 'NgRx'],
  stack_secondary: [
    'Node.js',
    'Express.js',
    'PostgreSQL',
    'MongoDB',
    'Docker',
    'AWS',
    'GitHub Actions',
  ],
  domains: ['fintech', 'PCI-DSS', 'healthcare', 'e-commerce', 'edtech', 'banking', 'highway-ops'],

  employers: [
    {
      name: 'Betsson Group',
      role: 'Senior Frontend Software Engineer',
      domain: 'fintech/PCI-DSS',
      current: true,
      dates: '2025–present',
    },
    {
      name: 'Canon Medical Systems Brazil',
      role: 'Senior Software Engineering Consulting',
      domain: 'healthcare',
      dates: '2023–2025',
    },
    {
      name: 'Grupo SBF (Nike Brazil/Centauro)',
      role: 'React Developer',
      domain: 'e-commerce',
      dates: '2021–2023',
    },
    {
      name: 'Encora Inc. (VMware Pathfinder)',
      role: 'Frontend Engineer',
      domain: 'consulting/enterprise',
      dates: '2021',
    },
    {
      name: 'Zup Innovation (Itaú Unibanco)',
      role: 'Frontend Engineer',
      domain: 'fintech/banking',
      dates: '2020–2021',
    },
    {
      name: 'Venturus',
      role: 'Frontend Engineer',
      domain: 'engineering/highway-ops',
      dates: '2019–2020',
    },
    {
      name: 'Venturus',
      role: 'Full Stack Engineer (MEAN Stack)',
      domain: 'engineering/foreign-trade',
      dates: '2019',
    },
    {
      name: 'MB Labs',
      role: 'Mobile Developer',
      domain: 'edtech/cross-platform',
      dates: '2018–2019',
    },
    { name: 'MB Labs', role: 'Full Stack Developer', domain: 'hr-tech/chatbot', dates: '2018' },
    {
      name: 'Monde Sistemas',
      role: 'Frontend Engineer (Vue.js)',
      domain: 'b2b-saas/travel',
      dates: '2017–2018',
    },
  ],

  receipts: {
    tx_volume_per_year: '40M+',
    revenue_platform: '€1B+ ARR',
    mau_peak: '8M+ (Grupo SBF)',
    a11y_score: '~100/100',
    perf_delta_js: '-33%',
    perf_delta_css: '-98%',
    tti_improvement: '+52%',
    page_load_reduction: '-32%',
    conversion_uplift: '+10% (20+ A/B experiments)',
    api_latency_reduction: '-97.5% (40s→<1s, Venturus)',
    onboarding_reduction: '-40% (Betsson, 35-page knowledge system)',
    labs_delivered: '2.1M+ cumulative (VMware Pathfinder)',
    banking_customers: '70M+ (Itaú via Zup)',
    copilot_subagents: '12-agent system (Betsson)',
  },

  work_auth: {
    EU_Malta: 'authorized',
    Canada: 'co-op graduate',
    Brazil: 'citizen',
    worldwide: 'open to relocation',
  },

  education: [
    {
      institution: 'CICCC',
      degree: 'Co-op Diploma, Web Development Specialist',
      location: 'Vancouver, Canada',
      years: '2023–2024',
    },
    {
      institution: 'UNISAL',
      degree: "Bachelor's, Information Systems",
      location: 'Campinas, Brazil',
      years: '2015–2020',
    },
  ],

  certifications: [
    'WES Verified International Academic Qualifications (2022)',
    'IELTS General Training Band 6.5 — C1 Speaking and Listening (2023)',
    'Angular Developer Certification — Alain Chautard, GDE (2024)',
  ],

  availability: 'immediate',
  notice_period_days: 0,
  open_to: ['full_time', 'contract', 'ic', 'tech_lead', 'staff', 'principal'],
  location: 'Brazil (remote-first, relocation available)',

  languages: [
    { code: 'pt', level: 'native' },
    { code: 'en', level: 'C1' },
    { code: 'fr', level: 'A2' },
  ],
  last_updated: '2026-05-15',
};

export async function GET(): Promise<Response> {
  // Deliberate exemption from the `lib/server/route.ts` envelope (STANDARDS.md
  // Ch. 2): erik.json is a machine-readable resume *document*, not an
  // *operation* — agent crawlers fetch it expecting a plain profile, and
  // wrapping it in `{ ok, requestId, data }` would break those consumers. It
  // stays bare JSON but still emits `X-Request-Id` for log correlation.
  return Response.json(PROFILE, {
    headers: {
      'Cache-Control': 'public, max-age=86400, stale-while-revalidate=3600',
      'X-Content-Type-Options': 'nosniff',
      'X-Request-Id': crypto.randomUUID(),
    },
  });
}
