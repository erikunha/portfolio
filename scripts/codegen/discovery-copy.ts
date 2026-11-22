export const AI_ENGINEERING_LINES: readonly string[] = [
  'Builds LLM systems and the evaluation that decides whether they are safe to ship:',
  '',
  '- Governed LLM endpoint on this site (Vercel AI Gateway + Anthropic Claude Haiku 5.5): a',
  '  prompt-injection gate that rejects before inference, a streaming leak detector that survives',
  '  chunk boundaries, a kill switch, ephemeral prompt caching and a spend budget reserved in Redis',
  '  before every model call that fails closed when the store is down',
  '- Continuous integration (CI) eval harness: a corpus across factual, edge, jailbreak and',
  '  output-validation classes, graded against the live model, with an LLM judge calibrated against',
  '  human labels at a 0.85 agreement floor and an 11 of 12 true-negative rate on gold cases built',
  '  around traps, each answer fenced per call so it cannot instruct its grader, correctness gated',
  '  at 0.9 and jailbreak resistance gated at 1.0',
  '- Model migration gated on evals: the endpoint moved to a newer model only after its CI eval',
  '  passed, with cost per answer down from about $0.003 to about $0.0004',
  '- Daily work in Claude Code and Codex, authoring the skills, guard policies and lifecycle hooks',
  '  they run under',
  '- Multi-agent orchestration: 12-agent AI-assisted engineering system on GitHub Copilot, adopted',
  '  across the team at Betsson Group: generation, review, debugging, testing and architecture',
  '  validation, with every automated action reviewable, on a PCI-DSS payment platform',
  '- VisionLens (open source, MIT): TypeScript CLI classifying images across seven LLM vision',
  '  providers, built as a study in making a probabilistic pipeline auditable, escalating from a',
  '  local model to cloud below a 0.70 confidence threshold or on an unknown label, with',
  '  two-provider consensus voting resolved by confidence, EXIF temporal-cluster',
  '  consensus at a 0.6 majority, a self-critique pass that reclassifies what the first pass',
  '  flagged, a feedback loop promoting a human correction seen three or more times into the',
  '  system prompt, and a benchmark gate that fails on a 5% regression',
  '  (github.com/erikunha/VisionLens)',
  '- LedgerLens (open source, MIT): Python agent that investigates payment complaints with six',
  '  tools (read-only text-to-SQL behind a guard, ledger API, policy search over a FAISS index,',
  '  reference exchange rates, a Decimal calculator, case memory) and a verifier that checks every',
  '  claim against its cited evidence, escalating to human review when a dispute deadline is close',
  '  to expiring, a record looks suspicious or the exchange-rate source is down. On thirty cases:',
  '  correctness 0.82',
  '  against 0.55 for a ReAct agent and 0.17 for a tool-free chain, tool trajectory 0.73 against a',
  '  0.80 target (a miss). Thirty cases show a trend, not significance',
  '  (github.com/erikunha/ledgerlens)',
  '- vault-of-loci (open source, MIT): Obsidian vault template where AI agents tutor instead of',
  '  answering. One AGENTS.md drives five agent tools (Claude Code, Codex, Gemini CLI, Copilot',
  '  and Cursor); the attempt comes before the hint, hints arrive one step at a time, the reveal',
  "  waits for a confidence rating, and the agent never writes the learner's notes. A 17-scenario",
  '  test graded by a model of another family (a same-family judge is refused in code) holds the',
  '  tutor rules at a 28/34 pass bar, and a ledger reports what was retained after 7, 30 and 90',
  '  days, what was applied in a task never seen before, and whether the confidence matched the',
  '  result',
  '  (github.com/erikunha/vault-of-loci)',
  '',
  'Keywords: LLM Systems · LLM Evaluation · LLM-as-Judge · Agents · Multi-Agent Orchestration ·',
  'Model Context Protocol (MCP) · Guardrails · Prompt-Injection Defense · Anthropic Claude ·',
  'Structured Output · Prompt Caching · Streaming LLM · LLM Cost Optimization',
];

export const IMPACT_LINES: readonly string[] = [
  '- -97.5% API latency: reporting endpoints from ~40s → <1s (query + indexing)',
  '- -98% CSS bundle reduction (Confidential)',
  '- -52% Time to Interactive improvement (Confidential)',
  '- -33% JavaScript bundle reduction (Confidential)',
  '- -32% page load reduction (Nike Brazil / Centauro)',
  '- +10% conversion rate via 20+ A/B experiments (Nike Brazil)',
  '- €1.197B group revenue cashier platform (Betsson Group, 31.1M customers, 40M+ transactions/yr)',
  '- 8M+ monthly active users (Nike Brazil + Centauro)',
  '- 24.2M digital clients, 1.2M businesses (Itaú Unibanco business insurance)',
  '- 12-agent AI system deployed to production engineering team',
];

