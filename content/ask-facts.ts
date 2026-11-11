import { communityEvent } from './community';
import { education } from './education';
import { designSystemTake, homeTakes } from './hottest-takes';
import { OPEN_ROLES_SENTENCE } from './open-roles';
import { FUNDS_PHRASE, RAYLU_BUILT_CLAIM } from './profile';
import { type AskFacts, AskFactsSchema } from './schemas';
import { SITE_LOCALE } from './site-locale';
import { WORK_SCOPE_SENTENCE } from './work-scope';

const mbaPeriod = education[SITE_LOCALE.en].find((entry) => entry.id === 'MBA_AI_ENG')?.period;

const TRAILING_PERIOD_PATTERN = /\.$/;
const EVENT_NAME_SEPARATOR = '_';
const ORGANIZING_TEAM_SIZE = 'nine';

const event = communityEvent[SITE_LOCALE.en];
const [talksBullet = '', speakerCycleBullet = ''] = event.bullets;
const eventName = event.name
  .split(EVENT_NAME_SEPARATOR)
  .map((word) => `${word.charAt(0)}${word.slice(1).toLowerCase()}`)
  .join(' ')
  .replace('Devopsdays', 'DevOpsDays');

const publishedTakes = [...homeTakes(SITE_LOCALE.en), designSystemTake(SITE_LOCALE.en)].flatMap(
  (take) => (take ? [take.thesis] : []),
);

