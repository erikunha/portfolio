# Claude Skill/Agent/Plugin Discovery Ledger

> Exhaustive delta scan of every major Claude skills/agents/plugins catalog, scored for fit to THIS repo (Next.js 16 / React 19 / TS-strict / Biome / pnpm / Vercel Edge / Upstash / AI SDK v6 / Playwright + Vitest / axe + Lighthouse CI; personal-portfolio reference system with strict perf/a11y/security gates + Superpowers 5-agent review workflow).
>
> **Scan date:** 2026-05-30. **Method:** catalog/frontmatter only, nothing installed or executed. **Rubric — Fit 1-5:** 5 = closes a real gap not already covered; 3 = useful but overlaps existing gates; 1 = irrelevant. **Verdict:** ADD (fit≥4, net-new, safe) · WATCH (promising but risk/uncertain/overlap) · SKIP (redundant/irrelevant/SaaS-exfil) · HAVE (installed).
>
> This ledger is the dedupe baseline for the next scan. Update verdicts here rather than re-discovering.

## Tail enumeration (per-row, 2026-05-30) — closes the category-sampling gap

The two mega-aggregators were first category-sampled. They have now been read PER-ROW via the GitHub tree API / raw README. Result: the earlier counts were undercounts, and the per-row read confirms **zero hidden ADDs** in the tail.

- **alirezarezvani/claude-skills:** 325 canonical skills enumerated (749 SKILL.md blobs = a `.gemini/` mirror artifact, not 749 distinct). 35 matched the stack keyword net; after scoring, **1 new fit-4 WATCH: `security-guidance`** (a PreToolUse Edit/Write hook blocking cmd-injection/XSS/SQLi — a *preventive* mechanism vs your post-hoc semgrep; NB name-collides with the installed Anthropic security-guidance plugin and overlaps semgrep, so likely redundant). The other 290 are advisory/compliance/marketing/SRE/cloud/data — genuinely off-stack, not skipped.
- **VoltAgent/awesome-agent-skills:** **1,114 entries across 171 orgs** enumerated (prior "~600/~50" was a 2x undercount). ~75% is NVIDIA GPU (155) + microsoft Azure (133) + mobile/marketing/other-language/media-gen/crypto. On-stack web slice is small and almost all HAVE (vercel-labs, anthropics, figma, playwright, semgrep) or already-evaluated (ToB, Sentry, addyosmani, resend, OpenAI). **0 new ADDs. 1 new fit-4 WATCH: `testdino-hq/playwright-skill`** (MIT, axe + visual + Next.js + CI-sharding depth that could exceed installed `playwright`/`webapp-testing` — revisit before any E2E expansion). Fit-3 WATCH: dembrandt design-system, vibesec, clawsec (skill-integrity), color-expert (OKLCH).

**Grand total actually enumerated per-row across all sources: ~2,090 entries** (1114 + 325 + 164 + 230 + 166 + 33 + ~60). **Confirmed ADD: 1 (fallow).** The tail read adds **0 ADDs, 2 fit-4 WATCH**. The "harness is saturated" conclusion is now evidenced, not assumed.

## Coverage

| Source | Enumerated | ADD | WATCH | SKIP | HAVE |
|---|---|---|---|---|---|
| anthropics/claude-plugins-official (marketplace A-Z, 204 plugins) + anthropics/skills (18) + vercel-labs/agent-skills (8) | 230 | 1 | 8 | ~157 | ~64 |
| obra/superpowers ecosystem (core 14 + sibling repos + lab) | 33 | 0 | 10 | 8 | 15 |
| ComposioHQ/awesome-claude-skills (master, full) + 2 aggregators (category-level) | 166 | 0 | 8 | ~138 | ~18 |
| VoltAgent/awesome-claude-code-subagents (164, all 10 categories) + awesome-agent-skills (~600, cluster-level) | ~764 | 0 | 18 | ~700 | ~23 |
| hesreallyhim/awesome-claude-code (skills + hooks + workflows) + fresh GitHub packs | ~60 | 1 | 9 | ~46 | 3 |
| **Total** | **~650 distinct** | **2 new + 1 prior (fallow)** | **~40** | **bulk** | **~123** |

**Headline:** A mature, gate-heavy harness absorbs almost everything. Of ~650 entries, only **3 clear ADDs** (fallow already in plan; TDD Guard and resend net-new from this pass) and a ~12-item WATCH tier worth a deep audit. The entire Composio SaaS-automation block (~78 skills), all other-language/other-cloud specialists, and all business/marketing/forensics skills are Fit-1 SKIP and many are credential-exfil surfaces with zero use here.

