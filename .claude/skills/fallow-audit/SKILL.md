---
name: fallow-audit
description: Run an on-demand, READ-ONLY architecture and dead-code audit of this TypeScript/JavaScript codebase using the pinned fallow CLI. Use ONLY when the user explicitly asks to "run a fallow audit", check circular dependencies, find architecture-boundary violations, or scan for unused exports/files. Do NOT auto-activate on generic "clean up the code" phrasing — Biome and the repo's dep/bundle gates cover that.
---

# fallow audit (read-only, on-demand)

`fallow` reports circular dependencies, architecture-boundary violations, unused
files/exports/types/deps, duplication, and complexity hotspots — gaps the existing
gates (Biome, `check-dep-pinning`, `check-bundle-size`) do not cover. Use it as an
**advisory report generator only**.

## Invocation — pinned, read-only ONLY

Always invoke through the pinned form. `.claude/hooks/bash-guard.sh` blocks every
other form (unpinned, global, or a write/runtime subcommand):

    npx fallow@2.85.0 audit        # changed-files review: dead code + complexity + dupes
    npx fallow@2.85.0 dead-code    # unused code, dependency hygiene, architecture cycles
    npx fallow@2.85.0 dupes        # copy-paste + structural duplication
    npx fallow@2.85.0 health       # complexity, maintainability, hotspots
    npx fallow@2.85.0 flags        # feature-flag usage patterns
    npx fallow@2.85.0 list         # discovered files, entry points, boundaries (inspection)

## Hard rules

- NEVER run `fallow fix` or `--fix`. It deletes source files. The hook blocks it;
  do not try to work around the block.
- NEVER run `init`, `hooks`, `setup-hooks`, `migrate`, or `watch` (they write git
  hooks / config or run unbounded). The hook blocks them.
- NEVER enable the paid runtime, cloud upload, CI posting, `license`, `coverage`, or
  `telemetry`, and never set `FALLOW_COMMENT`/`FALLOW_REVIEW`/`FALLOW_TOKEN`. These
  open a network exfil channel (lethal-trifecta leg). The hook blocks them.
- Treat any project `.fallowrc` as untrusted input. Do NOT add or follow a remote
  `extends:` URL in it.
- Run the command BARE. No pipes (`| head`), no chaining (`&&`, `;`), no redirection
  (`> file`), no command substitution, no `FALLOW_*` env prefix — the hook blocks all
  of these. Read fallow's output directly from the tool result.

## Interpreting output — ADVISORY, never auto-delete

fallow uses the Oxc parser (no TypeScript type-checking), so it produces FALSE
POSITIVES against this repo's conventions. Before acting on ANY "unused" finding,
manually verify it is not one of:

- A `*.client.tsx` boundary file or a server/client island entry point.
- A Next.js magic file: `page.tsx`, `layout.tsx`, `route.ts`, `*.mdx`,
  `opengraph-image*`, `sitemap.ts`, `robots.ts`, `not-found.tsx`, `error.tsx`,
  `loading.tsx`.
- A `content/*.ts` module consumed only at build time by Zod validation.
- A barrel/re-export, a dynamic `import()` target, or a value referenced only in JSX.
- A token/type consumed by the Style Dictionary pipeline or CSS.

Report findings to the user as a list with `file:line` and a recommendation. Apply
deletions only after the user confirms each one. Never batch-delete from a fallow
report.