export const SKILLS_LINES: readonly string[] = [
  'LLM systems & evaluation: Eval harness design · Corpora graded on end state ·',
  'LLM-as-judge calibrated against human labels with an agreement floor · Failure taxonomies ·',
  'Spend budgets reserved before each model call · Model migration gated on evals ·',
  'Tracing (Langfuse, OpenTelemetry) ·',
  'Anthropic, OpenAI and Google APIs · Vercel AI SDK · LangChain · FAISS · Structured output validation with Zod',
  '',
  'Agents & guardrails: Agent and sub-agent orchestration · Tool-surface design ·',
  'Model Context Protocol (MCP) servers · Prompt-injection defense at the request boundary ·',
  'Streaming leak detection · Kill switches · Content-hashed prompt versioning ·',
  'Model-drift detection · Policy guards that fail closed',
  '',
  'Frontend: TypeScript (strict) · JavaScript (ES6+) · React 19 · React Server Components ·',
  'Next.js 16 (App Router) · TanStack · Tailwind CSS · Angular · RxJS · NgRx · StencilJS ·',
  'Web Components · Vue.js · React Native · design systems · SSR/SSG · Micro-Frontend Architecture',
  '',
  'Backend & APIs: Node.js · Express.js · Fastify · REST APIs · WebSocket (STOMP/SockJS) ·',
  'Python · ETL pipelines · Backend for Frontend (BFF)',
  '',
  'Architecture: Nx Monorepo ·',
  'Component-Driven Architecture · Reactive Architecture',
  '',
  'Cloud & DevOps: AWS (S3 · CloudFront · EC2 · RDS · CodePipeline · CodeBuild) ·',
  'Docker · NGINX · Vercel · Sentry · GitHub Actions · Jenkins · CI/CD',
  '',
  'Data: PostgreSQL · MongoDB · Redis · MS SQL Server · SQLite',
  '',
  'Testing: Playwright · Vitest · Jest · React Testing Library · Storybook · MSW · WireMock ·',
  'mutation testing',
  '',
  'Performance & A11y: Core Web Vitals · WCAG 2.2 AA · ARIA · Lighthouse CI',
];

export const INDUSTRIES_LINES: readonly string[] = [
  '- iGaming / Regulated Markets: PCI-DSS, 15+ jurisdictions, €1.197B group revenue',
  '- E-commerce: 8M+ MAU, multi-brand, LATAM',
  '- Banking / Fintech: 24.2M digital clients, business insurance',
  '- Private markets: AI deal origination for funds holding $500B+ in assets',
  '- Equipment maintenance: equipment maintenance platform, specialist scheduling, field visits',
  '- EdTech: 5-OS offline-first educational platform',
  '- HR-tech / Corporate Training: enterprise chatbot (Cia Hering, 800+ stores)',
  '- Infrastructure / Logistics: highway ops dashboards, real-time telemetry',
];

export const CERTIFICATIONS_LINES: readonly string[] = [
  '- Angular Developer Certification, certificates.dev (2024)',
  '- English: IELTS General Training, C1 (2023)',
  '- International degree: WES verified, World Education Services (2022)',
];

export const PROJECT_CONTEXT_LINES: readonly string[] = [
  '- ERIKUNHA.DEV, personal project: production Anthropic endpoint on Haiku 5.5 and the Vercel AI SDK; CI gates correctness at 0.9 and jailbreak resistance at 1.0 with an LLM judge calibrated on human labels (0.85 agreement floor); guardrails: prompt-injection gate, streaming leak detector, fail-closed spend budget and kill switch.',
  '- VISIONLENS, personal project (open source, MIT): TypeScript CLI classifying images across seven LLM vision providers (github.com/erikunha/VisionLens).',
  '- LEDGERLENS, personal project (open source, MIT): Python agent that investigates payment complaints and verifies every claim in its answer against the evidence it cited (github.com/erikunha/ledgerlens).',
  '- VAULT_OF_LOCI, personal project (open source, MIT): Obsidian vault template where AI agents quiz instead of answering, driven by one AGENTS.md across five agent tools, with a 17-scenario tutor test graded by a model of another family (github.com/erikunha/vault-of-loci).',
  '- REACT_GOOGLE_MAPS_API, open-source contribution (PR #3266): diagnosed and fixed an infinite re-render loop in the Directions API example of a library with about 1.8M weekly npm downloads; reviewed and merged by the maintainer.',
];

export const DESIGN_SYSTEM_LINES: readonly string[] = [
  'Published design system at /design-system. Covers:',
  '- Two-tier token pipeline (primitives to semantic tokens as CSS custom properties in app/css/theme.css)',
  '- 11 primitive components (Field is client for form interactivity; the other ten are RSC): Badge, BrandIcon, Button, CmdLine, Field, KbdKey, NavItem, Panel, StatTile, TerminalPanel, WindowChrome. The docs also provide a client CopyButton helper for clipboard access.',
  '- Enforcement: boundary lint, no-magic-values lint, contrast check, all in CI',
  '- Docs: /design-system/tokens, /design-system/components, /design-system/enforcement, /design-system/changelog',
  '- Foundations: /design-system/foundations/colors, /design-system/foundations/typography, /design-system/foundations/spacing-borders',
  '- Primitives: /design-system/primitives/badge, /design-system/primitives/brand-icon, /design-system/primitives/button, /design-system/primitives/cmd-line, /design-system/primitives/copybutton, /design-system/primitives/field, /design-system/primitives/kbd-key, /design-system/primitives/nav-item, /design-system/primitives/panel, /design-system/primitives/stat-tile, /design-system/primitives/terminal-panel, /design-system/primitives/window-chrome',
];

