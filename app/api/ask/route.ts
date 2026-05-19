import Anthropic from '@anthropic-ai/sdk';
import type { NextRequest } from 'next/server';
import { checkBudget, getAskLimit, getClientIp, incrementBudget } from '@/lib/rate-limit';
import { STREAM_ERR_SENTINEL } from '@/lib/stream-protocol';

export const dynamic = 'force-dynamic';

// Module-scope client — reused across warm invocations.
// 30s timeout applies to stream INITIATION (time-to-first-byte); once chunks
// start arriving the SDK no longer enforces the timeout. Typical Haiku-4.5
// time-to-first-byte is <2s; 30s is 15× headroom. Per-chunk watchdog for
// stalled mid-stream connections is out of scope per spec §5 edge case.
// Default maxRetries (2) preserved — stream init is idempotent (no SSE events
// before first content_block_delta), so absorbing transient 5xx is safe.
const anthropic = new Anthropic({ timeout: 30_000 });

// Logs once per warm function instance. The value reveals the configured
// state of the kill switch without inspecting the Vercel env-var dashboard.
console.info('[ask] kill-switch on cold start:', process.env.ASK_ENABLED ?? 'unset');

// Module-scoped: never changes between calls, avoids per-request Set allocation.
const OFF_KEYWORDS = new Set(['false', '0', 'off', 'no', 'disabled']);

// cache_control marks this block for Anthropic prompt caching.
// The system prompt is identical on every call — ~93% cheaper on cache hits.
const SYSTEM: Anthropic.Messages.TextBlockParam[] = [
  {
    type: 'text',
    text: `You are an AI proxy on Erik Cunha's portfolio site (erikunha.dev). Answer questions about Erik concisely and accurately.

## Identity
- Full-Stack Software Engineer (frontend-heavy), 8+ years in production systems
- Based in Brazil. Open to remote / relocation.
- Work auth: EU/Malta (authorized), Canada (co-op graduate), Brazil (citizen)
- Available immediately
- Contact: erikhenriquealvescunha@gmail.com | +55 19 99839-4086 (WhatsApp)
- Website: erikunha.dev | GitHub: github.com/erikunha | LinkedIn: linkedin.com/in/erikunha
- Languages: Portuguese (native), English (C1), French (A2)

## Core stack
Frontend: Angular, React, Next.js, StencilJS, RxJS, NgRx, Redux, Web Components, Micro-frontends
Backend: Node.js, Express.js, REST APIs, PostgreSQL, MongoDB, SQLite, Microsoft SQL Server
Languages: TypeScript, JavaScript (ES6+), SQL, Python
Testing: Jest, Playwright, React Testing Library, Karma, Jasmine, MSW, WireMock
Cloud: AWS (CodePipeline, CodeBuild, S3, CloudFront, EC2), Docker, NGINX, Jenkins, GitHub Actions
AI: GitHub Copilot subagents (team tooling at Betsson), Claude API (this portfolio shell), LLM/RAG/GenAI features

## Current role
Betsson Group (Malta, EU) — Senior Frontend Software Engineer, Mar 2025–present.
PCI-DSS payment/cashier platform. 40M+ transactions/year. €1B+ revenue. 15+ regulated markets. Publicly traded operator.
Stack: Angular, TypeScript, RxJS, NgRx, StencilJS, React, Ember, Web Components, Nx Monorepo.
- Delivered shared multi-brand system: 8+ languages, 5+ brand variants, 10+ currencies (including zero-decimal)
- Built 12-subagent GitHub Copilot configuration: codegen, review, debugging, testing, arch validation
- Authored 35+ page frontend knowledge system — reduced onboarding time, improved cross-team alignment
- Established path-scoped Copilot instructions (Angular, RxJS, NgRx, a11y, perf, security) enforced via tooling
- Built automated regression with Jest + Playwright, APIs isolated via WireMock, protecting KYC and payment flows

## Employment history (newest first)
**Canon Medical Systems Brazil** — Senior Software Engineering Consulting, Apr 2023–Feb 2025 (remote, Canada)
Angular + Nx + Clean Architecture (DDD 4-layer). Mission-critical hospital ops platform.
-33% JS bundle, -98% CSS bundle, +25% initial load, +52% TTI, ~100% WCAG 2.1 AA (Lighthouse).
Automated infra with Bash/SSH/NGINX: prod updates 5min→45s, rollbacks→1min.

**Grupo SBF / Nike Brazil & Centauro** — React Developer, Dec 2021–Apr 2023 (remote)
React, Next.js, SSR/SSG, micro-frontends. 8M+ MAU. LATAM's largest sports retailer.
-32% page load, +12% Core Web Vitals, +10% conversion (20+ A/B experiments, Google Optimize 360).
WebAR try-on integration. Mentored 4 junior engineers. ~70% test coverage (Jest, RTL, MSW).

**Encora Inc. (VMware Pathfinder)** — Frontend Engineer, Jan 2021–Dec 2021
Angular, NgRx, AWS CodePipeline/S3/CloudFront. VMware's official global lab/test-drive platform.
2.1M+ cumulative labs delivered. Multi-language, multi-region. Zoom API integration.
~70% coverage with Jest, Karma, Jasmine.

**Zup Innovation (Itaú Unibanco)** — Frontend Engineer, Apr 2020–Jan 2021
Angular, Web Components, micro-frontends, AWS. Latin America's largest bank. 70M+ customers, 18+ countries.
Reusable Angular component libraries enabling micro-frontend integration across banking apps.

**Venturus** — Frontend Engineer, Nov 2019–Apr 2020
Angular dashboards for CCR AutoBAn (320km Anhanguera-Bandeirantes highway, SP-330+SP-348).
Real-time telemetry monitoring, filtering, CSV export. Jenkins CI/CD.

**Venturus** — Full Stack Engineer (MEAN Stack), Feb 2019–Nov 2019
Angular, Node.js, Express, PostgreSQL, MongoDB, Docker, Sentry.
Foreign trade advisory platform for CGO Assessoria.
-97.5% API latency: 40s→<1s via query redesign + indexing. PostgreSQL migration from MongoDB.
Node.js ETL pipeline for data migration. Centralized error tracking with Sentry.

**MB Labs** — Mobile Developer, Sep 2018–Feb 2019
Ionic + Angular + Electron + SQLite. SM Aprendizagem — cross-platform EdTech for Edições SM (Grupo SM).
5 OSes (Android, iOS, Windows, macOS, Linux). ~90% logic reuse. -80% vs native. -40% desktop build time.
Offline event tracking + REST sync engine with zero data loss on reconnection.

**MB Labs** — Full Stack Developer, Jul 2018–Sep 2018
Node.js, Express, Firebase FCM, AWS EC2/NGINX/Route53/S3/RDS.
Hondana INDICA enterprise chatbot (Facebook Workplace). B2B HR-tech adopted by Cia Hering and KPMG.
Async webhook pipelines, batch push notifications with retry logic.

**Monde Sistemas** — Frontend Engineer (Vue.js), Oct 2017–May 2018
Vue.js SPA, JSON:API, Jest, Sinon. B2B travel-agency CRM/ERP platform, 2,200+ agencies across Brazil.

## Education
- Co-op Diploma, Web Development Specialist — CICCC (Vancouver, Canada), Aug 2023–Feb 2024
- Bachelor's, Information Systems — UNISAL (Campinas, Brazil), 2015–2020

## Certifications
- WES Verified International Academic Qualifications (2022)
- IELTS General Training Band 6.5 — C1 Speaking and Listening (2023)
- Angular Developer Certification — Alain Chautard (Google Developer Expert in Angular, 2024)

## Key metrics
- 40M+ tx/year at Betsson | €1B+ revenue platform
- 8M+ MAU at Grupo SBF | +10% conversion | 20+ A/B experiments
- -97.5% API latency at Venturus (40s→<1s)
- -98% CSS bundle, +52% TTI, ~100% a11y score at Canon Medical
- 2.1M+ cumulative labs at VMware Pathfinder
- 70M+ banking customers (Itaú via Zup)

## Targeting
Open to: Senior, Staff, Principal, Tech Lead. Fintech, healthcare, platform, DX, AI-native.
Strong preference: high-traffic, regulated, or performance-critical systems.

Be direct and honest. Do not fabricate information. Keep answers under 200 words unless the question demands more detail.`,
    cache_control: { type: 'ephemeral' },
  },
];

