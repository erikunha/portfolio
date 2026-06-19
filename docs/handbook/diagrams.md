# Diagram Collection

> Every engineering-platform diagram in one browsable place, for architecture reviews and onboarding. Source diagrams also live inline in the docs they belong to (linked per section). Architecture-side diagrams (routing tree, rendering pipeline, request lifecycle, entity model, component hierarchy, state ownership) are in [`/docs/01`–`/docs/05`](../README.md).

## Development lifecycle (from [development-lifecycle](./development-lifecycle.md))

```mermaid
flowchart TD
    idea["Idea"] --> brainstorm["Brainstorm"]
    brainstorm --> spec["Spec (approved)"]
    spec --> agate{"architect gate: PASS?"}
    agate -->|no| spec
    agate -->|yes| plan["Plan (decomposed)"]
    plan --> branch["feature branch"] --> tdd["TDD implement"]
    tdd --> battery["review battery + stamp"]
    battery --> push["pre-push gates"] --> pr["PR"]
    pr --> conv["Review convergence"] --> merge["owner squash-merge"]
    merge --> deploy["deploy"] --> smoke["smoke test"] --> adr["ADR + handoff"]
    adr --> idea
```

## The gate chain: commit to production (from [review-merge-release](./review-merge-release.md))

```mermaid
flowchart LR
    w["written"] --> c["Biome + commitlint"]
    c --> b["battery + stamp"]
    b --> pp["pre-push: main-guard · branch-name · stamp · API-audit · verify"]
    pp --> rfp["ready-for-pr: ci:local · bundle · pr-size · runtime · review-pr"]
    rfp --> o["open: validate-body · convergence"]
    o --> rtm["ready-to-merge: ci · protection · copilot · threads"]
    rtm --> m["squash-merge"] --> d["deploy + smoke"]
```

## AI in the SDLC (from [ai-assisted-development](./ai-assisted-development.md))

```mermaid
sequenceDiagram
    participant H as Human
    participant C as Claude Code
    participant A as Subagents
    participant G as Gates
    participant CI as CI + Copilot
    H->>C: intent
    C->>A: architect-reviewer (spec gate)
    A-->>G: GATE_RESULT: PASS
    C->>C: plan + TDD implement
    C->>A: 5-agent review battery
    A-->>C: findings -> ledger -> resolve
    C->>G: review:stamp (verify) -> push
    C->>CI: PR; Copilot review
    C->>C: convergence -> green
    H->>CI: owner squash-merges
    C->>G: SessionEnd -> learning-loop
```

## Hook lifecycle (from [agents-skills-hooks-mcp](./agents-skills-hooks-mcp.md))

```mermaid
flowchart TD
    tool{Tool call} -->|Bash| pre1["PreToolUse: bash-guard · api-security-push-guard"]
    tool -->|Skill| pre2["PreToolUse: architect-gate"]
    pre1 -->|exit 2| x1["BLOCKED"]
    pre2 -->|exit 2| x2["BLOCKED"]
    pre1 -->|exit 0| run["tool runs"]
    pre2 -->|exit 0| run
    run -->|Edit/Write| post["PostToolUse: api-edit-marker · css-token-guard · section-order-guard"]
    post --> se["...SessionEnd: learning-loop"]
```

## Review battery + verification loop

```mermaid
flowchart LR
    diff --> b1["review-pr"] & b2["accessibility-tester"] & b3["security-auditor"] & b4["performance-engineer"] & b5["dependency-manager"]
    b1 & b2 & b3 & b4 & b5 --> s["battery-synthesis"]
    s --> l[".review-findings.json"]
    l --> st["review:stamp (dispatch + resolution, transcript-verified)"]
    st --> ar[".review-findings-archive.jsonl"]
    ar --> ln["review:learn (propose recurring -> gates)"]
```

## Agent / MCP orchestration (from [agents-skills-hooks-mcp](./agents-skills-hooks-mcp.md))

```mermaid
flowchart LR
    agent["Claude Code"] --> ctx7["context7 (docs)"]
    agent --> up["upstash (read-only state)"]
    agent --> gh["GitHub MCP"]
    agent --> vc["Vercel MCP"]
    agent --> cd["Chrome DevTools MCP"]
    repo["/api/mcp (repo's own server)"] --> ext["external agents: get_profile, ask_erik"]
```

## Knowledge hierarchy (from [knowledge-architecture](./knowledge-architecture.md))

```mermaid
flowchart TD
    intent["WHY: DECISIONS.md · STANDARDS.md · ARCHITECTURE.md"] --> plan["WHAT/HOW: specs · plans"]
    plan --> maps["MAPS: /docs/01-11 · /docs/handbook"]
    intent --> agent["AGENT: CLAUDE.md · rules · skills"]
    maps --> agent
    plan --> mem["MEMORY: MEMORY.md · .remember/"]
```

## Spec to plan to PR (from [knowledge-architecture](./knowledge-architecture.md))

```mermaid
flowchart LR
    bs["brainstorm"] --> spec["spec (intent + gaps)"]
    spec --> g{"architect PASS?"}
    g -->|yes| plan["plan (tasks)"]
    plan --> impl["implement (TDD)"]
    impl --> pr["squash PR (#NNN)"]
    pr --> adr["ADR (reversible)"]
```

## Rollback (from [review-merge-release](./review-merge-release.md))

```mermaid
flowchart LR
    bad["bad deploy"] --> fast["FAST: vercel promote <prev>"]
    bad --> slow["SLOW: git revert + push --no-verify"]
    fast --> v["curl /api/healthz | jq .sha"]
    slow --> v
```

## Roadmap sequencing (from [roadmap](./roadmap.md))

```mermaid
flowchart LR
    p0["P0: transcript SPOF · first-push friction · feature-guide+troubleshooting docs"] --> p1["P1: naming gate · MCP rate-limit · ADR cross-link · CONTRIBUTING"]
    p1 --> p2["P2: API gate de-dup · prompt library · incident guide"]
    p2 --> p3["P3: ecosystem re-scan · frontend playbook"]
```

## Index of all diagrams (both doc sets)

| Diagram | Doc |
|---|---|
| Development lifecycle | handbook/development-lifecycle |
| Gate chain (commit -> prod) | handbook/review-merge-release |
| AI-in-SDLC sequence | handbook/ai-assisted-development |
| Context layers | handbook/ai-assisted-development |
| Hook lifecycle | handbook/agents-skills-hooks-mcp |
| Review battery + verification loop | handbook/ai-assisted-development |
| Agent/MCP orchestration | handbook/agents-skills-hooks-mcp |
| Knowledge hierarchy | handbook/knowledge-architecture |
| Rollback | handbook/review-merge-release |
| Platform overview | handbook/README |
| Routing tree · rendering pipeline · request lifecycle | /docs/03 |
| Domain entity model | /docs/02 |
| Component hierarchy · state ownership | /docs/04 |
| Layered architecture · dependency graph | /docs/01 |
| /api/ask + /api/contact sequences | /docs/03 |
| Integration map | /docs/05 |
| CI/CD pipeline | /docs/07 |
