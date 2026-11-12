export type RetiredClaim = { name: string; pattern: RegExp; reason: string };

// The healthcare guard reads the phrase that names a client, not the word alone,
// so healthcare, health tech and saude stay publishable in both locales. The
// English side matches the domain word followed by a client noun, the Portuguese
// side matches a client noun followed by the domain word, and the accent is
// folded so the Portuguese is caught spelled either way.
const HEALTHCARE_CLIENT_CLAIM =
  /health[\s-]?(?:care|tech)[^.\n<>]{0,25}?\b(?:compan(?:y|ies)|clients?|sectors?|verticals?|engagements?|providers?|business(?:es)?|organi[sz]ations?|firms?)\b|(?:empresa|empresas|clientes?|setor|provedora|organiza(?:ção|ção)|negócio|fornecedor|companhia)\s+(?:de|da|do)\s+(?:sa[uú]de|health[\s-]?(?:care|tech))/i;

export const RETIRED_CLAIMS: RetiredClaim[] = [
  {
    name: 'client name',
    pattern: /canon(?!ical)|¥/i,
    reason:
      'the forward deployed engineering role is published with no client name and no figure that identifies one, in any derived form (CANON_MEDICAL labels, canon-medical branch keys, slugs and anchors); only "canonical" is allowed',
  },
  {
    name: 'work permit or relocation',
    pattern: /\bvisas?\b|\bsponsor(?:ship)?\b|relocat|realoca|patroc[ií]nio de visto|work_auth/i,
    reason:
      'owner decision: the site makes no visa, sponsorship or relocation statement on any surface, and the ask model answers such a question from the contact line. The plural "sponsors" in the DevOpsDays community line is real conference copy and is the only sponsor wording allowed',
  },
  {
    name: 'region targeting',
    pattern: /\bEU\/US\b|\bUE\/EUA\b|\bEU, the US\b|Europe\/US\/Canada|remote-first|remoto-first/i,
    reason:
      'owner decision: the work scope is region-neutral (open to any arrangement: remote worldwide, hybrid or on-site), so no surface targets the EU, the US or Canada',
  },
  {
    name: 'healthcare client claim',
    pattern: HEALTHCARE_CLIENT_CLAIM,
    reason:
      'owner decision of 2026-11-12: healthcare, health tech and EdTech are published domains, so the site does target those sectors and the word is no longer a retired claim; what stays retired is naming a healthcare client. The forward deployed engineering engagement names no client and is described by its platform, so no surface may call it a healthcare company, client, sector, vertical, engagement, provider, business, organization or firm. The guard reads the phrase that names the client rather than the word alone, in English and in Portuguese, and it folds the accent, so the domain can be published in both locales and the unaccented Portuguese is still caught',
  },
  {
    name: 'removed employer',
    pattern: /\bmonde\b/i,
    reason:
      'owner decision: the first employer was removed from the career log and every derived surface, as if it never existed; the career log starts at MB Labs. Only the ask probe that asks about it is exempt',
  },
  {
    name: 'unsupported talk count',
    pattern: /10\+ talks|10\+ palestras|mais de 10 palestras/i,
    reason:
      'owner decision: DevOpsDays Campinas 2024 curated 8 talks, the number its official program lists; the larger figure had no source',
  },
  {
    name: 'live traffic split claim',
    pattern: /production A\/B|A\/B em produção/i,
    reason:
      'the Raylu result compares production builds of each route against its parent commit on one shared backend; it was never a live traffic split, so no surface calls it a production A/B',
  },
  {
    name: 'sole frontend ownership',
    pattern: /\bowns?\b[^.\n]{0,12}\bfrontend platform|sou dono da plataforma frontend/i,
    reason:
      'owner decision: Erik built the Raylu frontend platform with one other engineer, so no surface says he owns it',
  },
  {
    name: 'wrong route for the Raylu layout and score results',
    pattern:
      /(?:layout shift|performance score|pontuação de performance)[^.\n]{0,45}(?:company route|rota de empresa)/i,
    reason:
      'the CLS, LCP and Lighthouse score improvements are the pipelines route; on the company route the score stayed flat',
  },
  {
    name: 'internal Raylu detail',
    pattern: /\bWorkOS\b|\bTabster\b|\b745 components\b|\b950 stories\b|\bSpeed Index\b|jobattle/i,
    reason:
      'owner decision: the ask facts take the approved Raylu repository figures with their caveats and nothing else from the internal evidence (stack internals, component and story counts, route-level timings, the job-search tooling)',
  },
  {
    name: 'private repository',
    pattern: /projeto-verificacao-pagamentos/i,
    reason:
      'owner decision: LedgerLens is cited only through its public repository (erikunha/ledgerlens); the private working repository is never named or linked',
  },
];

export const RENDERED_ROUTES = [
  '/',
  '/pt',
  '/summary',
  '/pt/summary',
  '/cv',
  '/pt/cv',
  '/links',
  '/links/en',
  '/design-system',
  '/design-system/tokens',
  '/design-system/components',
  '/design-system/enforcement',
  '/design-system/changelog',
  '/llms.txt',
  '/api/erik.json',
  '/.well-known/agent.json',
] as const;
