# Commitizen + Conventional Commits — Design Spec

**Date:** 2026-05-14
**Status:** Approved
**Reversibility:** Low cost to remove before first PR; increases after changelog history accumulates.

---

## Context

`DECISIONS.md` (2026-05-13) already locked "Conventional Commits + squash merges to main." This spec operationalises that decision with tooling: an interactive commit prompt, local lint enforcement, and CI gates.

The remote `https://github.com/erikunha/portfolio` contains an old stack (Next.js 16, ESLint, Prettier, Jest, semantic-release). The implementation begins with a **full history wipe** and fresh scaffold — the commitizen setup is wired in as part of Day 1 bootstrap, not bolted on later.

---

## Phase 0 — Repository bootstrap (prerequisite)

**Destructive:** replaces all remote history. GitHub issues/PRs/settings are preserved; only commits are wiped.

```bash
# 1. Init fresh local repo
cd /Users/erikhenriquealvescunha/Documents/Claude/Projects/erik-portifolio
git init
git checkout -b main

# 2. Add remote
git remote add origin https://github.com/erikunha/portfolio.git

# 3. Scaffold Next.js 15
pnpm create next-app@latest . \
  --typescript --eslint=false --tailwind --src-dir=false \
  --app --turbopack --import-alias="@/*" --use-pnpm

# 4. Install all deps (see LAUNCH.md Day 1 for full list)

# 5. Apply commitizen tooling (this spec)

# 6. First commit + force push
git add .
git commit  # commitizen prompt fires
git push --force origin main
```

---

## Toolchain

| Package | Role |
|---|---|
| `husky` | Git hook runner (v9+, auto-skips in CI) |
| `@commitlint/cli` | Commit message linter |
| `@commitlint/config-conventional` | Base Conventional Commits ruleset |
| `@commitlint/cz-commitlint` | Commitizen adapter — reads commitlint config directly, no duplication |
| `commitizen` | Interactive commit prompt |

All installed as `devDependencies @latest` via pnpm.

---

## Enforcement layers

### Layer 1 — Local hooks (husky)

Three hooks wired in `.husky/`:

**`prepare-commit-msg`**
Launches the commitizen interactive prompt on `git commit`. Skipped automatically when a message is passed via `-m` or when amending.

```sh
exec < /dev/tty && node_modules/.bin/cz --hook || true
```

**`commit-msg`**
Lints the resulting message with commitlint. Rejects anything not matching the Conventional Commits spec + configured rules.

```sh
npx --no -- commitlint --edit $1
```

**`pre-push`**
Validates the current branch name against the allowed pattern before any push.

```sh
branch=$(git rev-parse --abbrev-ref HEAD)
echo "$branch" | grep -qE '^(feat|fix|chore|docs|refactor|perf|test|build|ci|style|revert)/.+$|^main$' \
  || (echo "Error: invalid branch name '$branch'. Use <type>/<description> or main." && exit 1)
```

### Layer 2 — CI gate (GitHub Actions)

Two steps added to the CI workflow before the build:

**Commit message lint** — lints every commit in the PR range:
```yaml
- name: Lint commit messages
  run: npx commitlint --from ${{ github.event.pull_request.base.sha }} --to ${{ github.event.pull_request.head.sha }} --verbose
```

**Branch name lint** — validates the source branch:
```yaml
- name: Lint branch name
  run: |
    BRANCH="${{ github.head_ref || github.ref_name }}"
    echo "$BRANCH" | grep -qE '^(feat|fix|chore|docs|refactor|perf|test|build|ci|style|revert)/.+$|^main$' \
      || (echo "Invalid branch name: $BRANCH" && exit 1)
```

---

## `commitlint.config.ts`

```ts
export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'scope-enum': [2, 'always', ['ui', 'content', 'api', 'infra', 'deps', 'a11y', 'perf']],
    'scope-empty': [1, 'never'],
    'subject-case': [2, 'never', ['sentence-case', 'start-case', 'pascal-case', 'upper-case']],
  },
}
```

**Scope rationale (by layer):**

| Scope | Covers |
|---|---|
| `ui` | React components, styles, layout, animations |
| `content` | `content/*.ts` typed data files |
| `api` | `/api/ask`, `/api/contact`, `/api/erik.json` routes |
| `infra` | CI workflow, Vercel config, env, tooling config |
| `deps` | Dependency installs and upgrades |
| `a11y` | Accessibility fixes (axe findings, WCAG compliance) |
| `perf` | Performance optimisations (INP, LCP, bundle size) |

`scope-empty` is a **warning** (severity 1), not an error, because some commit types (`revert`, `ci`) are commonly scopeless.

---

## `package.json` additions

```json
"scripts": {
  "commit": "cz"
},
"config": {
  "commitizen": {
    "path": "@commitlint/cz-commitlint"
  }
},
"prepare": "husky && pnpm playwright install --with-deps chromium || true"
```

`pnpm commit` is the canonical entry point. Raw `git commit` still works and goes through the same hooks. `husky` in `prepare` auto-skips when `CI=true` (husky v9 default).

---

## Branch naming convention

Pattern: `^(feat|fix|chore|docs|refactor|perf|test|build|ci|style|revert)/.+$|^main$`

Valid examples:
- `feat/matrix-loop`
- `fix/inp-regression`
- `chore/deps-may-2026`
- `main`

Invalid (rejected at `pre-push` and CI):
- `erik/some-thing`
- `wip`
- `FEAT/matrix`

---

## Files created/modified

| Path | Action |
|---|---|
| `commitlint.config.ts` | Create |
| `.husky/prepare-commit-msg` | Create |
| `.husky/commit-msg` | Create |
| `.husky/pre-push` | Create |
| `scaffold/package.json.recommended` | Update — add scripts, config, devDeps, prepare |
| `.github/workflows/ci.yml` | Create (or update when CI workflow is written in LAUNCH Day 1) |

---

## Out of scope

- Changelog generation (`standard-version`, `release-please`) — can be added post-launch if needed.
- Semantic versioning automation — single-author site, no npm publish, no version bump needed.
- PR title linting — squash merge means the PR title becomes the commit; enforced by the same commitlint CI step.
