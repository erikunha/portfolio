export const dynamic = 'force-static';

const PROFILE = {
  "@type": 'HiringProfile',
  name: 'Erik Henrique Alves Cunha',
  alias: 'Erik Cunha',
  url: 'https://erikunha.com.br',
  email: 'erikhenriquealvescunha@gmail.com',
  github: 'https://github.com/erikunha',
  linkedin: 'https://www.linkedin.com/in/erikunha/',

  seniority: ['senior', 'staff', 'principal'],
  yoe: 8,

  stack_primary: ['Angular', 'React', 'Next.js', 'TypeScript', 'RxJS', 'NgRx'],
  stack_secondary: ['Node.js', 'Docker', 'AWS', 'GitHub Actions', 'Tailwind'],
  domains: ['fintech', 'PCI-DSS', 'healthcare', 'e-commerce', 'edtech'],

  employers: [
    { name: 'Betsson Group',  role: 'Senior Frontend Engineer', domain: 'fintech/PCI-DSS', current: true },
    { name: 'Canon Medical',  role: 'Frontend Engineer',        domain: 'healthcare' },
    { name: 'Grupo SBF',      role: 'Frontend Engineer',        domain: 'e-commerce (Nike Brazil)' },
    { name: 'Encora',         role: 'Frontend Engineer',        domain: 'consulting' },
    { name: 'Zup Innovation', role: 'Frontend Engineer',        domain: 'fintech' },
    { name: 'Venturus',       role: 'Frontend Engineer',        domain: 'engineering consultancy' },
  ],

  receipts: {
    tx_volume_per_year:       '40M+',
    a11y_score:               '~100/100',
    perf_delta_js:            '-33%',
    perf_delta_css:           '-98%',
    api_latency_reduction:    '-97.5% (40s → <1s, Venturus)',
  },

  work_auth: {
    EU_Malta: 'authorized',
    Canada:   'co-op graduate',
    Brazil:   'citizen',
    worldwide: 'open to relocation',
  },

  availability:        'immediate',
  notice_period_days:  0,
  open_to: ['full_time', 'contract', 'ic', 'tech_lead', 'staff', 'principal'],
  location: 'Brazil (remote-first, relocation available)',

  languages:    ['pt', 'en', 'fr', 'es'],
  last_updated: '2026-05-15',
};

export async function GET(): Promise<Response> {
  return Response.json(PROFILE, {
    headers: {
      'Cache-Control': 'public, max-age=86400, stale-while-revalidate=3600',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
