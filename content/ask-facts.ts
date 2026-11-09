import { education } from './education';
import { FUNDS_PHRASE, RAYLU_OWNED_SCOPE } from './profile';
import { type AskFacts, AskFactsSchema } from './schemas';
import { SITE_LOCALE } from './site-locale';
import { WORK_SCOPE_SENTENCE } from './work-scope';

const mbaPeriod = education[SITE_LOCALE.en].find((entry) => entry.id === 'MBA_AI_ENG')?.period;

export const askFacts: AskFacts = AskFactsSchema.parse({
  openTo: `Open to ${WORK_SCOPE_SENTENCE}. Anything else about where or how Erik can be hired is answered by the contact email, never guessed.`,
  coreStack: [
    'Frontend: React, Next.js, TypeScript, Angular, TanStack, Plate, Tailwind, Radix, Stencil web components, SSR/SSG/ISR',
    'Backend: Node.js, Express.js, REST APIs, PostgreSQL, MongoDB, SQLite, Microsoft SQL Server',
    'Languages: TypeScript, JavaScript (ES6+), SQL, Python',
    'Testing: Playwright, Jest, Vitest, MSW, WireMock, Stryker',
    'Cloud: AWS (CodePipeline, CodeBuild, S3, CloudFront, EC2), Docker, NGINX, Jenkins, GitHub Actions',
    `AI: 12-agent GitHub Copilot engineering system at Betsson (codegen, review, debugging, testing, architecture validation), the investor workflow screens of Raylu's AI deal origination platform (${FUNDS_PHRASE}), a governed Claude endpoint with a CI eval harness (this portfolio shell), daily work in Claude Code and Codex authoring skills, guard policies and lifecycle hooks`,
    'AI-native: Vercel AI SDK + AI Gateway, Anthropic API, OpenAI, Google GenAI/Vertex, MCP servers, Zod structured output, eval harnesses with LLM judge calibrated on human labels, per-job cost caps, prompt-injection defense, agent and sub-agent orchestration, Claude Code/Codex skills, spec-driven development, model routing with cost ceilings',
  ],
  currentRoleScope: [
    `Owns ${RAYLU_OWNED_SCOPE}. Do NOT widen this to whole-platform ownership: the scope is that frontend platform plus the backend changes listed under Raylu in the employment history below, not the whole product, its models or the company.`,
    'The table is a real table element, not an ARIA grid: it does not implement role="grid", aria-rowcount or aria-colcount · do not claim those.',
  ],
  targeting: [
    'Open to: Senior, Tech Lead. GenAI, AI-native products, LLM systems and agents (evals, guardrails, MCP).',
    `Direction: applied AI engineering: LLM systems, the evaluation that decides whether they are safe to ship, agents and guardrails; MBA in AI Engineering in progress (Instituto Infnet, ${mbaPeriod}).`,
    'Strong preference: AI-native products and agent systems that ship with evals and guardrails, and performance-critical systems.',
  ],
});