export const askFacts: AskFacts = AskFactsSchema.parse({
  openTo: `Open to ${WORK_SCOPE_SENTENCE}. Not limited to remote work. Anything else about where or how Erik can be hired is answered by the contact email, never guessed.`,
  coreStack: [
    `AI: 12-agent GitHub Copilot engineering system at Betsson (codegen, review, debugging, testing, architecture validation), the investor workflow screens of Raylu's AI deal origination platform (${FUNDS_PHRASE}), a governed Claude endpoint with a CI eval harness (this portfolio shell), a LangChain payment-complaint agent with a claim verifier (LedgerLens, personal project), daily work in Claude Code and Codex authoring skills, guard policies and lifecycle hooks`,
    'AI-native: Vercel AI SDK + AI Gateway, Anthropic API, OpenAI, Google GenAI/Vertex, MCP servers, Zod structured output, eval harnesses with LLM judge calibrated on human labels, per-job cost caps, prompt-injection defense, agent and sub-agent orchestration, Claude Code/Codex skills, spec-driven development, model routing with cost ceilings',
    'Frontend: React, Next.js, TypeScript, Angular, TanStack, Plate, Tailwind, Radix, Stencil web components, SSR/SSG/ISR',
    'Backend: Node.js, Express.js, REST APIs, PostgreSQL, MongoDB, SQLite, Microsoft SQL Server',
    'Languages: TypeScript, JavaScript (ES6+), SQL, Python (in personal projects and coursework, not in a production service)',
    'Testing: Playwright, Jest, Vitest, MSW, WireMock, Stryker',
    'Cloud: AWS (CodePipeline, CodeBuild, S3, CloudFront, EC2), Docker, NGINX, Jenkins, GitHub Actions',
  ],
  currentRoleScope: [
    `Erik ${RAYLU_BUILT_CLAIM}. Do NOT widen this to whole-platform ownership: the scope is that frontend platform plus the backend changes listed under Raylu in the employment history below, not the whole product, its models or the company.`,
    'He built the table engine from zero: the subsystem did not exist before June 2026, he built it alone through June, and one other engineer co-developed it from the second month. He never claims sole ownership of it.',
    'The table is a real table element, not an ARIA grid: it does not implement role="grid", aria-rowcount or aria-colcount, and sort announcements were never tested · do not claim those. The accessibility work on it was specified in design documents, not all verified in the product.',
  ],
  currentRoleDetail: [
    'Architecture: the table engine has a headless core (state, codecs, view-model logic) kept apart from the React components. The dependency points one way only: core code never imports the component layer or react-dom, which one grep can check.',
    'View-state contract: it covers sort, typed filters, search, column order and size, grouping and pagination. Codecs are namespaced so several tables can share a page. A versioned migration chain falls back to a default instead of throwing on untrusted input, so a link shared months ago still opens a working view and never returns unfiltered data by accident.',
    'Verification: the engine was exercised against 5,000-row fixtures with exact geometry invariants. The heavy-scroll timings come from Storybook and from a code path no app screen uses, so they are component facts, not product claims.',
    'Method of the production comparison: each of four routes was built twice, at the migration commit and at its direct parent, both served against one shared backend and measured with Lighthouse and a Playwright harness (medians of three runs, 4x CPU throttle). It is a build-versus-build comparison, not a live traffic split.',
    'Results, with the half that did not improve: accessibility improved on all four routes (unnamed controls fell to 1 per route, from 55 on the worst route, and the select-name failure was eliminated everywhere). One failing Core Web Vital was fixed on the pipelines route only: CLS 0.166 to 0, Lighthouse performance 79 to 96 and LCP 2,544 to 1,308 ms. All three figures belong to the pipelines route only. Performance was flat on the other routes.',
    'Measurement rules he now follows: production builds, not dev servers (an earlier dev-server round claimed wins and regressions that production builds overturned, and he recorded the retractions in writing). Lighthouse performance and accessibility run separately. Identical scores on routes with different content mean the audit hit the wrong page. A timing taken in a hidden browser tab is an artifact. He reads the denominator and the error count before the headline.',
    'Repository figures for the table subsystem, internal and to be quoted with their caveats: Erik created 189 of its 262 files and holds 53.2% of the surviving lines, while the other engineer holds 44.2%. git blame credits surviving lines, so a later refactor moves credit even when the design is unchanged: file creation is the better evidence of who designed it, line share of who maintains it. About half of his added lines are tests or stories, its core has 118 files with zero imports from the UI layer, duplication is 3.17%, 92% of commits follow Conventional Commits, and there are 26 refactor commits to 7 fix commits.',
    'Accessibility figures for the same subsystem, with their caveat: in Storybook, 97.2% of its stories pass an automated axe check against 63.6% for a different, older component set, and Lighthouse accessibility scored 98 against 95 on those stories. These compare two different component sets in a dev build, not the same UI rebuilt, and automated checks catch only a minority of real barriers.',
    'Outreach editor: he chose Plate after comparing Plate, Lexical, TipTap and ProseMirror against an evidence log, and holds personalization as document structure so the author sees before sending which details resolve for each recipient and which fall back.',
    'Design documents come before code: decision records, an evidence log citing code by path and line against the main branch, acceptance criteria in EARS format, a WCAG criterion-by-criterion table and a rollback plan keyed to a named signal rather than a date.',
  ],
  targeting: [
    `Open to: ${OPEN_ROLES_SENTENCE[SITE_LOCALE.en]}. GenAI, AI-native products, LLM systems and agents (evals, guardrails, MCP).`,
    `Direction: applied AI engineering: LLM systems, the evaluation that decides whether they are safe to ship, agents and guardrails; MBA in AI Engineering in progress (Instituto Infnet, ${mbaPeriod}).`,
    'Strong preference: AI-native products and agent systems that ship with evals and guardrails, and performance-critical systems.',
  ],
  workingStyle: [
    'Error path first: each design names the failure the system prevents (idempotency on a message id, a tested rollback, a leak detector over a sliding window), not only the happy path.',
    'Design before code: engine choice, migration order, rollback windows and accessibility contracts are settled in writing first.',
    'Short measured loops: platform changes are measured route by route and the numbers decide. Experiments carry stop-loss criteria agreed before launch.',
    'Exact figures when something was measured in code, "about" for operational aggregates. He reports the half that did not improve alongside the half that did.',
    'Verifies AI output in layers: deterministic checks first (tests, types, lint, build), then a reviewer that did not write the change, then a look at what the checks cannot see. Passing checks is necessary, not sufficient. The agent drafts, the checks and a separate reviewer decide.',
    'Parallel agents with rules: reading is parallelized freely, writers get their own git worktree and an exact file list so two writers never touch the same file, each gets a short written contract (objective, scope, files it may touch, validation, stop conditions), and Erik integrates and runs the tests himself. More agents is not automatically faster: tightly coupled work is often better with one.',
    'He authors the skills, hooks and guard policies his coding agents run under: a pre-tool hook checks each command against a policy file and stops what cannot be undone until it is approved, another hook refuses to read credential files, and project rules are kept short and human-written.',
    'Estimates are anchored on comparable real work with the comparison attached, never on a generated number. AI output is a working note, not what gets published.',
    'Tests are the lever for accepting agent output cheaply, and coverage targets error paths and empty states: branch coverage of 85.4% against a 65.8% library baseline only moves when those are exercised.',
    'Says plainly when something is a personal system he built, runs and owns, never borrows an employer scale for it, and names the gap in one clause.',
  ],
  decisions: [
    {
      decision: 'Virtualize table rows over a real table element with segmented spacers (Raylu)',
      rejected: 'a CSS display:grid layout, which was simpler',
      because:
        'it keeps native table accessibility semantics: row and column headers, aria-sort and a polite live region',
    },
    {
      decision:
        'Build the payment primitives as framework-agnostic StencilJS Web Components driven by white-label configuration (Betsson)',
      rejected: 'a shared React library',
      because:
        'it would tie every host to one framework and one release cadence, the coupling the brand split exists to avoid, and payment logic must not diverge between brands',
    },
    {
      decision:
        'Model deposits and withdrawals as async state machines with a recovery state for every failed step from the first design (Betsson)',
      rejected: 'adding error handling later',
      because:
        'in a regulated payment flow the error path is the requirement, and a timed-out payment has an unknown outcome, so the flow polls provider status instead of retrying blindly or reporting success',
    },
    {
      decision:
        'Replace waterfalled requests with concurrent loading and tune change detection (Forward Deployed Engineer)',
      rejected: 'adding a cache layer',
      because: 'the slowness was request sequencing, and a cache would have hidden the symptom',
    },
    {
      decision:
        'Rewrite the queries and add PostgreSQL indexes behind a 40-second reporting API (Venturus)',
      rejected: 'caching a slow read',
      because: 'the cause was how the ORM queried the data',
    },
    {
      decision:
        'Write a database migration by hand as an additive nullable column, with a rehearsed backfill and a tested rollback (Raylu)',
      rejected: 'the ORM-generated migration',
      because:
        'the generator wanted hundreds of unrelated statements, one a rename that would have wiped an existing column',
    },
    {
      decision:
        'Leave the new date empty on old rows that have no save event, and show "unknown" in the UI (Raylu)',
      rejected: 'falling back to the created date',
      because: 'that fallback would have been right only about a third of the time',
    },
    {
      decision: 'Choose Plate for the shared outreach editor (Raylu)',
      rejected: 'Lexical, TipTap and ProseMirror',
      because: 'Plate won an evidence log that compared all four',
    },
    {
      decision:
        'Ground the site assistant on a curated set of facts placed in the prompt (this portfolio)',
      rejected: 'a vector index',
      because: 'the set of facts is small',
    },
  ],
  stories: [
    {
      title: 'Payment primitives across frameworks (Betsson)',
      text: 'Each brand needed its own orchestration, but payment logic could not diverge between brands, because divergence in a regulated payment flow is an audit risk. Erik built the primitives as framework-agnostic StencilJS Web Components driven by white-label configuration in an Nx monorepo, so hosts on different frameworks consume one source. He rejected a shared React library because it would tie every host to one framework and one release cadence.',
    },
    {
      title: 'Failure as a requirement (Betsson)',
      text: 'Deposits and withdrawals were multi-step and audited across 15+ jurisdictions, so Erik modeled them as async state machines in RxJS and NgRx with recovery states for every failed step from the first design. For Trustly and Yape, a timed-out payment has an unknown outcome, so the flow polls provider status instead of retrying blindly or reporting success.',
    },
    {
      title: 'Diagnose before adding a cache (Forward Deployed Engineer)',
      text: 'The service platform was slow to become interactive. Erik traced it to waterfalled request chains, a sequencing problem and not a data-freshness problem, replaced them with concurrent loading and tuned change detection, and did not add a cache layer that would have hidden the symptom. Time to interactive fell about 52%, the JS bundle about 33%, layout-shell CSS about 98% and initial load about 25% through lazy loading and a utility-class refactor.',
    },
    {
      title: 'From 40 seconds to under 1 (Venturus)',
      text: 'A customs-compliance reporting API took about 40 seconds. Erik traced it to how the ORM queried the data, rewrote the queries and added PostgreSQL indexes instead of caching a slow read, and other endpoints went from 2 seconds to 200 ms. He also migrated document-heavy data from MongoDB to PostgreSQL with a Node.js ETL, validated by matching row counts and running the main reports on both databases, with MongoDB kept read-only as the rollback path.',
    },
    {
      title: 'Idempotent webhooks (MB Labs)',
      text: "Facebook Workplace retried webhook deliveries, so some training answers were recorded twice and scores came out wrong. Erik made ingestion idempotent on the message id. The same system's dispatcher fanned one push out to Firebase Cloud Messaging and Workplace with retry and backpressure per channel, so one channel failing never dropped a campaign.",
    },
    {
      title: 'Experiments with stop-loss criteria (Grupo SBF)',
      text: 'Erik ran 20+ Google Optimize 360 A/B experiments on the Nike Brazil and Centauro storefronts, each with stop-loss criteria agreed before launch, and conversion rose about 10% across the programme. Page load fell about 32% through code splitting, image optimization and caching, a separate result and not the cause of the conversion gain. He held about 70% coverage on the four revenue-critical checkout journeys and mentored four junior engineers.',
    },
    {
      title: 'Links that never lie (Raylu)',
      text: 'Data-dense investor pages had to be shareable by URL, survive a refresh and evolve without breaking old links, where a wrong link means wrong data in front of someone allocating capital. Erik froze a view-state contract, wrote namespaced URL-safe codecs and added a versioned migration chain that falls back to a default instead of throwing on untrusted input. A bug where a shared filtered link returned unfiltered data was fixed while moving list pages onto the engine.',
    },
    {
      title: 'Proving it in the product (Raylu)',
      text: 'To prove the table migration outside Storybook, Erik built eight production builds (four routes, each at the migration commit and at its parent) and measured them with Lighthouse and a Playwright harness. Accessibility improved on all four routes and one failing Core Web Vital was fixed on the pipelines route, and he reported that performance was flat on the others. It was a build comparison, not a live traffic split.',
    },
    {
      title: 'Being wrong about a layout shift (Raylu)',
      text: 'During that work Erik filed a ticket blaming the new component for a CLS of 0.111. Two controls (blocking the web fonts changed nothing, and a filmstrip showed the same rows at two type scales) showed Storybook was injecting CSS at runtime. In the app the shift was zero, so he cancelled the ticket. The lesson he keeps: read the denominator and the error count before the headline number.',
    },
    {
      title: 'A migration written by hand (Raylu)',
      text: 'The ORM generator wanted hundreds of unrelated statements, one a rename that would have wiped an existing column, so Erik wrote the migration by hand as an additive nullable column. He ran the migration and its rollback locally, rehearsed the backfill on production-shaped data, made the backfill write only where the value was null, and left old rows with no save event empty.',
    },
    {
      title: 'The filter that hid what you owned (Raylu)',
      text: "The Team filter matched collaborators but not owners, so filtering by yourself hid your own companies. Erik moved it to a Postgres EXISTS subquery, tested it against a real database (including a user with 65,536 companies) and checked every endpoint before and after. One owner's matches went from 14 to the correct 75.",
    },
    {
      title: 'The bugs were around the model (this portfolio)',
      text: "Most defects in the site's LLM endpoint were accounting, cancellation and grading, not the model: a budget reservation not refunded when the provider failed early, cache tokens counted twice, evals grading truncated streams, invisible Unicode characters slipping past the injection match, and an empty answer on provider failure. This is why he treats LLM features as distributed systems first.",
    },
    {
      title: 'Re-anchoring an estimate (Raylu)',
      text: 'An estimate for a large editor feature was questioned. Erik re-anchored it on 14 comparable migrations, with their diffs attached, which gave 3 to 4 weeks, cut two scope items and withdrew a claim of his own that the evidence did not support. Since then estimates carry the comparison they came from.',
    },
  ],
  opinions: [
    ...publishedTakes,
    'A cache is the wrong fix when the bottleneck is request sequencing or the data access pattern.',
    'In a regulated flow, the error path is the requirement, not an edge case.',
    'Virtualize over a real table element, not display:grid, to keep native accessibility semantics.',
    'More agents is not automatically faster: sequential, tightly coupled work is often better with one.',
    'Long generated context files tend to hurt more than help: keep project rules short and human-written.',
    'Tests are what make agent output cheap to accept.',
    'Estimates should be anchored on comparable real work.',
    'Measure AI-assisted work by review time and defects, not by usage.',
    'Self-reported model confidence is a model signal, not a calibrated one.',
  ],
  calibration: [
    'No production RAG or vector search: RAG, embeddings and FAISS are MBA coursework and personal projects (LedgerLens included). His shipped AI work is the eval harness and the governed endpoint, grounded on facts placed in the prompt, not a vector index.',
    'No production Python service: employer backends were Node.js, and his Python is in personal projects and MBA coursework.',
    'AWS: delivery pipelines to S3 and CloudFront and a hand-configured EC2, RDS and NGINX app. Not a multi-account fleet at scale.',
    'NestJS and XState v5: no stated production use. His state-machine experience is RxJS and NgRx.',
    'The personal endpoint is public but low traffic: never imply paying users.',
    'No formal people management: only mentoring four junior engineers at Grupo SBF.',
    'Employer revenue, assets, customers and platform volume are business context, not personal ownership.',
    'Spanish is B1 and he cannot yet hold a technical conversation in it. English is C1.',
    'Use only figures stated in this prompt (no onboarding-time reductions, page counts, skill or agent counts, or store counts other than 800+). No React 19 at any employer, no TanStack Query at the consulting client, no Claude Code or Codex at Raylu (Next.js 14, TypeScript 5, Fastify, TypeORM).',
    'The employment history is complete: for an employer not in it, say it is not in his record.',
    'The 12-agent Betsson system has no measured before-and-after figure and no adoption headcount. He would set a baseline first and measure review time and defects, not usage.',
  ],
  community: [
    `Organizer of ${eventName} ${event.year}, one of ${ORGANIZING_TEAM_SIZE} on the organizing team. Erik ${talksBullet.replace(TRAILING_PERIOD_PATTERN, '')} and ${speakerCycleBullet}`,
    'Writing: two dev.to articles, "Creating Type-Safe Forms in Angular: Advanced Tip" (Aug 2023) and "What are Progressive Web Apps (PWAs)" (Oct 2021).',
  ],
  projectDetail: [
    'LedgerLens (github.com/erikunha/ledgerlens, MIT) is a personal project, not a production service. It runs on Python 3.12 and LangChain 1.4, with a create_agent integrator and a legacy AgentExecutor integrator side by side, sharing the same tools, prompt and verifier. A Pydantic triage step (intent, entities, urgency, plan) runs before the agent.',
    'LedgerLens has six tools: read-only text-to-SQL whose guard refuses UPDATE, DROP and internal tables, a ledger API, FAISS policy search with query rewriting, ECB reference exchange rates through Frankfurter, a Decimal calculator so numbers never come from the model, and case memory. The verifier uses an NLI model for text claims and code checks for numbers, rates and exchange-rate dates. Escalation to human review is rule-based, and it never changes data.',
    'LedgerLens runs fully offline with no keys (a scripted model, local fastembed embeddings, recorded HTTP), and its CI gate is ruff plus pytest offline. The data is public first (UCI Online Retail II, ECB rates, a BIN list), with simulation on a fixed seed only for gaps and planted anomalies with ground truth. A Streamlit demo portal shows the live agent trace.',
    'LedgerLens results on thirty cases, three runs each, gpt-4.1-mini at temperature 0: correctness 0.17 for the tool-free chain, 0.55 for the ReAct agent and 0.82 for the full agent with the verifier. Groundedness is 0.74, for the full agent only. Cases sent to human review out of thirty: 30, 29 and 9.3. Tool trajectory is 0.73 against a 0.80 target, a miss. On a verifier set of forty-three cases, contradiction recall is 1.00 with no false positives. The run cost about US$0.59.',
    'LedgerLens limits: thirty cases show a trend, not statistical significance. The NLI model over-flags true sentences as not enough evidence. The exchange rate is a reference rate, not an acquirer rate.',
  ],
});
