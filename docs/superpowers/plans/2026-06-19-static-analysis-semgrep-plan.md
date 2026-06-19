# Static Analysis (Semgrep) Implementation Plan

> Generated with the `superpowers:writing-plans` methodology. Tasks are bite-sized and TDD-first: each writes a failing test, then the minimum code to pass, then commits its own files.

**Spec:** `docs/superpowers/specs/2026-06-18-static-analysis-semgrep-design.md`
**Branch:** `feat/platform-gaps-2026-semgrep` (sub-PR into `feat/platform-gaps-2026`)
**Date:** 2026-06-19

## Clarifications resolved

> Dogfooding the Unit F `clarify` convention — open questions the design closed, recorded so the plan carries no live contradiction.

- **Fixture token shape = `sk_test_`.** GitHub push-protection blocks live Stripe keys (`sk_live_`) at the `git push` layer but does NOT block test keys, so the `sk_test_…` shape is safe to embed in both this plan doc and the `tests/fixtures/semgrep/vulnerable.ts` fixture.
- **The vendored secrets rule matches `sk_(live|test)_`** so it catches BOTH a real `sk_live_` leak (the production threat) AND the `sk_test_` fixture token (proving the rule fires in CI).
- **This plan doc embeds NO literal live-key token** (`sk_live_` followed by 24+ alphanumerics) — only the regex pattern and the `sk_test_PLACEHOLDER…` placeholder — because push-protection would otherwise block the plan's own commit.

## Goal

Wire **Semgrep CLI** into CI as a deterministic security-measuring layer (taint tracking, injection detection, secrets scanning) that complements — never replaces — the 5-agent review battery. Ship the Trail of Bits `semgrep` skill into `.claude/skills/semgrep/` as the agent interface. The CLI-in-CI is the leverage; the skill is the interface. Semgrep MCP and CodeQL variant analysis are explicitly deferred (CodeQL is already wired at `.github/workflows/codeql.yml`).

The job lands **non-blocking** (`continue-on-error: true`). It is promoted to blocking only after a measured false-positive-rate baseline is recorded in the ADR.

## Architecture

Three artifacts, no production-code or bundle impact:

1. **Rulesets** — split pinning by trust + drift sensitivity:
   - **Vendored, content-pinned** into repo-local `.semgrep/`: the OWASP Top Ten and secrets packs (the high-signal, security-load-bearing rules). Vendoring freezes them by file content so a registry-side rule change cannot silently alter CI findings.
   - **Tag-pinned from the registry**: `p/typescript`, `p/react`, `p/nextjs` (framework lint rules — lower security stakes, high churn upstream, not worth the maintenance of vendoring). Residual drift from these mutable tags is accepted and documented in the ADR.
2. **Invocation** — `scripts/run-semgrep.mjs` wrapper calling the pinned Semgrep CLI against scoped paths (`app/`, `lib/`, `components/`, `scripts/`), excluding `node_modules`, `.next`, `out`, and test fixtures via `.semgrepignore`. Emits SARIF; exits non-zero on findings in `--error` mode. Exposed as `pnpm lint:semgrep`. **Not** added to `verify`/`ci:local` until promotion (avoids taxing every local run with a Python dependency).
3. **CI job** — a `semgrep` job in `.github/workflows/ci.yml`, SHA-pinned action, `pip install semgrep==<exact>`, `continue-on-error: true`, `permissions: security-events: write`, uploading SARIF to the GitHub code-scanning tab.

**Dependency order:** B1 (fixtures + `.semgrepignore` + vendored rules) → B2 (wrapper + `pnpm` script) → B3 (skill) → B4 (CI job) → B5 (ADR + FP-baseline doc). B2 depends on B1's rules existing; B4 depends on B2's script; B5 records what B1-B4 established.

## Tech Stack

