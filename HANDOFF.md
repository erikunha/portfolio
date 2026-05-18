# Handoff to Claude Code

> One-time setup to move this project from Cowork mode into Claude Code for the production build.

## Step 1 — open the project in Claude Code

The files are already on your Mac at `<repo-root>/` — Cowork mode wrote them there. You don't need to clone anything yet; everything is local.

### First time (on this Mac, fresh)

```bash
# 1. Make sure Claude Code is installed
claude --version || npm install -g @anthropic-ai/claude-code

# 2. Go to the project directory
cd "<repo-root>"

# 3. Confirm the docs are in place
ls -la
# expect: CLAUDE.md  ARCHITECTURE.md  DECISIONS.md  LAUNCH.md  HANDOFF.md  scaffold/

# 4. Initialize git so changes are tracked from session one
git init
git add .
git commit -m "docs: architecture, decisions, launch playbook, scaffold configs"

# 5. (Optional now, recommended) push to GitHub so the repo exists remotely
# requires gh cli: brew install gh && gh auth login
gh repo create erikunha/portfolio --public --source=. --remote=origin --push

# 6. Open Claude Code in this directory — CLAUDE.md auto-loads
claude
```

### Later (cloning to a different machine, or recovering)

If the project is already on GitHub and you're starting on a new machine:

```bash
gh repo clone erikunha/portfolio
cd portfolio
claude
```

That's it — same `CLAUDE.md` will load, same context.

### What "claude" actually does

`claude` runs in your terminal. It reads `CLAUDE.md` from the current directory automatically. Everything else (the kickoff prompt, the plugin installs) you do inside that REPL.

## Step 2 — install the recommended plugins

In Claude Code, these are the skills worth having loaded for this project. Install them via the plugin marketplace (use `/plugin marketplace add` and `/plugin install` as Claude Code expects).

### Highest leverage — install all of these

| Skill | Why for this project |
|---|---|
| **anthropic-skills:vercel-react-best-practices** | Next.js 15 + React 19 perf patterns, RSC vs client boundaries, bundle hygiene. Maps directly to the JS budget. |
| **anthropic-skills:vercel-composition-patterns** | Composition over boolean props. Useful as section components grow variants. |
| **anthropic-skills:typescript-magician** | Strict TS, generics, type guards, Zod inference — you'll hit `noUncheckedIndexedAccess` edge cases. |
| **anthropic-skills:node** | Node 22+ patterns for the Edge function (`/api/ask`) and Server Action (contact form). |
| **engineering:code-review** | Self-review before every merge. Catches N+1s, missing edge cases, perf regressions. |
| **engineering:debug** | When the Matrix loop INP regresses or the build fails on bundle size — structured reproduce/isolate/diagnose. |
| **engineering:testing-strategy** | Vitest unit + Playwright E2E setup. Important because the test surface here is small but high-leverage (contact + ask paths). |
| **engineering:deploy-checklist** | Before pushing to production for the first time. Catches the things you'd otherwise discover at 2am. |
| **design:accessibility-review** | WCAG 2.1 AA at the green-on-black palette is the hardest constraint. Run this skill on every section. |
| **design:design-critique** | Continuous feedback as sections come together. |

### Lower priority — install when you reach them

| Skill | When to install |
|---|---|
| **anthropic-skills:deploy-to-vercel** | Day 14, when wiring production deployment |
| **anthropic-skills:humanizer** | If you generate any prose copy via Claude (HOTTEST_TAKES drafts, bio paragraphs) — strips AI-tells |
| **anthropic-skills:mcp-builder** | Only if you decide to expose `/api/ask` as an MCP server later for AI-agent recruiters |
| **anthropic-skills:web-artifacts-builder** | If you want to prototype individual sections in artifacts before porting |
| **anthropic-skills:shadcn-ui** | Skip — this portfolio doesn't use shadcn. |

### Skip these for this project

Angular plugins, Sanity plugins, Figma plugins, business/HR/finance/legal/marketing plugins, Fastly plugins. None apply.

## Step 3 — the kickoff prompt

Paste this as your first message in Claude Code. It's self-contained: first verifies the files are present, then orients on Day 1 without writing code.

