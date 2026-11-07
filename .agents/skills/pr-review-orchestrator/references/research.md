# Exact-version research

Use when a framework or library question can change a finding. Resolve the installed version
from `pnpm-lock.yaml` first; never reason from "latest".

## Evidence order (strongest first)

1. Installed implementation in `node_modules/<pkg>` (or `node_modules/.pnpm/<pkg>@<ver>/...`)
2. Installed types (`.d.ts`) and `package.json` (peer ranges, exports)
3. Version-matched official docs (context7 with the exact version, or the tagged docs)
4. Upstream source and tests at the matching tag
5. Release notes and migration guides for every major crossed (3 to 6 is three guides)
6. Maintainer-confirmed issue
7. Strong practitioner evidence, then community posts, then books, then memory

When the installed artifact and current upstream differ, the installed artifact wins; say which
one you read.

## Upstream issues

For a plausible upstream bug record: version, date, reproducer, maintainer response, status,
linked PR or release, independent reports. Classify UPSTREAM_CONFIRMED, STRONG, INDICATIVE,
ANECDOTAL, STALE or CONTRADICTED. An issue creates a hypothesis; a local reproduction decides
whether it applies here.

## Overrides and pins

For every `pnpm.overrides` entry the change adds or keeps, check the dependent's declared peer or
dependency range. An override outside that range is a finding unless the incompatible path is
shown unreachable and the reason is recorded in DECISIONS.md.

## Repo-specific pins

`zod` exact (minor bumps break inference), TypeScript held at 6.x (Stryker needs the TS JS API),
Node from `.nvmrc`. A change that moves one of these needs its own DECISIONS.md entry.
