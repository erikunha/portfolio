# Repo Bootstrap + Commitizen Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wipe `https://github.com/erikunha/portfolio` and replace it with a clean Next.js 15 scaffold wired with Commitizen + Conventional Commits enforcement from the first commit.

**Architecture:** Two phases — Phase 0 bootstraps the repo (git init → Next.js scaffold → deps → scaffold configs), Phase 1 installs and wires the full commitizen stack (husky hooks, commitlint, CI gate). The repo has no existing history worth preserving; a force push to main replaces the remote.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript strict, Tailwind v4, Biome, pnpm, Vitest, Playwright, husky v9, @commitlint/cli, @commitlint/cz-commitlint, commitizen

---

## Phase 0 — Repository Bootstrap

---

### Task 1: Initialize git repo and set GitHub remote

**Files:**
- Create: `.gitignore`

- [ ] **Step 1: Init the repo and set default branch to main**

```bash
cd <repo-root>
git init
git checkout -b main
```

Expected: `Initialized empty Git repository in .../erik-portifolio/.git/`

- [ ] **Step 2: Add the GitHub remote**

```bash
git remote add origin https://github.com/erikunha/portfolio.git
git remote -v
```

Expected output includes: `origin  https://github.com/erikunha/portfolio.git (fetch)`

- [ ] **Step 3: Create .gitignore**

Create `.gitignore`:

```gitignore
# Next.js
.next/
out/
dist/

# Dependencies
node_modules/

# Build artifacts
*.tsbuildinfo
next-env.d.ts

# Environment
.env
.env.local
.env.production.local
.env.*.local

# Vercel
.vercel

# Lighthouse CI
.lighthouseci/

# OS
.DS_Store
Thumbs.db

# Misc
*.log
coverage/
```

---

### Task 2: Scaffold Next.js 15

**Files:**
- Create: `package.json`, `app/layout.tsx`, `app/page.tsx`, `app/globals.css`, `next.config.ts`, `tsconfig.json`, `postcss.config.mjs`, `public/`, `.gitignore` (merged)

- [ ] **Step 1: Run create-next-app**

```bash
pnpm create next-app@latest . \
  --typescript --eslint=false --tailwind --src-dir=false \
  --app --turbopack --import-alias="@/*" --use-pnpm
```

When prompted about the existing directory, confirm to proceed. Answer `No` to any "initialize a git repository" prompt (already done).

- [ ] **Step 2: Remove ESLint defaults that create-next-app injects**

```bash
pnpm remove eslint eslint-config-next 2>/dev/null || true
```

- [ ] **Step 3: Remove Tailwind v3 and its config file (Tailwind v4 uses CSS-only config)**

```bash
pnpm remove tailwindcss autoprefixer 2>/dev/null || true
rm -f tailwind.config.ts tailwind.config.js
```

- [ ] **Step 4: Verify Next.js and React versions**

```bash
node -e "const p = require('./package.json'); console.log('next:', p.dependencies.next, 'react:', p.dependencies.react)"
```

Expected: `next: 15.x.x react: 19.x.x`

---

### Task 3: Apply scaffold overrides

**Files:**
- Create: `.npmrc`
- Overwrite: `biome.json`, `tsconfig.json`, `postcss.config.mjs`, `app/globals.css`, `lighthouserc.json`
- Copy: `scripts/check-bundle-size.mjs`, `content/schemas.ts`, `content/social.ts`

- [ ] **Step 1: Create .npmrc**

```ini
auto-install-peers=true
shamefully-hoist=false
strict-peer-dependencies=false
node-linker=isolated
```

Save as `.npmrc` in the project root.

- [ ] **Step 2: Copy scaffold configs into project root**

```bash
cp scaffold/biome.json biome.json
cp scaffold/tsconfig.json tsconfig.json
cp scaffold/postcss.config.mjs postcss.config.mjs
cp scaffold/lighthouserc.json lighthouserc.json
```

