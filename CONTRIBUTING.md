# Contributing

Thanks for your interest. This repository is a personal portfolio and a **reference system**: every architectural decision, performance budget, accessibility guarantee, CI gate, and lint rule is meant to hold up as something another team could adopt. Contributions are welcome, and the same bar applies to all of them.

By participating you agree to the [Code of Conduct](./CODE_OF_CONDUCT.md).

## Prerequisites

- **Node** >= 22 (`.nvmrc` pins the exact version; `nvm use`)
- **pnpm** >= 10 (this repo is pnpm-only; do not use npm or yarn)
- **gitleaks** on your PATH for the pre-commit secret scan (`brew install gitleaks`)

```bash
pnpm install
pnpm dev          # http://localhost:3000
```

## Project shape

- **Next.js 16 App Router · React 19 · TypeScript (strict) · Tailwind v4 · Biome**
- Default rendering is **React Server Components / SSG** — client code is the exception and every client file is named `*.client.tsx`.
- Content lives in `content/*.ts` as typed modules validated by Zod at build time. **Never inline user-facing copy in `.tsx`** — put it in `content/`.
- Design tokens are CSS custom properties in `app/css/theme.css`. No raw hex outside that file.

See `ARCHITECTURE.md` for the system design, `STANDARDS.md` for the engineering bar (each chapter names its enforcement gate), and `DECISIONS.md` for the running ADR log.

## Branch and commit conventions

- **Branch names:** `<type>/<description>` — e.g. `feat/contact-form`, `fix/hero-lcp`, `docs/readme`. Valid types: `feat`, `fix`, `chore`, `docs`, `refactor`, `perf`, `test`, `build`, `ci`, `style`, `revert`, `dependabot`, `design-system`. Enforced by the pre-push hook.
- **Commits:** Conventional Commits with a required scope — `type(scope): description`. The scope is the feature area (`hero`, `contact`, `ci`, `design-system`, …), not a technical category. Enforced by commitlint (the subject line is capped at 100 chars).
- **Stage narrowly:** `git add <files>` or `git add -u`. Do not `git add .` / `-A`.

## Local gates (run before you push)

Git hooks run automatically, but you can (and should) run the checks yourself:

| Command | What it checks |
|---|---|
| `pnpm check` | Biome lint + format |
| `pnpm typecheck` | TypeScript strict |
| `pnpm validate-content` | Zod content schemas |
| `pnpm test` | Vitest unit tests |
| `pnpm test:e2e` | Playwright: a11y scan, contact/ask journeys, visual regression |
| `pnpm ci:local` | The full local CI chain (lint + type + content + tests + gates) |
| `pnpm bundle-check` | Bundle-size gate |
| `pnpm lhci` | Lighthouse CI |

**Pre-commit** runs Biome, a staged `gitleaks` secret scan, and commitlint. **Pre-push** runs the full verify chain and enforces the branch-name format.

Performance, accessibility (WCAG 2.1 AA), and security are treated as implicit on every change, not separate phases. The performance budgets and the Lighthouse thresholds in `CLAUDE.md` are CI-enforced. **Do not disable a gate to merge** — if a gate fails, fix the underlying issue, or open an issue explaining why the gate is wrong.

## Opening a pull request

1. Keep PRs small. Review quality drops sharply past a few hundred changed lines; the repo has a `pnpm pr-size` helper that flags when a branch should be split.
2. Run `pnpm ci:local` (and `pnpm gates:runtime` for anything that affects the built site).
3. Fill in **every** section of the PR template — do not write a body from scratch. `pnpm validate-pr-body <pr>` verifies the sections are filled.
4. **Show your work.** A PR should evidence what it claims, not just assert it: paste command output, attach before/after screenshots or a recording for UI changes, note bundle-size and Core Web Vitals deltas for performance work, and link the CI run or Vercel preview. Reviewers should be able to validate without pulling the branch.
5. A visual change requires regenerated visual-regression baselines before the PR is opened.
6. CI must be green and the automated review must approve before merge. Address all blocking review findings.

## Reporting bugs and requesting features

Open a GitHub issue with a clear title, what you expected, what happened, and steps to reproduce (a link or screenshot helps). For anything security-related, follow [SECURITY.md](./SECURITY.md) instead of opening a public issue.

## License and ownership

This is a personal project. Opening a PR does not transfer ownership; substantial changes may be adapted or declined at the maintainer's discretion. If in doubt about whether a change is in scope, open an issue first.
