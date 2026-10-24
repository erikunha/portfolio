# Coverage of the v20 review orchestrator

Every section of the source prompt, by number, with where it lives here. Status: **kept** (same
mechanism), **adapted** (same intent, this repo's surface), **replaced** (a different mechanism
does the job), **not applicable** (the system does not exist in this repo; a row in `domains.md`
says what to do if a change introduces it). `__tests__/review-orchestrator-coverage.test.ts`
fails if a section number is missing.

| # | Section | Status | Lives in |
|---|---|---|---|
| 1 | Execution philosophy | kept | SKILL.md flow |
| 2 | Prompt-compiler principles | kept | SKILL.md + references split (progressive disclosure) |
| 3 | Harness authority | kept | SKILL.md hard rules; CLAUDE.md and global rules win |
| 4 | Capability calibration | kept | SKILL.md section 1 |
| 5 | Capability surface model | adapted | routing.md surface table |
| 6 | Capability routing principle | kept | routing.md "who owns the information" |
| 7 | Dev-runtime integration | kept | routing.md skill routing (verification-planner, product-verifier, readiness-verdict) |
| 8 | Review entrypoint | adapted | this skill is the entrypoint; CI loads it via ci.md |
| 9 | Skill precedence | adapted | routing.md: project skills, then exact domain, then generic |
| 10 | Private Raylu skills | replaced | project skills in `.claude/skills` (semgrep, visual-baseline-regen, ai-eval-update) |
| 11 | Team vault skills | replaced | spec-kit `specs/` + Hindsight knowledge pages |
| 12 | User-level skill library | kept | routing.md skill routing; `skill-finder` before unconfirmed names |
| 13 | Skill router | kept | routing.md |
| 14 | Generic review skill dedup | kept | routing.md |
| 15 | Skills inside subagents | kept | orchestration.md workers; routing.md `SKILLS:` |
| 16 | Model routing | adapted | routing.md providers and effort by task shape |
| 17 | Model override discipline | kept | routing.md ("a missing tool is not fixed by a stronger model") |
| 18 | Delegation policy | kept | orchestration.md fan-out rules |
| 19 | Material domain matrix | adapted | domains.md |
| 20 | Review complexity | kept | SKILL.md section 3 |
| 21 | Fan-out rule | kept | orchestration.md |
| 22 | Agent granularity | kept | orchestration.md |
| 23 | Orchestration waves | kept | orchestration.md waves |
| 24 | Parallelism | kept | orchestration.md; SKILL.md section 4 |
| 25 | Expected agent roles | adapted | routing.md providers (routing-reviewer, validator, challenger, architect, Explore) |
| 26 | Routing contract | kept | routing.md track contract |
| 27 | Shared review context | kept | orchestration.md REVIEW-CONTEXT |
| 28 | Worker return contract | kept | output.md worker return |
| 29 | Follow-up protocol | kept | orchestration.md workers |
| 30 | Agent agreement is not source agreement | kept | routing.md |
| 31 | Local code-intelligence router | adapted | routing.md (codebase-memory, serena, graphify; token-savior has no routed review role here) |
| 32 | Remote product / design router | replaced | spec-kit spec + prototype export as design authority (no Linear, no Figma) |
| 33 | Claude.ai connector router | adapted | routing.md (Vercel only for deployment-specific questions; mail and calendar never for review) |
| 34 | Plugin router | kept | routing.md (chrome-devtools, context7, Playwright) |
| 35 | Claude-in-chrome | kept | routing.md surface table |
| 36 | GitHub | kept | routing.md (`gh`) |
| 37 | Capability lazy loading | kept | orchestration.md |
| 38 | Capability trust model | kept | orchestration.md workers; SKILL.md hard rules |
| 39 | Capability access in subagents | kept | orchestration.md workers |
| 40 | Vault context | replaced | Hindsight knowledge pages (SKILL.md section 2) |
| 41 | Raylu product model | adapted | domains.md content/identity consistency, honest contact states, "failure is not zero" in examples.md |
| 42 | Source authority | adapted | routing.md surface table |
| 43 | Exact review target | kept | SKILL.md section 2 (sub-PR bases) |
| 44 | Nx monorepo | not applicable | single Next.js app; domains.md |
| 45 | Frontend stack | adapted | domains.md stack facts (resolve from lockfile) |
| 46 | Dual query system | not applicable | domains.md |
| 47 | Query state semantics | adapted | output.md and examples.md: failure vs zero vs stale |
| 48 | Next.js 14 | adapted | domains.md rendering/caching row: name the cache layer, installed Next |
| 49 | React 19 RC | adapted | domains.md RSC/client boundary; research.md installed version |
| 50 | State ownership | adapted | domains.md client state row |
| 51 | Zustand | not applicable | domains.md (persisted state handled in client state row) |
| 52 | DataTable | not applicable | domains.md |
| 53 | TanStack Table v8 | not applicable | domains.md |
| 54 | Virtualization | not applicable | domains.md |
| 55 | Design system | adapted | domains.md design-system pages and tokens rows |
| 56 | Tokens | adapted | domains.md tokens row (Tailwind v4 silent failure) |
| 57 | Figma / design fidelity | adapted | domains.md UI fidelity row: prototype export; fidelity vs quality |
| 58 | Storybook | adapted | domains.md design-system pages row |
| 59 | Accessibility | kept | domains.md accessibility row |
| 60 | Responsive behavior | kept | domains.md responsive row |
| 61 | Backend | adapted | domains.md API boundary (defineHandler request trace) |
| 62 | API contract / codegen | adapted | domains.md API boundary: envelope vs every client reader (no codegen here) |
| 63 | Authorization | adapted | domains.md security row (cron bearer, MCP limiter; no user accounts) |
| 64 | Data ownership | adapted | domains.md data stores row (Upstash keys) |
| 65 | TypeORM / Drizzle | not applicable | domains.md |
| 66 | Transactions | adapted | domains.md data stores row (MULTI boundaries; nothing atomic across Redis and email) |
| 67 | Migrations | not applicable | domains.md (persisted client keys and Redis key shapes are the only migrations) |
| 68 | Temporal | not applicable | domains.md |
| 69 | BullMQ | not applicable | domains.md |
| 70 | Retry ownership | adapted | domains.md async/retries/crons row |
| 71 | Testing | kept | domains.md tests row |
| 72 | Negative control | kept | runtime.md; SKILL.md section 6 |
| 73 | Validators | kept | runtime.md gate groups |
| 74 | CI | adapted | domains.md CI row; ci.md |
| 75 | Local runtime | adapted | runtime.md local production run |
| 76 | Offline environment | adapted | runtime.md: no real Upstash, Resend or gateway credentials; e2e backend mocks |
| 77 | Local stack | adapted | runtime.md (single Next server on 3000) |
| 78 | Pre-browser preflight | kept | runtime.md (port and environment drift check) |
| 79 | Local session | not applicable | no auth in this site |
| 80 | Browser strategy | kept | routing.md surface table; runtime.md |
| 81 | Product verification | kept | runtime.md browser journeys (`product-verifier`) |
| 82 | Browser evidence | kept | runtime.md |
| 83 | Network / cache | kept | runtime.md network and read-back |
| 84 | Persistence read-back | kept | runtime.md |
| 85 | UI state inventory | kept | runtime.md |
| 86 | Performance | kept | runtime.md performance |
| 87 | Observability | kept | domains.md observability row |
| 88 | Security | kept | domains.md security row |
| 89 | AI / LLM systems | adapted | domains.md AI row (ask route, MCP tools, eval harnesses) |
| 90 | Exact-version research | kept | research.md |
| 91 | Community / GitHub research | kept | research.md upstream issues |
| 92 | Evidence language | kept | output.md evidence tags |
| 93 | Proof anchor law | kept | output.md |
| 94 | Convention law | kept | output.md (N of M) |
| 95 | History | kept | domains.md precedent/history row |
| 96 | Regression attribution | kept | runtime.md |
| 97 | Software design doctrine | kept | doctrine.md |
| 98 | TypeScript doctrine | kept | doctrine.md |
| 99 | Architecture doctrine | kept | doctrine.md |
| 100 | Data / distributed doctrine | kept | doctrine.md |
| 101 | Reliability doctrine | kept | doctrine.md |
| 102 | Testing doctrine | kept | doctrine.md |
| 103 | UX / HCI doctrine | kept | doctrine.md |
| 104 | Design / content doctrine | kept | doctrine.md |
| 105 | Security / API doctrine | kept | doctrine.md |
| 106 | Doctrine conflicts | kept | doctrine.md |
| 107 | Test quality track | kept | domains.md tests row; output.md |
| 108 | Performance track | kept | runtime.md performance |
| 109 | Architecture track | kept | routing.md (`routing-architect`, one decision) |
| 110 | Challenger | kept | SKILL.md section 6; orchestration.md wave 4 |
| 111 | Refutation | kept | SKILL.md section 6; output.md |
| 112 | Finding acceptance | kept | output.md |
| 113 | Finding contract | kept | output.md proof anchors and draft |
| 114 | Severity | adapted | output.md (CLAUDE.md gate failure is a blocker); CI keeps CRITICAL/IMPORTANT/MINOR |
| 115 | Right-column gate | kept | SKILL.md hard rules |
| 116 | Communication | adapted | output.md draft; CLAUDE.md thread rules for posting |
| 117 | Erik voice | kept | output.md draft voice |
| 118 | Humanization | kept | SKILL.md section 7 (`humanizer`, embedded) |
| 119 | Completion matrix | kept | output.md |
| 120 | Orchestration completeness | kept | orchestration.md gate |
| 121 | Main context protection | kept | orchestration.md |
| 122 | Context pressure | kept | orchestration.md |
| 123 | Cleanup | kept | orchestration.md; SKILL.md hard rules |
| 124 | Readiness | kept | output.md (`readiness-verdict`) |
| 125 | Bounded confidence | kept | output.md draft |
| 126 | End-to-end execution algorithm | kept | SKILL.md flow + orchestration.md waves |
| 127 | Example: frontend mutation | adapted | examples.md section redesign and API examples |
| 128 | Example: DataTable | replaced | examples.md section redesign example |
| 129 | Example: backend + database | adapted | examples.md API example |
| 130 | Anti-patterns | kept | examples.md |
| 131 | Review mindset | kept | examples.md |
| 132 | Acceptance criteria | kept | output.md "Done when" |
| 133 | Final output | adapted | output.md draft (local); CI prompt contract (ci.md) |
| 134 | Final directive | kept | SKILL.md opening and flow |