- [ ] **Step 3: Replace app/globals.css with scaffold version**

```bash
cp scaffold/app/globals.css app/globals.css
```

- [ ] **Step 4: Copy scripts and content scaffold files**

```bash
mkdir -p scripts content
cp scaffold/scripts/check-bundle-size.mjs scripts/check-bundle-size.mjs
cp scaffold/content/schemas.ts content/schemas.ts
cp scaffold/content/social.ts content/social.ts
```

- [ ] **Step 5: Move prototype images into prototype/ directory**

```bash
mkdir -p prototype
mv matrix_portfolio_expanded_system_dashboard.png prototype/ 2>/dev/null || true
mv matrix_portfolio_mobile_system_dashboard_v2_1.png prototype/ 2>/dev/null || true
mv matrix_portfolio_mobile_system_dashboard_v2_2.png prototype/ 2>/dev/null || true
mv matrix_portfolio_terminal_contact_added.png prototype/ 2>/dev/null || true
mv matrix_v2_brutalist_terminal_edition.png prototype/ 2>/dev/null || true
```

---

### Task 4: Install runtime dependencies

**Files:**
- Modify: `package.json`, `pnpm-lock.yaml`

- [ ] **Step 1: Add runtime dependencies**

```bash
pnpm add -E zod@latest
pnpm add @upstash/redis@latest @upstash/ratelimit@latest
pnpm add @anthropic-ai/sdk@latest resend@latest
pnpm add @vercel/analytics@latest @vercel/speed-insights@latest
```

- [ ] **Step 2: Verify package.json has correct dependency entries**

```bash
node -e "const p = require('./package.json'); console.log(JSON.stringify(p.dependencies, null, 2))"
```

Expected: Shows `zod`, `@upstash/redis`, `@anthropic-ai/sdk`, `resend`, `@vercel/analytics`, `@vercel/speed-insights`, `next`, `react`, `react-dom`.

---

### Task 5: Install dev dependencies (excluding commitizen stack)

**Files:**
- Modify: `package.json`, `pnpm-lock.yaml`

- [ ] **Step 1: Install Tailwind v4 and TypeScript tooling**

```bash
pnpm add -D tailwindcss@latest @tailwindcss/postcss@latest
pnpm add -D typescript@latest @types/node@latest @types/react@latest @types/react-dom@latest
```

- [ ] **Step 2: Install Biome, testing, and CI tools**

```bash
pnpm add -D @biomejs/biome@latest
pnpm add -D vitest@latest @vitest/ui@latest
pnpm add -D playwright@latest @axe-core/playwright@latest
pnpm add -D @lhci/cli@latest
pnpm add -D @next/bundle-analyzer@latest
```

- [ ] **Step 3: Bump all transitive deps to latest**

```bash
pnpm up --latest
```

- [ ] **Step 4: Verify Biome check passes on the scaffold**

```bash
pnpm biome check .
```

Expected: Any formatting complaints from Next's generated files. Fix with:

```bash
pnpm biome check --write .
```

- [ ] **Step 5: Verify TypeScript compiles**

```bash
pnpm tsc --noEmit
```

Expected: Exits 0. If there are errors in generated app files (layout.tsx, page.tsx), they are from Next's scaffold and need minor fixes (e.g., replacing `Image` imports with plain `img` or fixing prop types).

---

## Phase 1 — Commitizen + Conventional Commits

---

### Task 6: Install commitizen stack and update package.json

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install all commitizen devDependencies**

```bash
pnpm add -D \
  husky@latest \
  @commitlint/cli@latest \
  @commitlint/config-conventional@latest \
  @commitlint/cz-commitlint@latest \
  commitizen@latest
```

- [ ] **Step 2: Update package.json scripts and config**

Open `package.json` and make these changes:

**In `scripts`**, update the `prepare` entry and add `commit`:

```json
"prepare": "husky && pnpm playwright install --with-deps chromium || true",
"commit": "cz",
```

**In `scripts`**, also ensure these are present (add if create-next-app didn't generate them):

```json
"dev": "next dev --turbopack",
"build": "next build",
"start": "next start",
"check": "biome check .",
"check:fix": "biome check --write .",
"typecheck": "tsc --noEmit",
"test": "vitest run --passWithNoTests",
"test:watch": "vitest",
"test:e2e": "playwright test",
"lhci": "lhci autorun",
"validate-content": "node scripts/validate-content.mjs",
"bundle-check": "node scripts/check-bundle-size.mjs",
"ci": "pnpm check && pnpm typecheck && pnpm validate-content && pnpm test && pnpm build && pnpm bundle-check"
```

**Add a top-level `config` field** (after `scripts`):

```json
"config": {
  "commitizen": {
    "path": "@commitlint/cz-commitlint"
  }
}
```

**Add engine constraints** if not present:

```json
"engines": {
  "node": ">=22.0.0",
  "pnpm": ">=10.0.0"
},
"packageManager": "pnpm@latest"
```

- [ ] **Step 3: Verify JSON is valid**

```bash
node -e "require('./package.json')" && echo "package.json is valid JSON"
```

Expected: `package.json is valid JSON`

---

### Task 7: Create commitlint.config.ts

**Files:**
- Create: `commitlint.config.ts`

- [ ] **Step 1: Create the config file**

```ts
export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'scope-enum': [2, 'always', ['ui', 'content', 'api', 'infra', 'deps', 'a11y', 'perf']],
    'scope-empty': [1, 'never'],
    'subject-case': [2, 'never', ['sentence-case', 'start-case', 'pascal-case', 'upper-case']],
  },
};
```

- [ ] **Step 2: Verify valid commit message passes**

```bash
echo "feat(ui): add matrix animation loop" | npx commitlint
```

Expected: No output, exits 0.

- [ ] **Step 3: Verify invalid commit message is rejected**

```bash
echo "added some stuff" | npx commitlint
```

Expected: Exits non-zero, shows errors like `subject-empty` or `type-empty`.

- [ ] **Step 4: Verify invalid scope is rejected**

```bash
echo "feat(components): add button" | npx commitlint
```

Expected: Exits non-zero, error: `scope-enum` — `components` not in allowed values.

- [ ] **Step 5: Verify valid scope passes**

```bash
echo "feat(ui): add button component" | npx commitlint
```

Expected: Exits 0, no errors.

---

### Task 8: Initialize Husky and wire the three hooks

**Files:**
- Create: `.husky/prepare-commit-msg`
- Create: `.husky/commit-msg`
- Create: `.husky/pre-push`

- [ ] **Step 1: Initialize Husky**

```bash
npx husky init
```

Expected: Creates `.husky/` directory with a sample `pre-commit` file. Delete the sample:

```bash
rm -f .husky/pre-commit
```

- [ ] **Step 2: Create the prepare-commit-msg hook (launches commitizen)**

Create `.husky/prepare-commit-msg`:

```sh
exec < /dev/tty && node_modules/.bin/cz --hook || true
```

Make it executable:

```bash
chmod +x .husky/prepare-commit-msg
```

- [ ] **Step 3: Create the commit-msg hook (runs commitlint)**

Create `.husky/commit-msg`:

```sh
npx --no -- commitlint --edit $1
```

Make it executable:

```bash
chmod +x .husky/commit-msg
```

- [ ] **Step 4: Create the pre-push hook (validates branch name)**

Create `.husky/pre-push`:

```sh
branch=$(git rev-parse --abbrev-ref HEAD)
echo "$branch" | grep -qE '^(feat|fix|chore|docs|refactor|perf|test|build|ci|style|revert)/.+$|^main$' \
  || (echo "Error: invalid branch name '$branch'. Use <type>/<description> or main." && exit 1)
```

Make it executable:

```bash
chmod +x .husky/pre-push
```

- [ ] **Step 5: Run husky install (wires hooks to git)**

```bash
pnpm prepare
```

Expected: `husky` runs and exits 0; Playwright install runs (or skips gracefully with `|| true`).

- [ ] **Step 6: Verify commit-msg hook fires on a bad message**

```bash
echo "bad message" | .husky/commit-msg /dev/stdin
```

Expected: Exits non-zero, shows commitlint errors.

- [ ] **Step 7: Verify pre-push hook rejects bad branch names**

```bash
# Temporarily rename the branch to test
git checkout -b bad-branch-name 2>/dev/null || true
bash .husky/pre-push
git checkout main
git branch -D bad-branch-name 2>/dev/null || true
```

Expected: `Error: invalid branch name 'bad-branch-name'...` and exit non-zero.

- [ ] **Step 8: Verify pre-push hook accepts main**

```bash
bash .husky/pre-push
```

Expected: Exits 0 silently (current branch is `main`).

---

### Task 9: Wire CI workflow with commitlint + branch lint steps

**Files:**
- Create: `.github/workflows/ci.yml`

- [ ] **Step 1: Create the CI workflow directory**

```bash
mkdir -p .github/workflows
```

- [ ] **Step 2: Create .github/workflows/ci.yml**

```yaml
name: CI

on:
  pull_request:
  push:
    branches: [main]

concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

jobs:
  build-and-gate:
    runs-on: ubuntu-latest
    timeout-minutes: 12
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - uses: pnpm/action-setup@v4
        with:
          version: 9

      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm

      - name: Install
        run: pnpm install --frozen-lockfile

      - name: Lint branch name
        run: |
          BRANCH="${{ github.head_ref || github.ref_name }}"
          echo "$BRANCH" | grep -qE '^(feat|fix|chore|docs|refactor|perf|test|build|ci|style|revert)/.+$|^main$' \
            || (echo "Invalid branch name: $BRANCH" && exit 1)

      - name: Lint commit messages
        if: github.event_name == 'pull_request'
        run: npx commitlint --from ${{ github.event.pull_request.base.sha }} --to ${{ github.event.pull_request.head.sha }} --verbose

      - name: Biome check
        run: pnpm biome ci .

      - name: Type check
        run: pnpm tsc --noEmit

      - name: Validate content
        run: node scripts/validate-content.mjs

      - name: Unit tests
        run: pnpm vitest run

      - name: Build
        run: pnpm build
        env:
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY_BUILD }}
          UPSTASH_REDIS_REST_URL: ${{ secrets.UPSTASH_REDIS_REST_URL_BUILD }}
          UPSTASH_REDIS_REST_TOKEN: ${{ secrets.UPSTASH_REDIS_REST_TOKEN_BUILD }}
          RESEND_API_KEY: ${{ secrets.RESEND_API_KEY_BUILD }}
          IP_HASH_SALT: ci-build-salt

      - name: Bundle size gate
        run: node scripts/check-bundle-size.mjs --max-route-kb=120 --max-client-kb=43

      - name: Start preview server
        run: pnpm start &
        env:
          PORT: 3000

      - name: Wait for server
        run: npx wait-on http://localhost:3000 --timeout 30000

      - name: Lighthouse CI
        run: pnpm lhci autorun
        env:
          LHCI_BUILD_CONTEXT__EXTERNAL_BUILD_URL: ${{ github.event.pull_request.html_url || github.event.head_commit.url }}

      - name: axe-core a11y scan
        run: pnpm playwright test tests/a11y

  e2e:
    runs-on: ubuntu-latest
    timeout-minutes: 10
    needs: build-and-gate
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: 9
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm playwright install --with-deps chromium
      - run: pnpm build
        env:
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY_BUILD }}
          UPSTASH_REDIS_REST_URL: ${{ secrets.UPSTASH_REDIS_REST_URL_BUILD }}
          UPSTASH_REDIS_REST_TOKEN: ${{ secrets.UPSTASH_REDIS_REST_TOKEN_BUILD }}
          RESEND_API_KEY: ${{ secrets.RESEND_API_KEY_BUILD }}
          IP_HASH_SALT: ci-build-salt
      - run: pnpm start &
      - run: npx wait-on http://localhost:3000 --timeout 30000
      - run: pnpm playwright test tests/e2e
```

Note: `fetch-depth: 0` (not `2`) is required for `commitlint --from` to find the PR base SHA in the full history.

---

### Task 10: First commit and force push

**Files:**
- All staged files

- [ ] **Step 1: Run the full local check suite**

```bash
pnpm check && pnpm typecheck
```

Expected: Exits 0. Fix any Biome formatting issues with `pnpm check:fix` then re-run.

- [ ] **Step 2: Stage all files**

```bash
git add \
  .gitignore \
  .npmrc \
  biome.json \
  tsconfig.json \
  postcss.config.mjs \
  lighthouserc.json \
  commitlint.config.ts \
  package.json \
  pnpm-lock.yaml \
  app/ \
  public/ \
  next.config.ts \
  scripts/ \
  content/ \
  scaffold/ \
  prototype/ \
  docs/ \
  ARCHITECTURE.md \
  CLAUDE.md \
  DECISIONS.md \
  HANDOFF.md \
  LAUNCH.md \
  .husky/ \
  .github/
```

- [ ] **Step 3: Verify staged files look correct**

```bash
git status
```

Expected: All project files staged, no surprises. `node_modules/`, `.next/`, `.env*` must NOT appear.

- [ ] **Step 4: Make the first commit via commitizen**

```bash
pnpm commit
```

The commitizen prompt fires. Fill in:
- **type:** `chore`
- **scope:** `infra`
- **short description:** `bootstrap Next.js 15 scaffold with commitizen`
- **body:** (leave blank)
- **breaking change:** `n`
- **issues:** (leave blank)

Expected commit message: `chore(infra): bootstrap Next.js 15 scaffold with commitizen`

Commitlint runs automatically via the `commit-msg` hook and validates the message.

- [ ] **Step 5: Verify the commit was created**

```bash
git log --oneline -1
```

Expected: `<sha> chore(infra): bootstrap Next.js 15 scaffold with commitizen`

- [ ] **Step 6: Force push to replace remote history**

```bash
git push --force origin main
```

Expected: Output includes `+ <old-sha>...<new-sha> main -> main (forced update)`

**This wipes all previous commits on `https://github.com/erikunha/portfolio`. GitHub settings, issues, and collaborators are preserved.**

- [ ] **Step 7: Verify remote reflects the new history**

```bash
git log --oneline origin/main
```

Expected: Single commit — `chore(infra): bootstrap Next.js 15 scaffold with commitizen`

---

## Known gaps (resolved in later PRs)

- `scripts/validate-content.mjs` — referenced in the `validate-content` npm script but not created here. It's a Day 2 artifact (content schemas phase). The script does not run in this plan's verification steps; `pnpm ci` will fail until it's created.
- Placeholder test files — none exist yet. The `--passWithNoTests` flag on the test script handles this until the first unit tests are added.

---

## Post-bootstrap verification

After Task 10, confirm:

```bash
# 1. commitizen prompt fires on git commit
git commit --allow-empty  # should launch cz prompt, then abort with Ctrl+C

# 2. bad commit message is rejected
echo "wip" | .husky/commit-msg /dev/stdin
# Expected: error, exits non-zero

# 3. main branch passes pre-push
bash .husky/pre-push
# Expected: exits 0

# 4. feature branch passes pre-push
git checkout -b feat/test-branch
bash .husky/pre-push
git checkout main && git branch -D feat/test-branch
# Expected: exits 0 on feat/test-branch, returns to main
```