```text
First, run these to verify the project is in the right state:

  pwd
  ls -la CLAUDE.md ARCHITECTURE.md DECISIONS.md LAUNCH.md scaffold/

If any of those files is missing, stop and tell me what's missing.
Otherwise: I'm picking up an existing project. Full context lives in
CLAUDE.md, ARCHITECTURE.md, DECISIONS.md, LAUNCH.md, and scaffold/ —
all already in the repo.

Read these in order, no code generation yet:
  1. CLAUDE.md — the operating constraints
  2. LAUNCH.md — the day-by-day playbook (we're at Day 1)
  3. ARCHITECTURE.md — the system design (sections relevant to
     today's work only; skim the rest)
  4. scaffold/README.md — what configs are pre-built

After reading, before any commands run, tell me three things:

  1. The single biggest risk in Day 1 you see from the docs.
  2. Anything in the existing scaffold that you'd want to revise based
     on what you know about Next 15 + React 19 today
     (the configs were drafted in May 2026 — anything obsolete?
     Note: Tailwind v4 was removed 2026-05-18, see DECISIONS.md;
     site now uses hand-written global CSS under app/css/).
  3. The first 3 concrete commands I should run AFTER I've created
     the external accounts (Anthropic, Upstash, Resend, Vercel, PSI).

Don't generate code. Don't propose new features. Don't start running
commands. Read, then orient. After your reply we run Day 1 together.
```

The `pwd` + `ls -la` opener is the move — it forces Claude Code to verify it's in the right working directory before doing anything else. If you accidentally invoke `claude` from your home directory, the first thing it tells you is "I don't see the files" instead of hallucinating a setup.

## Step 4 — when Day 1 is done

Commit the foundation. Open a PR. Confirm CI gates fire green on an empty page. Then return to Claude Code and say:

```
Day 1 complete. Ready for PR 2 — content layer. Read LAUNCH.md §"Day 4-5"
and scaffold/content/schemas.ts. Then propose the order in which we should
write the 13 content files, weighted by which sections we'll port first
in PR 3.
```

PRs 3-8 follow the same pattern: name the PR, point at the relevant LAUNCH.md section + scaffold files, ask for the plan before code.

## Step 5 — when you hit a hard problem

The three problems most likely to bite:

1. **Matrix dialog loop tanks INP.** Symptom: Lighthouse Performance drops below 95 in PR 4. Root cause: someone used `useState` instead of `useRef.textContent`. Fix in `components/client/matrix-dialog.client.tsx`.
2. **Bundle size gate fails.** Symptom: CI red on the bundle check. Run `pnpm dlx @next/bundle-analyzer` to see what's bloating. Common cause: accidentally importing a server-only module into a client component.
3. **`/api/ask` blows the cost cap.** Symptom: 503 budget_exhausted before month-end. Check `ask:tokens:YYYY-MM` in Upstash Redis. Either traffic spiked or someone is abusing — see ARCHITECTURE.md §6 mitigation list.

Invoke `engineering:debug` for any of these.

## Step 6 — before going live

Run the full pre-launch checklist from `LAUNCH.md` Day 14. Specifically:
- [ ] HOTTEST_TAKES rewritten in your voice
- [ ] CICCC concurrency note in git log
- [ ] CA visa status verified
- [ ] Phone number NOT on page
- [ ] BUILT_WITH line accurate to the deployed stack
- [ ] All four Lighthouse gates green on production URL
- [ ] securityheaders.com A+
- [ ] Mobile pass at 375 / 414 / 768
- [ ] Reduced-motion toggle test
- [ ] `ask` endpoint returns real LLM response with your CV context
- [ ] Contact form delivers email + persists to KV

When all those check, tag v1.0.0 and ship.

---

## Why this is one repo with four docs

- `CLAUDE.md` is for the AI (auto-loaded, every session, terse)
- `ARCHITECTURE.md` is for future-you in 6 months (deep design rationale)
- `DECISIONS.md` is the ADR log (what was chosen and why, reversibility)
- `LAUNCH.md` is the executable playbook (what to do right now)

Four documents, four audiences, zero overlap. If something belongs in more than one place, it's a bug — fix the doc.
