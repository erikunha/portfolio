# Dependency hygiene

> Eight surfaces guard the dependency graph. Each answers one question. Find the question you have, then read the surface that owns it.

## The eight surfaces

| # | Surface | Question it answers | Where it lives | When it runs |
| - | ------- | ------------------- | -------------- | ------------ |
| 1 | Lockfile | Is this install exactly what was reviewed? | `pnpm-lock.yaml`, `pnpm install --frozen-lockfile` in `.github/actions/setup/action.yml` | Every CI install; a drifted lockfile fails the install |
| 2 | Release-age gate | Is every resolved version old enough to have been noticed if it was malicious? | `minimumReleaseAge` in `pnpm-workspace.yaml` (10080 minutes, seven days) | Every resolving install, local and Dependabot |
| 3 | Pinning gate | Does each manifest range follow the pin policy? | `pnpm check:dep-pinning` (`scripts/gates/check-dep-pinning.ts`) | `quality-fast` job and `pnpm verify` |
| 4 | Vetting file | Does every direct dependency have a stated purpose, an allowed license and no unexplained install script? | `dependency-vetting.json`, `pnpm check:dependency-vetting` | `quality-fast` job and `pnpm verify` |
| 5 | Audit | Does the lockfile contain a known vulnerability of moderate severity or higher? | `pnpm audit --audit-level=moderate` in `ci.yml` | `test` job, on every push and on pull requests that change the lockfile |
| 6 | Dependency review | Does this pull request add a high-severity or denied-license package? | `dependency-review` job in `ci.yml` (`fail-on-severity: high`, GPL and AGPL denied) | Pull requests only |
| 7 | Dependabot | Which dependencies and actions have a newer version, grouped into one pull request per kind? | `.github/dependabot.yml` (weekly, seven-day cooldown, `zod` and `typescript` held back) | Weekly |
| 8 | Tool pins | Are the binaries no package manager tracks (gitleaks, semgrep) still current? | `pnpm check:tool-pins`, `.github/workflows/tool-pins.yml` | Weekly; a stale pin is a nudge and blocks no pull request |

## How the surfaces fit

The release-age gate and the lockfile resolution probe (`.github/workflows/lockfile-resolution-probe.yml`) belong together. The gate refuses a version younger than seven days. When every version in a range is that young, resolution fails, and so does the Dependabot update that needs it. CI installs frozen and never resolves, so the weekly probe is the only report of that block.

Adding a direct dependency touches three surfaces at once: the manifest range must pass the pinning gate (3), the package needs a purpose and license entry (4), and the lockfile changes (1, then 5 and 6 on the pull request).

A failing surface is fixed at its cause. Do not lower the release age, widen a range, add a license to the allow list without review, or drop an audit level to get a green run.