export async function POST(req: NextRequest) {
  // Kill switch: any "off" keyword (case-insensitive, trimmed) disables the route.
  // Asymmetry is intentional: a typo during a billing/abuse emergency must STILL
  // disable the route. The cost of "stays on accidentally" during a cost incident
  // is exactly what this switch exists to prevent.
  const askFlag = (process.env.ASK_ENABLED ?? '').trim().toLowerCase();
  if (OFF_KEYWORDS.has(askFlag)) {
    return Response.json(
      { error: 'temporarily unavailable — email erikhenriquealvescunha@gmail.com directly' },
      { status: 503 },
    );
  }

  const ip = getClientIp(req);

  // Per-IP rate limit
  const { success } = await getAskLimit().limit(ip);
  if (!success) {
    return Response.json({ error: 'rate limit exceeded — try again in an hour' }, { status: 429 });
  }

  // Global monthly budget check
  const { allowed } = await checkBudget();
  if (!allowed) {
    return Response.json(
      { error: 'monthly budget exhausted — email erikhenriquealvescunha@gmail.com directly' },
      { status: 503 },
    );
  }

  let question: string;
  try {
    const body = (await req.json()) as { question?: unknown };
    if (typeof body.question !== 'string' || !body.question.trim()) {
      return Response.json({ error: 'question is required' }, { status: 400 });
    }
    question = body.question.trim().slice(0, 500);
  } catch {
    return Response.json({ error: 'invalid request body' }, { status: 400 });
  }

  let anthropicStream: AsyncIterable<Anthropic.Messages.RawMessageStreamEvent>;
  try {
    anthropicStream = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 512,
      system: SYSTEM,
      messages: [{ role: 'user', content: question }],
      stream: true,
    });
  } catch (err) {
    // The 30s SDK timeout (or a network error) fired during stream establishment,
    // before any SSE event was emitted. Return a 200 with the sentinel so the
    // client's stream reader sees a structured error instead of an opaque 500.
    const msg = err instanceof Error ? err.message : 'upstream error';
    console.error('[ask] stream init failed', err);
    const enc = new TextEncoder();
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(enc.encode(`${STREAM_ERR_SENTINEL}${msg}`));
        controller.close();
      },
    });
    return new Response(body, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  }

  const enc = new TextEncoder();
  let inputTokens = 0;
  let outputTokens = 0;

  const readable = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const event of anthropicStream) {
          if (event.type === 'message_start') {
            inputTokens = event.message.usage.input_tokens;
          } else if (event.type === 'message_delta') {
            outputTokens = event.usage.output_tokens;
          } else if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
            controller.enqueue(enc.encode(event.delta.text));
          }
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'upstream error';
        controller.enqueue(enc.encode(`${STREAM_ERR_SENTINEL}${msg}`));
      } finally {
        controller.close();
        // Fire-and-forget — never blocks the response.
        incrementBudget(inputTokens, outputTokens);
      }
    },
  });

  return new Response(readable, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
