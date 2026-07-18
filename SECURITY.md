# Security Policy

## Supported versions

This is a single, continuously deployed web application. Only the current `main` branch (live at erikunha.dev) is supported; there are no released versions or backports.

## Reporting a vulnerability

**Please do not open a public issue for security problems.**

Report privately by either:

- **GitHub Security Advisories** — open a private advisory via the repository's **Security → Report a vulnerability** tab (preferred), or
- **Email** — erikhenriquealvescunha@gmail.com with `SECURITY` in the subject.

Please include a description of the issue, the affected URL or code path, reproduction steps or a proof of concept, and the impact you believe it has. If you have a suggested fix, include it.

**What to expect:** an acknowledgement within a few days, an assessment of severity, and a fix or mitigation for confirmed issues as quickly as is practical for a solo-maintained project. You will be credited in the fix unless you prefer to remain anonymous. Please give a reasonable window for a fix before any public disclosure.

## Scope

In scope: the deployed site and its API routes (`/api/*`), the build and CI configuration, and the dependency supply chain.

Out of scope: findings that require a compromised maintainer machine or account, denial of service through raw request volume, best-practice suggestions with no demonstrated impact, and reports generated solely by automated scanners without a working proof of concept.

## Security posture

The repository defends in depth, and most of these are enforced in CI on every change:

- **Secret scanning** — a checksum-pinned `gitleaks` runs as a pre-commit hook and in CI; a fixture test proves the scanner actually fires.
- **Static analysis** — Semgrep and GitHub CodeQL run in CI.
- **Dependency review** — a dependency-review gate runs on pull requests; dependencies are exact- or caret-pinned and installed with a frozen lockfile in CI.
- **Content Security Policy** and security headers are set at the edge; the API boundary enforces rate limiting and input validation (Zod) before any handler logic runs.
- **No secrets in the repo.** All credentials are environment variables provided at deploy time.

Responsible reports that improve any of the above are genuinely appreciated.