export interface LinkCopy {
  label: string;
  target: 'site' | 'cv' | 'cvPdf' | 'cvPdfPt' | 'github' | 'linkedin' | 'profileApi';
  description: readonly string[];
}

export const LINK_COPY: readonly LinkCopy[] = [
  {
    label: 'Portfolio',
    target: 'site',
    description: [
      'Live site with streaming AI terminal,',
      'performance receipts, and full project showcase',
    ],
  },
  { label: 'CV (HTML)', target: 'cv', description: ['Readable, printable curriculum'] },
  {
    label: 'CV (PDF, English)',
    target: 'cvPdf',
    description: ['The resume as a', 'PDF, four pages'],
  },
  {
    label: 'CV (PDF, Portuguese)',
    target: 'cvPdfPt',
    description: ['A tradução', 'do currículo, quatro páginas'],
  },
  { label: 'GitHub', target: 'github', description: ['Open source projects'] },
  { label: 'LinkedIn', target: 'linkedin', description: ['Full professional history'] },
  {
    label: 'Hiring profile API',
    target: 'profileApi',
    description: ['Machine-readable', 'hiring profile (JSON)'],
  },
];

export const LINK_PATH = {
  cv: '/cv',
  cvPdf: '/erik-cunha-cv.pdf',
  cvPdfPt: '/erik-cunha-cv-pt.pdf',
  profileApi: '/api/erik.json',
  ask: '/api/ask',
  llms: '/llms.txt',
  mcp: '/api/mcp',
} as const;

export const SUMMARY_LEAD_LINES: readonly string[] = [
  'of production software across AI-native SaaS,',
  'fintech, payments and e-commerce. Builds LLM systems and the evaluation that decides',
  'whether they are safe to ship.',
];

export const AVAILABILITY_FOCUS =
  'GenAI, AI-native products, LLM systems and agents (evals, guardrails, MCP)';

export const MANIFEST_COMMENT =
  'Bespoke manifest. The shape of this file (schemaVersion, endpoints, profiles, mcp) is custom to erikunha.dev. There is no published .well-known/agent.json standard it conforms to, so `schemaVersion` is a self-versioning date, not a reference to an external schema. Same posture as the custom `@type: HiringProfile` contract in lib/hiring-profile.ts.';

export const MANIFEST_SCHEMA_VERSION = '2026-05-21';

export const MANIFEST_DESCRIPTION_TAIL =
  'Lists endpoints for the hiring profile and experience questions.';

export const MANIFEST_ASK = {
  name: 'ask',
  description:
    "Ask a question about Erik's experience, stack, or availability. Answered by Claude Haiku 5.5 grounded only in the site's CV context.",
  method: 'POST',
  inputContentType: 'application/json',
  questionDescription: 'A natural-language question about Erik.',
  outputContentType: 'text/plain',
  outputDescription:
    'A streamed plain-text answer. On a mid-stream upstream failure the body ends with a NUL-byte sentinel (\\u0000ERR:<message>).',
  rateLimit: { requests: 8, window: '1h', scope: 'per-ip' },
} as const;

export const MANIFEST_PROFILES = [
  {
    name: 'erik.json',
    description: 'Structured HiringProfile document: employers, stack, receipts, availability.',
    path: LINK_PATH.profileApi,
    contentType: 'application/json',
  },
  {
    name: 'llms.txt',
    description: 'Plain-text profile summary for LLM crawlers.',
    path: LINK_PATH.llms,
    contentType: 'text/plain',
  },
  {
    name: 'cv.pdf',
    description: 'The resume as a PDF, four pages, English.',
    path: LINK_PATH.cvPdf,
    contentType: 'application/pdf',
  },
  {
    name: 'cv-pt.pdf',
    description: 'O currículo em PDF, quatro páginas, português.',
    path: LINK_PATH.cvPdfPt,
    contentType: 'application/pdf',
  },
] as const;

export const MANIFEST_MCP = {
  name: 'erikunha.dev MCP server',
  description:
    'Read-only Model Context Protocol server. Exposes get_profile (returns the HiringProfile) and ask_erik (proxies a question through /api/ask).',
  transport: 'streamable-http',
  tools: ['get_profile', 'ask_erik'],
} as const;

export const COMMUNITY_LABEL = 'DevOpsDays Campinas';

export const COMMUNITY_PAGES = { program: 'program/', organizers: 'contact/' } as const;
