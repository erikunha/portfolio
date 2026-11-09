# Contributing

Thanks for your interest. This repository is a personal portfolio and a **reference system**: every architectural decision, performance budget, accessibility guarantee, CI gate, and lint rule is meant to hold up as something another team could adopt. Contributions are welcome, and the same bar applies to all of them.

By participating you agree to the [Code of Conduct](./CODE_OF_CONDUCT.md).

## Prerequisites

- **Node** 22.22.2 or newer (`.nvmrc` pins the exact version; `nvm use`)
- **pnpm** >= 10 (this repo is pnpm-only; do not use npm or yarn)
- **gitleaks** on your PATH for the pre-commit secret scan (`brew install gitleaks`)

```bash
pnpm install
cp .env.example .env.local   # optional: static content renders without keys
pnpm dev                     # http://localhost:3000
```

Without service credentials `/api/ask` rejects budget reservation, `/api/contact` cannot save messages and `/api/lighthouse` returns unavailable scores. `.env.example` lists every variable; `lib/env.ts` is the only reader.

## Project shape

- **Next.js 16 App Router · React 19 · TypeScript (strict) · Tailwind v4 · Biome**
- Default rendering is **React Server Components / SSG**. Client code is the exception: a `'use client'` file is named `*.client.ts(x)` or lives under a `client/` directory (`pnpm check:client-naming`).
- Content lives in `content/*.ts` as typed modules validated by Zod at build time, in English and pt-BR (the `/pt` routes). **Never inline user-facing copy in `.tsx`**: put it in `content/`.
- Design tokens are CSS custom properties in `app/css/theme.css`. No raw hex outside that file.

See `ARCHITECTURE.md` for the system design, `STANDARDS.md` for the engineering bar (each chapter names its enforcement gate), and `DECISIONS.md` for the running ADR log.

## Branch and commit conventions

- **Branch names:** `<type>/<description>`, e.g. `feat/contact-form`, `fix/hero-lcp`, `docs/readme`. Valid types: `feat`, `fix`, `chore`, `docs`, `refactor`, `perf`, `test`, `build`, `ci`, `style`, `revert`, `dependabot`, `design-system`. Enforced by the pre-push hook.
- **Commits:** Conventional Commits with a required scope: `type(scope): description`. The scope is the feature area (`hero`, `contact`, `ci`, `design-system`, …), not a technical category. The description starts lowercase. Enforced by commitlint (the subject line is capped at 100 chars).
- **Stage narrowly:** `git add <files>` or `git add -u`. Do not `git add .` / `-A`.

## Local gates (run before you push)

Git hooks run automatically, but you can (and should) run the checks yourself:

| Command                 | What it checks                                                  |
| ----------------------- | --------------------------------------------------------------- |
| `pnpm check`            | Biome lint + format                                             |
| `pnpm typecheck`        | TypeScript strict                                               |
| `pnpm validate-content` | Zod content schemas                                             |
| `pnpm test`             | Vitest unit tests                                               |
| `pnpm test:e2e`         | Playwright: a11y scan, contact/ask journeys, visual regression  |
| `pnpm ci:local`         | The verify chain CI runs first (lint, types, content, naming, pinning, doc drift, contrast, tokens, tests with coverage) |
| `pnpm ci:predict`       | Every CI job your commits trigger, run locally, with the jobs it could not verify listed (`--linux` for layout or font changes) |
| `pnpm bundle-check`     | Bundle-size gate (needs a build)                                |
| `pnpm route-js-check`   | Per-route first-load JS gate (needs a build)                    |
| `pnpm lhci`             | Lighthouse CI (`pnpm lhci:mobile` for the mobile profile)       |
| `pnpm gates:runtime`    | Build, server, Lighthouse, axe and Chromium e2e in one run      |

**Pre-commit** runs Biome and a staged `gitleaks` secret scan; **commit-msg** runs commitlint. **Pre-push** runs the full verify chain and enforces the branch-name format.

Performance, accessibility (WCAG 2.2 AA), and security are treated as implicit on every change, not separate phases. The performance budgets and the Lighthouse thresholds in `lighthouserc.json` and `lighthouserc.mobile.json` are CI-enforced. **Do not disable a gate to merge.** If a gate fails, fix the underlying issue, or open an issue explaining why the gate is wrong.

## Opening a pull request

1. Keep PRs small. Review quality drops sharply past a few hundred changed lines.
2. Run `pnpm ci:predict` (and `pnpm gates:runtime` for anything that affects the built site). For a docs-only change `pnpm ci:local` is enough.
3. Fill in **every** section of the PR template; do not write a body from scratch.
4. **Show your work.** A PR should evidence what it claims, not just assert it: paste command output, attach before/after screenshots or a recording for UI changes, note bundle-size and Core Web Vitals deltas for performance work, and link the CI run or Vercel preview. Reviewers should be able to validate without pulling the branch.
5. A visual change requires regenerated visual-regression baselines before the PR is opened (darwin locally, linux from the CI dispatch).
6. CI must be green, the Argos visual check approved and every review thread resolved with a reply (`pnpm pr:gate`) before merge. Address all blocking review findings (`REVIEW.md` lists what blocks). The `claude-review` job runs only when an owner, member or collaborator comments `/claude-review`; it never blocks a merge.

## Reporting bugs and requesting features

Open a GitHub issue with a clear title, what you expected, what happened, and steps to reproduce (a link or screenshot helps). For anything security-related, follow [SECURITY.md](./SECURITY.md) instead of opening a public issue.

## License and ownership

This is a personal project. Opening a PR does not transfer ownership; substantial changes may be adapted or declined at the maintainer's discretion. If in doubt about whether a change is in scope, open an issue first.
