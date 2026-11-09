export type RetiredClaim = { name: string; pattern: RegExp; reason: string };

export const RETIRED_CLAIMS: RetiredClaim[] = [
  {
    name: 'client name',
    pattern: /canon(?!ical)|¥/i,
    reason:
      'the independent consulting role is published with no client name and no figure that identifies one, in any derived form (CANON_MEDICAL labels, canon-medical branch keys, slugs and anchors); only "canonical" is allowed',
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
    name: 'sector targeting',
    pattern: /healthcare|health ?tech|\bsaúde\b/i,
    reason:
      'owner decision: targeting is GenAI, AI-native products, LLM systems and agents; the consulting work is described by its platform, with no healthcare sector or targeting claim',
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