---

## ACTIONABLE TIER — ADD (deep security audit required before any install; none auto-passes)

| Rank | Name | Source | Type | Fit | Why it wins (mechanism) | Audit focus |
|---|---|---|---|---|---|---|
| 1 | **fallow** | fallow-rs/fallow | Skill + ext CLI | 4 | Net-new: circular-dep + architecture-boundary + unused-export detection nothing else does. Deep-audited; plan written (`plans/2026-05-30-fallow-audit-tool.md`). | DONE (WATCH→ADAPT): pin binary, deny `fix`, advisory-only framing. |
| 2 | **resend (skills only)** | resend/resend-skills (official mp) | Skills | 4-5 | Direct dep match (contact form uses Resend); 4 prompt-only deliverability/React Email skills, zero-exec. | Install SKILLS ONLY. The bundled MCP server (`emails.send` + `apiKeys.create` over unpinned `npx -y`) completes the lethal trifecta — VETOED. Audited; available, not yet planned. |

### Post-audit downgrades (2026-05-30) — were ADD/WATCH, deep-audit moved them to SKIP

| Name | Was | Now | Deciding fact | Flip condition |
|---|---|---|---|---|
| **TDD Guard** (nizos/tdd-guard) | ADD (rank 1) | **SKIP** (sec floor WATCH) | Its "gate" is a non-deterministic LLM verdict that egresses source off-machine on EVERY edit (no offline mode). Violates STANDARDS Ch.4 "mechanical deterministic gate". CI already enforces TDD deterministically. Maps LLM01/LLM02/LLM05. | Ships a fully-offline AST-based deterministic mode (the bundled `@ast-grep/napi` hints at it) → re-eval to ADAPT, scoped to `components/`+`lib/`+`app/api/`. |
| **web-asset-generator** (alonw0) | WATCH | **SKIP** | `public/og.png` already covers the SEO need; hardcoded DejaVu font violates the JetBrains-Mono lock; emoji path silently fetches `emojicdn.elk.sh` into a committed asset (LLM03/LLM05). | Need an ongoing multi-size favicon/PWA set AND patch the emoji path to an offline `source=` + JetBrains-Mono font path → ADAPT the two non-emoji scripts. |
| **parry** (vaporif/parry-guard) | WATCH | **SKIP** (for stated goal) | Security CLEAN (verified local-only inference, no content egress). Fails on FIT: guards the dev session, not `/api/ask` runtime (the repo's real LLM01 surface); collides with existing PreToolUse Bash + PostToolUse Edit hooks; live CC-2.1+ bug (#95). | Objective redefined to "harden the dev harness vs poisoned MCP/web/dep content hijacking the agent into leaking AI_GATEWAY/Resend/Upstash secrets" → it is the only fit; ADAPT after #95 fix + hook-ordering resolution + pinned HF model commit. |

---

## ACTIONABLE TIER — WATCH (audit only if the named need is real; ranked by leverage)

| Name | Source | Type | Fit | Net-new value | Why not ADD yet |
|---|---|---|---|---|---|
| **web-asset-generator** / "Web Assets Generator" | alonw0 / awesome-claude-code | Skill | 4 | Favicon / app-icon / OG-image generation — a genuine gap, and OG quality feeds the Lighthouse SEO=100 gate | Must respect the locked two-token palette + sharp-corner aesthetic; output quality unverified. You currently ship a static `public/og.png` (DECISIONS.md), so the gap is narrow. |
| **parry** | vaporif / awesome-claude-code | Hook | 4 | Prompt-injection scanner on the exact `/api/ask` AI-Gateway input path `security-auditor` guards | Hook = exec surface; maintenance freshness + false-positive rate unverified. Overlaps existing CSP/kill-switch behavioral tests. |
| **finding-duplicate-functions** | obra/superpowers-lab | Skill | 4 | Semantic duplicate-function detection — serves the reference-system DRY bar | Lives in experimental `superpowers-lab`; false-positive rate on TS/React unverified. |
| **trailofbits static-analysis + differential-review** | trailofbits/skills | Skills | 4 | CodeQL depth + per-PR security diff beyond the semgrep MCP | PRIOR (flagged last pass); trusted provenance; overlaps semgrep + security-auditor — bar to add is high. |
| **redis-development** | official mp | Skill | 4 | Upstash Redis is in-stack (rate-limit + KV log) | Confirm it is generic Redis guidance usable over Upstash REST, not OSS-server-only or an external MCP. |
| **root-cause-tracing** | obra (ComposioHQ list) | Skill | 4 | Deep error→trigger tracing beyond `systematic-debugging` | Trusted obra provenance; overlaps installed `systematic-debugging`. |
| **agnix** | agent-sh/agnix | CLI | 3-4 | Lints your own `.claude/` skill+agent defs — an unguarded layer | Pre-1.0 rule churn; one-time lint-only pass, never `--fix` unattended. (From prior pass.) |
| **prompt-engineer** | VoltAgent subagents | Agent | 4 | Disciplined system-prompt + prompt-cache design for `/api/ask` | Overlaps installed `claude-api` skill — verify delta first. |
| **seo-specialist** | VoltAgent subagents | Agent | 4 | Structured-data/meta hardening for Lighthouse SEO=100 | Verify it adds beyond current LHCI SEO checks. |
| **ai-writing-auditor** | VoltAgent subagents | Agent | 4 | Gate `/api/ask` output + `content/*.ts` copy for AI-tells | Overlaps installed `humanizer`. |
| **episodic-memory** | superpowers marketplace | MCP plugin | 4 | Semantic recall over past sessions vs static MEMORY.md | MCP footprint + embedding cost; overlaps memory-hygiene rules. |
| **Compound Engineering** | EveryInc | Plugin | 3 | Error→learning knowledge-compounding loop | Heavy overlap with superpowers plan/review; 37 skills/51 agents is a large surface. |

---

## SKIP / HAVE summary (the bulk — not re-listed per-row; full tables in scan transcript)

- **HAVE (~123):** entire superpowers core (14), thinking-* family, vercel:* suite, angular-* family, all anthropics/skills (mirrored by document-skills/example-skills), the VoltAgent review-battery equivalents (code-reviewer, security-auditor, performance-engineer, accessibility-tester, architect-reviewer, dependency-manager, ui-ux-tester, typescript-pro, nextjs-developer, react-specialist, ai-engineer, refactoring-specialist, test-automator, dx-optimizer, legacy-modernizer, documentation-engineer), react-best-practices, composition-patterns, react-view-transitions, web-design-guidelines, chrome-devtools, playwright, github, semgrep, postman, figma, context7, codspeed, pdf/docx/xlsx/pptx, mcp-builder, skill-creator, etc.
- **SKIP (bulk):** all ~78 Composio SaaS app-automation skills (CRM/PM/comms/storage/analytics/marketing — credential-exfil, zero use); all other-language LSPs/specialists (C#/Java/Go/Rust/PHP/Python/Ruby/Swift/Kotlin/Vue/Django/Rails/Laravel/Spring); all other-cloud infra (AWS ×many/Azure/GCP/Cloudflare/Netlify/Railway); all DB plugins for non-Upstash stores (Postgres/Mongo/Mysql/vector DBs); mobile/embedded/blockchain/game/fintech/healthcare; business/PM/research/marketing agents; Sentry + Datadog + dash0 (observability rejected by DECISIONS.md); coderabbit + greptile + sourcegraph + serena (SaaS/overlap with installed review + search); shadcn/Tailwind-coupled skills (rejected by DECISIONS.md); GraphQL/Apollo (rejected); ralph-loop + Ralph workflows (unattended-loop conflicts with gated review).

---

## Net change vs the prior delta scan

The prior (filtered) scan surfaced only fallow + a SKIP-heavy shortlist. This exhaustive pass adds **two genuinely net-new ADD candidates it had filtered out**:
1. **TDD Guard** — missed because the prior scan deduped hooks aggressively against "you already have a TDD rule." But a rule is not a gate; this is the gate. Highest-leverage new find.
2. **web-asset-generator** — missed because asset-gen read as out-of-scope; it is actually a narrow real gap tied to the SEO gate.

Everything else the exhaustive pass found confirms the prior conclusion: the harness is saturated. ~650 entries, 3 ADDs.

**Load-bearing assumption most likely wrong:** that the truncated tails of the two mega-aggregators (alirezarezvani 338, VoltAgent agent-skills ~600) contain no Vercel/Upstash/AI-SDK/Brazil-specific Fit-4 skill. Those were triaged at cluster level, not per-row. A targeted second pass filtering only `vercel-*`/`upstash`/`resend`/`ai-sdk`/`playwright` names would close that gap if you want certainty.