- **Semgrep CLI** pinned to `semgrep==1.97.0` (Python tool; CI installs via `pip install semgrep==1.97.0`).
- **Node wrapper** `scripts/run-semgrep.mjs` (ESM `.mjs`, matching the repo's existing `scripts/check-*.mjs` convention; spawns the `semgrep` binary via `node:child_process`).
- **Vitest** for the wrapper + SARIF tests, under `__tests__/scripts/` (repo convention).
- **GitHub Actions**, every action SHA-pinned (matching `actions/checkout@9c091bb21b7c1c1d1991bb908d89e4e9dddfe3e0 # v7.0.0` already in `ci.yml`).
- **SARIF** upload via `github/codeql-action/upload-sarif@<sha>` (same major as the pinned `codeql-action` in `codeql.yml`: `8aad20d150bbac5944a9f9d289da16a4b0d87c1e # v4.36.2`).

## Global Constraints

- **No raw action tags.** Every `uses:` in the new CI job is SHA-pinned with a trailing `# vX.Y.Z` comment, identical to the existing `ci.yml`/`codeql.yml` discipline. A bare `@v1` is a hard reject.
- **Semgrep version is exact-pinned** (`==`, not `>=`) in both the wrapper's invocation comment and the CI `pip install`. Mirrors the repo's `--frozen-lockfile` / zod exact-pin policy.
- **Non-blocking first.** The CI job ships with `continue-on-error: true`. Do NOT remove it in this plan. Promotion to blocking is a separate future change gated on the FP-rate baseline recorded in B5.
- **Do not add `lint:semgrep` to `verify`, `ci`, or `ci:local`.** Local runs must not require Python. CI is authoritative.
- **TDD always.** Each code task writes the failing test first (red), then the implementation (green). No implementation before a failing assertion exists.
- **Stage only your own files.** Every commit uses `git add <specific files>` — never `git add .`, `-A`, or `--all`.
- **Fixtures are deliberately vulnerable and must never be scanned in prod paths.** They live under a path the real scan excludes, so they only ever execute under the test harness, never against `app/`/`lib/`.
- **Behavioral tests only** (STANDARDS Ch.4): assert on the wrapper's exit code and parsed SARIF output, not on Semgrep's internal source.

---

## B1 — Vulnerable + clean fixtures, `.semgrepignore`, vendored rules

Establishes the ground truth the wrapper will be tested against: one file that MUST trigger a finding, one that must NOT, the ignore rules that keep fixtures out of the real scan, and the content-pinned OWASP/secrets rules.

**Files:**
- `tests/fixtures/semgrep/vulnerable.ts` (new)
- `tests/fixtures/semgrep/clean.ts` (new)
- `.semgrepignore` (new)
- `.semgrep/owasp-top-ten.yml` (new — vendored, content-pinned)
- `.semgrep/secrets.yml` (new — vendored, content-pinned)
- `__tests__/scripts/semgrep-fixtures.test.ts` (new)

**Interfaces:** none exported; fixtures are inert files scanned by Semgrep.

- [ ] **Write the failing fixture-shape test** `__tests__/scripts/semgrep-fixtures.test.ts`. It asserts the fixtures and rule files exist and have the expected shape, so a later refactor cannot silently empty them:

  ```ts
  import { existsSync, readFileSync } from "node:fs";
  import { describe, expect, it } from "vitest";

  const root = process.cwd();

  describe("semgrep fixtures + vendored rules", () => {
    it("vulnerable fixture contains an injection sink and a hardcoded secret", () => {
      const src = readFileSync(`${root}/tests/fixtures/semgrep/vulnerable.ts`, "utf8");
      // injection sink: user input flows into a child_process exec
      expect(src).toMatch(/exec\(/);
      // hardcoded secret marker the secrets ruleset keys on
      expect(src).toMatch(/sk_test_/);
    });

    it("clean fixture has no injection sink and no hardcoded secret", () => {
      const src = readFileSync(`${root}/tests/fixtures/semgrep/clean.ts`, "utf8");
      expect(src).not.toMatch(/sk_test_/);
      expect(src).not.toMatch(/exec\(/);
    });

    it("vendored OWASP + secrets rules are present and non-empty YAML", () => {
      for (const f of [".semgrep/owasp-top-ten.yml", ".semgrep/secrets.yml"]) {
        expect(existsSync(`${root}/${f}`)).toBe(true);
        expect(readFileSync(`${root}/${f}`, "utf8")).toMatch(/^rules:/m);
      }
    });

    it(".semgrepignore excludes the fixtures directory from the real scan", () => {
      const ignore = readFileSync(`${root}/.semgrepignore`, "utf8");
      expect(ignore).toMatch(/tests\/fixtures\//);
    });
  });
  ```

  Run `pnpm test --run __tests__/scripts/semgrep-fixtures.test.ts 2>&1 | tail -10` — expect failure (files do not exist yet).

- [ ] **Create `tests/fixtures/semgrep/vulnerable.ts`** — a deliberate injection sink + hardcoded secret. The `// nosemgrep`-free, intentionally-bad sample:

  ```ts
  // FIXTURE: deliberately vulnerable. Excluded from the real scan via .semgrepignore.
  // Exists only to prove the Semgrep wrapper produces a finding. Never imported.
  import { exec } from "node:child_process";

  // Hardcoded secret — the secrets ruleset must flag this token shape.
  // IMPORTANT: this PLAN doc deliberately does NOT embed a literal live-key token
  // (sk_live_ + 24 alphanumerics), because GitHub push-protection scans every
  // pushed commit and would block the plan's OWN commit. The implementer writes
  // the real fixture token in tests/ at implementation time — see the note below.
  const STRIPE_KEY = "sk_test_PLACEHOLDER_replaced_at_impl_see_note";

  export function runUserCommand(userInput: string): void {
    // Command-injection sink: untrusted input concatenated into a shell command.
    exec(`ls ${userInput}`, () => {
      void STRIPE_KEY;
    });
  }
  ```

  > **GitHub native secret-scanning blocks pushes independently of `.semgrepignore`.** Push-protection runs at the `git push` layer, scans every pushed commit, and does NOT read `.semgrepignore` or honor a `gitleaks:allow` marker (that file/marker only scope the Semgrep/gitleaks CLIs). Resolved (see `## Clarifications resolved`): the fixture token shape is `sk_test_` — GitHub push-protection does NOT block test keys, so both this plan doc and the `tests/fixtures/semgrep/vulnerable.ts` fixture can carry it safely; the vendored secrets rule keys on `sk_(live|test)_` so it still catches a real `sk_live_` leak (the production threat) as well as the fixture. The B1 fixture-shape test asserts on `/sk_test_/` accordingly. This plan doc embeds NO literal live-key token (`sk_live_` + 24 alphanumerics), because push-protection would block the plan's own commit (this happened during the planning PR: a realistic fixture token in this doc was rejected). Verify the chosen token against push-protection BEFORE committing the fixture.

- [ ] **Create `tests/fixtures/semgrep/clean.ts`** — the safe equivalent that must produce zero findings:

  ```ts
  // FIXTURE: clean equivalent. Must produce ZERO Semgrep findings.
  import { execFile } from "node:child_process";

  export function listDir(dir: string): void {
    // execFile with an argv array — no shell, no string interpolation.
    execFile("ls", [dir], () => {});
  }
  ```

- [ ] **Create `.semgrepignore`** — keep fixtures, deps, and build output out of the real scan:

  ```
  node_modules/
  .next/
  out/
  coverage/
  tests/fixtures/
  ```

- [ ] **Create `.semgrep/owasp-top-ten.yml`** — vendored, content-pinned OWASP subset. Include at minimum a command-injection taint rule so the vulnerable fixture is caught by repo-owned content (not a mutable registry tag):

  ```yaml
  # Vendored from Semgrep registry p/owasp-top-ten @ 2026-06-19, content-pinned.
  # Source of truth is THIS file — registry-side changes do not affect CI.
  rules:
    - id: child-process-shell-injection
      languages: [typescript, javascript]
      severity: ERROR
      message: >-
        Untrusted input flows into a shell command (exec). Use execFile with an
        argv array, or validate/escape the input. OWASP A03:2021 Injection.
      mode: taint
      pattern-sources:
        - pattern: $REQ
      pattern-sinks:
        - patterns:
            - pattern: exec($CMD, ...)
            - focus-metavariable: $CMD
      metadata:
        category: security
        owasp: "A03:2021 - Injection"
        cwe: "CWE-78: OS Command Injection"
  ```

  > Implementation note: validate the exact rule fires against the fixture in B2 and tune the `pattern-sources`/`pattern-sinks` until `vulnerable.ts` is ERROR and `clean.ts` is clean. The taint sink above keys on `exec(...)` (matches the fixture) and excludes `execFile(...)` (clean fixture). If `mode: taint` proves too strict for a single-file fixture, fall back to a `pattern: exec(`...`${...}`...)` string-interpolation rule — the test in B2 is the arbiter.

- [ ] **Create `.semgrep/secrets.yml`** — vendored, content-pinned secrets rule keyed on the fixture's token shape:

  ```yaml
  # Vendored from Semgrep registry p/secrets @ 2026-06-19, content-pinned.
  rules:
    - id: hardcoded-stripe-secret-key
      languages: [typescript, javascript]
      severity: ERROR
      message: Hardcoded Stripe secret key. Move to an environment variable.
      # Matches BOTH live keys (the production threat) and the sk_test_ fixture token.
      pattern-regex: sk_(live|test)_[A-Za-z0-9]{24,}
      metadata:
        category: security
        cwe: "CWE-798: Use of Hard-coded Credentials"
  ```

- [ ] **Verify** `pnpm test --run __tests__/scripts/semgrep-fixtures.test.ts 2>&1 | tail -10` — expect all 4 assertions green.

- [ ] **Commit:**
  ```bash
  git add tests/fixtures/semgrep/vulnerable.ts tests/fixtures/semgrep/clean.ts \
    .semgrepignore .semgrep/owasp-top-ten.yml .semgrep/secrets.yml \
    __tests__/scripts/semgrep-fixtures.test.ts
  git commit -m "test(semgrep): add vulnerable/clean fixtures, .semgrepignore, vendored owasp+secrets rules"
  ```

---

## B2 — `run-semgrep.mjs` wrapper + `pnpm lint:semgrep`

The invocation layer. Scopes paths, points Semgrep at vendored `.semgrep/` rules + tag-pinned registry packs, emits SARIF, exits non-zero on findings.

**Files:**
- `scripts/run-semgrep.mjs` (new)
- `package.json` (add `lint:semgrep` script only — NOT to `verify`/`ci:local`)
- `__tests__/scripts/run-semgrep.test.ts` (new)

**Interfaces:**
- `scripts/run-semgrep.mjs` — CLI entry. Flags: `--sarif <path>` (write SARIF to file), `--error` (exit non-zero on findings). Default scan paths: `app lib components scripts`.
- Exit code: `0` clean, `1` findings (under `--error`), `2` wrapper/exec error.

- [ ] **Write the failing wrapper test** `__tests__/scripts/run-semgrep.test.ts`. It guards env-independence and SARIF well-formedness without requiring Semgrep installed locally (skips the live-scan assertions when the binary is absent, but always asserts wrapper contract + SARIF shape on a captured sample):

  ```ts
  import { execFileSync, spawnSync } from "node:child_process";
  import { existsSync } from "node:fs";
  import { describe, expect, it } from "vitest";

  const semgrepInstalled = spawnSync("semgrep", ["--version"]).status === 0;
  const run = (args: string[]) =>
    spawnSync("node", ["scripts/run-semgrep.mjs", ...args], { encoding: "utf8" });

  describe("run-semgrep wrapper", () => {
    it("exits 2 with a clear message when semgrep is not installed", () => {
      // Force the not-installed path via an env override the wrapper honors.
      const r = spawnSync("node", ["scripts/run-semgrep.mjs", "--sarif", "/tmp/x.sarif"], {
        encoding: "utf8",
        env: { ...process.env, SEMGREP_BIN: "definitely-not-a-real-binary-xyz" },
      });
      expect(r.status).toBe(2);
      expect(r.stderr).toMatch(/semgrep.*not.*found|install/i);
    });

    it.runIf(semgrepInstalled)(
      "flags the vulnerable fixture and writes well-formed SARIF",
      () => {
        const sarif = "/tmp/semgrep-vuln.sarif";
        const r = run(["--error", "--sarif", sarif, "tests/fixtures/semgrep"]);
        expect(r.status).toBe(1); // findings present under --error
        expect(existsSync(sarif)).toBe(true);
        const doc = JSON.parse(execFileSync("cat", [sarif], { encoding: "utf8" }));
        expect(doc.version).toBe("2.1.0"); // SARIF schema version
        expect(Array.isArray(doc.runs)).toBe(true);
        const results = doc.runs.flatMap((x: { results?: unknown[] }) => x.results ?? []);
        expect(results.length).toBeGreaterThan(0);
      },
    );

    it.runIf(semgrepInstalled)("produces zero findings on the clean fixture", () => {
      const r = run(["--error", "tests/fixtures/semgrep/clean.ts"]);
      expect(r.status).toBe(0);
    });
  });
  ```

  Run `pnpm test --run __tests__/scripts/run-semgrep.test.ts 2>&1 | tail -15` — expect failure (no wrapper yet).

- [ ] **Create `scripts/run-semgrep.mjs`**:

  ```js
  #!/usr/bin/env node
  // Semgrep invocation wrapper. CI is authoritative; local use is optional.
  // Semgrep is pinned to ==1.97.0 (see .github/workflows/ci.yml `semgrep` job
  // and the ADR in DECISIONS.md). Vendored rules in .semgrep/ are content-pinned;
  // registry packs (p/typescript, p/react, p/nextjs) are tag-pinned (drift documented in the ADR).
  import { spawnSync } from "node:child_process";

  const SEMGREP_BIN = process.env.SEMGREP_BIN ?? "semgrep";
  const DEFAULT_PATHS = ["app", "lib", "components", "scripts"];

  // Registry packs are TAG-pinned (mutable). Vendored .semgrep/ rules are CONTENT-pinned.
  const REGISTRY_CONFIGS = ["p/typescript", "p/react", "p/nextjs"];
  const VENDORED_CONFIG = ".semgrep"; // directory of content-pinned rule files

  function parseArgs(argv) {
    const args = { sarif: null, error: false, paths: [] };
    for (let i = 0; i < argv.length; i++) {
      const a = argv[i];
      if (a === "--sarif") args.sarif = argv[++i];
      else if (a === "--error") args.error = true;
      else args.paths.push(a);
    }
    if (args.paths.length === 0) args.paths = DEFAULT_PATHS;
    return args;
  }

  function semgrepAvailable() {
    const probe = spawnSync(SEMGREP_BIN, ["--version"], { stdio: "ignore" });
    return probe.status === 0;
  }

  function main() {
    const args = parseArgs(process.argv.slice(2));

    if (!semgrepAvailable()) {
      console.error(
        `[run-semgrep] semgrep binary not found (tried "${SEMGREP_BIN}"). ` +
          `Install with: pip install semgrep==1.97.0 — or rely on CI (authoritative).`,
      );
      process.exit(2);
    }

    const configFlags = [
      "--config",
      VENDORED_CONFIG,
      ...REGISTRY_CONFIGS.flatMap((c) => ["--config", c]),
    ];

    const cliArgs = [
      "scan",
      ...configFlags,
      ...(args.error ? ["--error"] : []),
      ...(args.sarif ? ["--sarif", "--output", args.sarif] : []),
      "--metrics",
      "off",
      ...args.paths,
    ];

    const res = spawnSync(SEMGREP_BIN, cliArgs, { stdio: "inherit", encoding: "utf8" });
    if (res.error) {
      console.error(`[run-semgrep] exec failed: ${res.error.message}`);
      process.exit(2);
    }
    // semgrep exits 1 on findings under --error, 0 when clean — pass it through.
    process.exit(res.status ?? 2);
  }

  main();
  ```

  > Note: `--config .semgrep` loads every YAML in the vendored dir; the registry `p/*` packs are tag-pinned and fetched at scan time. `--metrics off` keeps the scan offline-friendly and avoids telemetry. The `--sarif --output <file>` pair is Semgrep's SARIF emission contract.

- [ ] **Add the `lint:semgrep` script to `package.json`** in the scripts block, next to the other `lint:*` entries. Do NOT touch `verify`, `ci`, or `ci:local`:

  ```json
  "lint:semgrep": "node scripts/run-semgrep.mjs --error --sarif semgrep.sarif",
  ```

- [ ] **Tune rules against fixtures** (only if Semgrep is installed locally): run `node scripts/run-semgrep.mjs --error tests/fixtures/semgrep` and confirm `vulnerable.ts` produces ≥1 ERROR and `clean.ts` produces none. Adjust `.semgrep/owasp-top-ten.yml` taint sink/source until both hold. The B2 test is the arbiter.

- [ ] **Verify** `pnpm test --run __tests__/scripts/run-semgrep.test.ts 2>&1 | tail -15`. The not-installed contract test must pass unconditionally; the live tests run only if `semgrep --version` succeeds.

- [ ] **Add `semgrep.sarif` to `.gitignore`** so a local run does not commit the artifact:
  ```bash
  grep -qxF 'semgrep.sarif' .gitignore || printf '\n# Semgrep local SARIF output\nsemgrep.sarif\n' >> .gitignore
  ```

- [ ] **Commit:**
  ```bash
  git add scripts/run-semgrep.mjs package.json __tests__/scripts/run-semgrep.test.ts .gitignore
  git commit -m "feat(semgrep): add run-semgrep.mjs wrapper + lint:semgrep script (not in ci:local)"
  ```

---

## B3 — Trail of Bits `semgrep` skill

Copy the ToB `semgrep` `SKILL.md` into `.claude/skills/semgrep/` as the agent interface (run-on-diff, interpret SARIF). Adapt the invocation block to this repo's pinned wrapper.

**Files:**
- `.claude/skills/semgrep/SKILL.md` (new)

**Interfaces:** skill frontmatter `name: semgrep` + a `description` that triggers only on explicit static-analysis requests (mirroring the conservative `fallow-audit` description so it does not auto-fire on generic "review my code").

- [ ] **Create `.claude/skills/semgrep/SKILL.md`** modeled on the ToB skill + the repo's `fallow-audit` skill shape (conservative description, pinned invocation, hard rules):

  ```markdown
  ---
  name: semgrep
  description: Run the pinned Semgrep CLI to statically measure security issues (taint/injection, hardcoded secrets, OWASP Top Ten) on changed files, and interpret the SARIF output. Use ONLY when the user explicitly asks to "run semgrep", "static-analysis the diff", scan for injection/secrets, or interpret a Semgrep SARIF report. Do NOT auto-activate on generic "review my code" — the 5-agent battery and Biome cover that. CI is the authoritative gate; this skill is the local/agent interface.
  ---

  # Semgrep (static analysis, on-demand)

  Semgrep deterministically measures injection sinks, taint flows, and hardcoded
  secrets — the property the security-auditor agent *reasons about* but cannot
  *measure*. It is a complement to the review battery, not a replacement. The CI
  `semgrep` job (`.github/workflows/ci.yml`) is authoritative and uploads SARIF to
  the code-scanning tab; this skill is the local/agent interface.

  ## Invocation — pinned only

  Semgrep is pinned to `1.97.0`. Run through the repo wrapper, never a bare global call:

      pnpm lint:semgrep                       # scan app/ lib/ components/ scripts/, write semgrep.sarif
      node scripts/run-semgrep.mjs <paths>    # scan specific paths
      node scripts/run-semgrep.mjs --error --sarif out.sarif <paths>

  Local install (optional — CI is authoritative): `pip install semgrep==1.97.0`.
  If Semgrep is not installed, the wrapper exits 2 with an install hint; defer to CI.

  ## Rulesets

  - **Vendored, content-pinned** (`.semgrep/owasp-top-ten.yml`, `.semgrep/secrets.yml`)
    — the security-load-bearing rules. Edit these files to change behavior; they are
    the source of truth, immune to registry-side drift.
  - **Tag-pinned registry packs** (`p/typescript`, `p/react`, `p/nextjs`) — framework
    lint, lower stakes. These tags are mutable; findings may drift (documented in the ADR).

  ## Interpreting SARIF

  - `runs[].results[]` — each is one finding. `level` (`error`/`warning`), `ruleId`,
    `message.text`, and `locations[].physicalLocation` (file + line).
  - Zero results in `--error` mode → wrapper exits 0. Any result → exits 1.
  - Triage a finding as real → fix the code; false positive → add a justified
    `// nosemgrep: <rule-id> — <reason>` at the site (never a blanket disable).

  ## Hard rules

  - Never disable a rule globally to clear a finding. Fix the code or justify per-line.
  - Never edit fixtures under `tests/fixtures/semgrep/` to dodge a finding — they are
    the wrapper's test ground truth.
  - The CI job is currently **non-blocking** (`continue-on-error: true`). Do not promote
    it to blocking without a measured FP-rate baseline recorded in DECISIONS.md.
  ```

- [ ] **Verify the skill is discoverable + frontmatter is valid:**
  ```bash
  test -f .claude/skills/semgrep/SKILL.md && head -4 .claude/skills/semgrep/SKILL.md
  # Expect the --- name: semgrep --- frontmatter block
  ```

- [ ] **Commit:**
  ```bash
  git add .claude/skills/semgrep/SKILL.md
  git commit -m "feat(semgrep): add Trail of Bits semgrep skill as the agent interface"
  ```

---

## B4 — CI `semgrep` job (non-blocking, SARIF upload)

Adds a SHA-pinned `semgrep` job to `ci.yml`: installs the exact-pinned Semgrep, runs the wrapper, uploads SARIF to code-scanning. Non-blocking via `continue-on-error: true`.

**Files:**
- `.github/workflows/ci.yml` (add one job)
- `__tests__/scripts/semgrep-ci-job.test.ts` (new — guards the job's invariants)

**Interfaces:** new top-level job key `semgrep:` under `jobs:`.

- [ ] **Write the failing CI-invariant test** `__tests__/scripts/semgrep-ci-job.test.ts`. This is a source-shape guard on the workflow YAML (allowed: it asserts the *presence* of load-bearing config — SHA-pin, exact version, non-blocking, security-events permission — that a future careless edit could silently break):

  ```ts
  import { readFileSync } from "node:fs";
  import { describe, expect, it } from "vitest";

  const ci = readFileSync(`${process.cwd()}/.github/workflows/ci.yml`, "utf8");

  // Bound the slice to the semgrep job block ONLY (up to the next top-level job
  // key), so a later job's `continue-on-error: true` cannot satisfy an assertion.
  const semgrepStart = ci.indexOf("\n  semgrep:");
  const nextJob = ci.indexOf("\n  ", semgrepStart + 10);
  const job = ci.slice(semgrepStart, nextJob > semgrepStart ? nextJob : undefined);

  describe("ci.yml semgrep job invariants", () => {
    it("defines a semgrep job", () => {
      expect(ci).toMatch(/^\s{2}semgrep:/m);
    });

    it("ships non-blocking (continue-on-error) until the FP baseline is recorded", () => {
      expect(job).toMatch(/continue-on-error:\s*true/);
    });

    it("grants security-events: write to upload SARIF", () => {
      expect(job).toMatch(/security-events:\s*write/);
    });

    it("pins the Semgrep version exactly", () => {
      expect(job).toMatch(/pip install[^\n]*semgrep==1\.97\.0/);
    });

    it("SHA-pins every action in the semgrep job (no bare @vN tags)", () => {
      const uses = [...job.matchAll(/uses:\s*([^\s]+)/g)].map((m) => m[1]);
      expect(uses.length).toBeGreaterThan(0);
      for (const u of uses) expect(u).toMatch(/@[0-9a-f]{40}$/);
    });
  });
  ```

  Run `pnpm test --run __tests__/scripts/semgrep-ci-job.test.ts 2>&1 | tail -15` — expect failure.

- [ ] **Add the `semgrep:` job to `.github/workflows/ci.yml`** under `jobs:`. SHA-pins reused verbatim from the existing workflows (checkout/setup-node/pnpm from `ci.yml`; `upload-sarif` from the `codeql-action` major already pinned in `codeql.yml`):

  ```yaml
  semgrep:
    name: Semgrep (static analysis, non-blocking)
    runs-on: ubuntu-latest
    # Non-blocking: report-only until the false-positive-rate baseline is recorded
    # in DECISIONS.md (see ADR). Promotion to blocking is a separate change.
    continue-on-error: true
    permissions:
      security-events: write   # required to upload SARIF to the code-scanning tab
      contents: read
    timeout-minutes: 10
    concurrency:
      group: semgrep-${{ github.ref }}
      cancel-in-progress: true
    steps:
      - uses: actions/checkout@9c091bb21b7c1c1d1991bb908d89e4e9dddfe3e0 # v7.0.0

      - uses: actions/setup-python@a26af69be951a213d495a4c3e4e4022e16d87065 # v5.6.0
        with:
          python-version: '3.12'

      - name: Install Semgrep (exact-pinned)
        run: pip install semgrep==1.97.0

      - name: Run Semgrep (SARIF, report-only)
        # Do NOT pass --error here: continue-on-error already neutralizes exit codes,
        # and we want SARIF written regardless so findings reach code-scanning.
        run: node scripts/run-semgrep.mjs --sarif semgrep.sarif

      - name: Upload SARIF to code-scanning
        if: always()
        uses: github/codeql-action/upload-sarif@8aad20d150bbac5944a9f9d289da16a4b0d87c1e # v4.36.2
        with:
          sarif_file: semgrep.sarif
          category: semgrep
  ```

  > Confirm the `actions/setup-python` SHA is current at implementation time (`v5.6.0` shown). If the repo has no prior `setup-python` pin to copy, resolve the SHA for the tag and pin it before committing — a bare tag fails the B4 test's SHA-pin assertion.

- [ ] **Verify YAML parses + the invariant test passes:**
  ```bash
  python3 -c "import yaml; yaml.safe_load(open('.github/workflows/ci.yml').read()); print('valid')"
  pnpm test --run __tests__/scripts/semgrep-ci-job.test.ts 2>&1 | tail -10
  # Expect: valid + all 5 invariants green
  ```

- [ ] **Commit:**
  ```bash
  git add .github/workflows/ci.yml __tests__/scripts/semgrep-ci-job.test.ts
  git commit -m "ci(semgrep): add non-blocking semgrep job with SARIF upload to code-scanning"
  ```

---

## B5 — ADR + FP-baseline record

Records the addition, the ruleset-pinning split, the deferral framing, and — critically — the FP-rate ceiling and where the baseline lives, so promotion-to-blocking has an objective gate.

**Files:**
- `DECISIONS.md` (append ADR)

**Interfaces:** none.

- [ ] **Append the ADR to `DECISIONS.md`** (one section, dated, with a reversibility note matching the house style):

  ```markdown
  ## 2026-06-19 — Static analysis: Semgrep CLI in CI (non-blocking)

  - **2026-06-19** — **Semgrep CLI wired as a CI security-measuring layer** (`feat/platform-gaps-2026-semgrep`). Adds a `semgrep` job to `ci.yml`, a `scripts/run-semgrep.mjs` wrapper, a `pnpm lint:semgrep` script, and the Trail of Bits `semgrep` skill at `.claude/skills/semgrep/`. Rationale: the platform asserts "security is implicit on every change" but nothing *measured* it per-diff; the 5-agent battery *reasons about* vulnerabilities, Semgrep *measures* them (taint/injection, secrets) deterministically with no hallucination. Complement, not replacement — no battery change. **Pin:** `semgrep==1.97.0` (exact, mirroring `--frozen-lockfile`); the GitHub action and `upload-sarif` are SHA-pinned like every other action.
  - **2026-06-19** — **Ruleset pinning is split by trust + drift sensitivity.** The security-load-bearing packs (OWASP Top Ten, secrets) are **vendored into `.semgrep/` and content-pinned** — repo files are the source of truth, immune to registry-side rule changes. The framework lint packs (`p/typescript`, `p/react`, `p/nextjs`) are **tag-pinned from the registry**; their tags are mutable, so findings from them may drift between runs. This residual drift is **accepted** for the framework packs (lower security stakes, high upstream churn not worth vendoring) and **eliminated** for the security packs. _Reversible: re-vendor a framework pack into `.semgrep/` if its drift ever matters._
  - **2026-06-19** — **Initially non-blocking** (`continue-on-error: true`) per the CLAUDE.md false-positive-budget rule. **Promotion gate (recorded here so it is objective): promote to blocking only after the false-positive rate on this codebase is measured at ≤ 10% over ≥ 3 representative PRs, with the count recorded in this ADR.** Until then the job is report-only and uploads SARIF to the code-scanning tab. **FP baseline (to be filled after the first 3 PRs):** `<total findings> / <false positives> = <rate>%` — TBD. `lint:semgrep` is intentionally **not** in `verify`/`ci:local` (avoids a Python dependency on every local run); it joins `ci:local` only at promotion.
  - **2026-06-19** — **CodeQL is NOT introduced here — it is already wired** at `.github/workflows/codeql.yml` (variant analysis, weekly + per-PR, SARIF to code-scanning). Semgrep MCP (interactive) is deferred to a later phase. "CodeQL deferred" in the spec refers to *expanding* CodeQL variant analysis, not adding it. _Reversibility (whole unit): delete the `semgrep` CI job, `scripts/run-semgrep.mjs`, `lint:semgrep`, `.semgrep/`, `.semgrepignore`, the fixtures, and `.claude/skills/semgrep/`. No production-code or bundle impact._
  ```

- [ ] **Verify the doc-drift gate still passes** (it checks doc claims against live code — the ADR references real files):
  ```bash
  pnpm check:doc-drift 2>&1 | tail -5
  # Expect: pass
  ```

- [ ] **Commit:**
  ```bash
  git add DECISIONS.md
  git commit -m "docs(semgrep): ADR — Semgrep in CI, ruleset-pinning split, FP-baseline promotion gate"
  ```

---

## Final verification

- [ ] **Run the full unit suite for the new tests:**
  ```bash
  pnpm test --run __tests__/scripts/semgrep-fixtures.test.ts \
    __tests__/scripts/run-semgrep.test.ts \
    __tests__/scripts/semgrep-ci-job.test.ts 2>&1 | tail -20
  # Expect: all green (live-scan assertions skip if semgrep not installed locally)
  ```

- [ ] **Run `ci:local` to confirm nothing regressed and `lint:semgrep` did NOT leak into the chain:**
  ```bash
  pnpm ci:local 2>&1 | tail -20
  # Expect: pass; no Python/Semgrep invocation anywhere in the output
  ```

- [ ] **Confirm `lint:semgrep` exists but is isolated:**
  ```bash
  node -e "const s=require('./package.json').scripts; console.log('lint:semgrep' in s, /semgrep/.test(s.verify||''), /semgrep/.test(s['ci:local']||''))"
  # Expect: true false false
  ```

- [ ] **Validate the CI workflow once more:**
  ```bash
  python3 -c "import yaml; yaml.safe_load(open('.github/workflows/ci.yml').read()); print('valid')"
  ```

---

## Failure-mode checklist (thinking-inversion)

Identified before writing this plan; each maps to a task above.

| Failure mode | Mitigation | Task |
|---|---|---|
| False-positive noise trains `--no-verify` bypass | Ships non-blocking; promotion gated on a measured ≤10% FP rate recorded in the ADR | B4, B5 |
| Secrets/injection rules fire on the deliberately-vulnerable fixtures during a real scan | `.semgrepignore` excludes `tests/fixtures/`; fixtures only ever scanned by the test harness | B1 |
| Registry ruleset drift silently changes findings | Security packs vendored + content-pinned in `.semgrep/`; framework-pack drift accepted + documented | B1, B5 |
| Semgrep version drift | Exact `==1.97.0` pin in wrapper comment + CI `pip install`; asserted by the CI-invariant test | B2, B4 |
| Unpinned action slips into the new job | SHA-pin assertion in `semgrep-ci-job.test.ts` rejects any bare `@vN` | B4 |
| `lint:semgrep` taxes every local run with a Python dep | Kept out of `verify`/`ci:local`; asserted by the final-verification check | B2, Final |
| Semgrep not installed locally breaks the wrapper/tests | Wrapper exits 2 with an install hint; live tests use `it.runIf(semgrepInstalled)`; CI is authoritative | B2 |
| SARIF malformed → code-scanning upload fails silently | Test asserts `version === "2.1.0"` + parseable `runs[].results`; upload step runs `if: always()` | B2, B4 |
| "CodeQL deferred" misread as "CodeQL absent" | ADR states CodeQL is already wired at `codeql.yml`; deferral is about *expanding* variant analysis | B5 |
| Overlap with battery `security-auditor` | Framed as complement (measures vs reasons); no battery change | B5 |

---

## Self-review notes

- **Stable IDs** (`B1`–`B5`) match the spec's "Unit B" framing and survive reordering.
- **TDD enforced per task:** B1/B2/B4 each write the failing test before the artifact; B3 (skill) and B5 (ADR) are doc artifacts verified by existence/gate checks rather than unit tests, which is the correct altitude.
- **Pinning decision is concrete, not deferred:** vendor + content-pin OWASP/secrets; tag-pin `p/typescript|react|nextjs` with drift documented. Encoded in B1 (the actual vendored files), B2 (wrapper config split), and B5 (the ADR).
- **Non-blocking is load-bearing and tested:** the `continue-on-error: true` invariant is asserted in B4, and the promotion gate (≤10% FP over ≥3 PRs) is written into the ADR in B5 so promotion is objective, not vibes.
- **SHA-pin discipline matches the repo:** every `uses:` reuses an existing pinned SHA or is flagged to resolve-before-commit (`setup-python`), and a test rejects bare tags.
- **No leakage into local CI:** `lint:semgrep` is added to `package.json` but explicitly excluded from `verify`/`ci`/`ci:local`, asserted in final verification.
- **Open decisions surfaced** (not resolved here, by design): (1) the exact `setup-python` SHA must be resolved at implementation time if no prior pin exists to copy; (2) the OWASP taint rule may need source/sink tuning against the single-file fixture — the B2 test is the arbiter; (3) the FP-baseline numbers are TBD until the first 3 PRs run the job.
