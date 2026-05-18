# Claude Code → VS Code Copilot harness port — design

**Date:** 2026-05-18
**Status:** Draft — pending user review before plan
**Author:** Erik Cunha (with Claude Code, brainstorming skill)

---

## 1. Problem

The Claude Code harness in `~/.claude/` carries substantial accumulated value: ~17 personal agents, ~100 skills (personal + plugin-provided), per-project and global `CLAUDE.md` files with curated dispatch rules, ~35 enabled plugins, MCP server registrations in `.mcp.json`, hooks, and settings. When working in VS Code with GitHub Copilot Chat, none of this is available. Copilot Chat starts from zero: no project context, no curated slash commands, no MCP servers, no agent personas, no per-file guidance.

The cost is real:
- Repeated context-setting in every Copilot conversation
- No equivalent of the project's stack/budget/a11y constraints automatically loaded
- No `architect-reviewer` / `code-reviewer` agents callable from Copilot
- MCP tools (`context7`, `chrome-devtools`, `postman`, `vercel`) configured in Claude Code but not in VS Code
- Per-file-type guidance (React in `components/`, Vercel in `app/api/`, tests in `__tests__/`) requires manual prompting

The goal: port as much of the Claude Code harness as is technically portable to VS Code Copilot Chat, via a re-runnable generator script that keeps the two in sync.

## 2. Scope

### In scope

- Project-level instructions: `erik-portifolio/CLAUDE.md` → `.github/copilot-instructions.md`
- User-level instructions: `~/.claude/CLAUDE.md` → `~/.config/Code/User/copilot-user-instructions.md` (manual paste into VS Code settings)
- Skills → `.github/prompts/<name>.prompt.md` (manually invokable via `/<name>`)
- Agents → both `.github/chatmodes/<name>.chatmode.md` (persistent persona) and `.github/prompts/<name>.prompt.md` (one-shot)
- Per-file `applyTo` instructions in `.github/instructions/*.instructions.md` (closest analogue to skill auto-trigger)
- MCP server subset → `.vscode/mcp.json`
- CI gate to enforce that generated files are in sync with the manifest

### Out of scope

- Hooks (`SessionStart`, `PostToolUse`, etc.) — no Copilot runtime equivalent
- Output styles (learning, explanatory) — no equivalent
- Memory system (`~/.claude/projects/.../memory/`) — Copilot has no equivalent persistence
- Skill auto-trigger by description — fundamentally not portable; `applyTo` per-file rules are a partial substitute
- Cursor / Cody / Zed support (architecture allows future renderer addition)
- Bidirectional sync (Copilot edits flowing back to Claude)
- npm-published version of the tool
- VS Code extension wrapping the generator
- Hook → CI-action porting

### Locked decisions

- **Target:** VS Code Copilot Chat (JetBrains Copilot supported where files overlap — no chat modes there)
- **Sync model:** re-runnable generator script (`pnpm sync:copilot`)
- **Generator home:** `erik-portifolio/scripts/sync-copilot.ts`
- **Selection:** explicit curated manifest in `scripts/copilot-port.config.ts`
- **Approach:** modular TypeScript with one translator module per surface

## 3. Fidelity map

| Claude Code | Copilot Chat | Fidelity |
|---|---|---|
| `CLAUDE.md` (project) | `.github/copilot-instructions.md` | 1:1 with surgical rewrites |
| `*.instructions.md` w/ `applyTo` | `.github/instructions/*.instructions.md` | 1:1 |
| Skills (`description`-triggered) | `.github/prompts/*.prompt.md` | Lossy — manual `/invoke`, no auto-dispatch |
| Subagents | `.github/chatmodes/*.chatmode.md` | Lossy — personas, not isolated contexts |
| Slash commands | Prompt files | 1:1 |
| `.mcp.json` | `.vscode/mcp.json` | 1:1 with shape conversion |
| Hooks (`SessionStart`, `PostToolUse`) | — | Gone. No equivalent. |
| Output styles | — | Gone. Closest: chat-mode preamble. |
| Memory system | — | Gone. Closest: hand-edited instructions file. |
| Global `CLAUDE.md` skill-dispatch table | VS Code user instructions | Lossy — no auto-trigger |

## 4. File layout

### Source files (hand-edited)

```
erik-portifolio/
├── scripts/
│   ├── sync-copilot.ts            # entrypoint — orchestration only, ~80 lines
│   ├── copilot-port.config.ts     # the curated manifest (you edit this)
│   └── lib/copilot/
│       ├── translators/
│       │   ├── skill-to-prompt.ts          # SKILL.md → .prompt.md
│       │   ├── agent-to-chatmode.ts        # agent .md → .chatmode.md
│       │   ├── agent-to-prompt.ts          # agent .md → .prompt.md
│       │   ├── claudemd-to-instructions.ts # CLAUDE.md → copilot-instructions.md
│       │   ├── applyto-to-instructions.ts  # config entries → instructions files
│       │   └── mcp-to-vscode.ts            # ~/.claude/.mcp.json → .vscode/mcp.json
│       ├── sources.ts             # resolves skill/agent paths (personal + plugin cache)
│       ├── frontmatter.ts         # YAML parse/emit helper (gray-matter)
│       ├── tool-map.ts            # Claude tool names → Copilot tool IDs
│       ├── refs.ts                # [[skill-ref]] rewriting (two-pass)
│       ├── diff.ts                # dry-run diff renderer
│       └── types.ts               # CopilotPortConfig, Skill, Agent types
└── __tests__/copilot/
    ├── skill-to-prompt.test.ts
    ├── agent-to-chatmode.test.ts
    ├── agent-to-prompt.test.ts
    ├── claudemd-to-instructions.test.ts
    ├── applyto-to-instructions.test.ts
    ├── mcp-to-vscode.test.ts
    ├── snapshot.test.ts           # full-pipeline snapshot
    └── fixtures/
        ├── skills/                # synthetic skill markdown
        ├── agents/                # synthetic agent markdown
        ├── claudemd/              # synthetic CLAUDE.md
        └── mcp/                   # synthetic .mcp.json
```

### Generated files (committed, carry auto-gen header)

```
.github/
├── copilot-instructions.md
├── prompts/
│   ├── architect-reviewer.prompt.md
│   ├── code-reviewer.prompt.md
│   ├── nextjs-developer.prompt.md
│   ├── brainstorming.prompt.md
│   ├── writing-plans.prompt.md
│   ├── verification-before-completion.prompt.md
│   └── ... one per manifest entry
├── chatmodes/
│   ├── architect-reviewer.chatmode.md
│   ├── nextjs-developer.chatmode.md
│   └── ... one per agent in manifest
└── instructions/
    ├── react.instructions.md       # applyTo: "components/**,app/**/*.tsx"
    ├── tests.instructions.md       # applyTo: "**/*.test.{ts,tsx},**/*.spec.ts"
    ├── api-routes.instructions.md  # applyTo: "app/api/**"
    └── content.instructions.md     # applyTo: "content/**"
.vscode/
└── mcp.json
```

### Generated files (NOT committed, outside the repo)

```
<VS Code User dir>/
└── copilot-user-instructions.md   # from ~/.claude/CLAUDE.md; pasted into VS Code settings manually
```

The VS Code User directory is platform-specific:
- macOS: `~/Library/Application Support/Code/User/`
- Linux: `~/.config/Code/User/`
- Windows: `%APPDATA%\Code\User\`

The generator detects platform via `process.platform` and writes to the correct path. On non-darwin platforms unsupported by the user today, the generator falls back to writing alongside the generated repo files with a one-line warning rather than failing.

Global instructions apply across all repos, so cannot live inside a single repo. The generator emits the file and prints a one-line reminder to paste it into VS Code's user-level Copilot instructions setting (VS Code does not auto-load files from this path yet — manual paste required once).

## 5. The manifest

`scripts/copilot-port.config.ts` is the only file curated by hand. Everything else is generated from it.

```ts
import type { CopilotPortConfig } from './lib/copilot/types';

export const config: CopilotPortConfig = {
  instructions: {
    projectClaudeMd: 'CLAUDE.md',
    globalClaudeMd: '~/.claude/CLAUDE.md',

    applyTo: [
      {
        name: 'react',
        applyTo: 'components/**,app/**/*.tsx',
        sourceSkill: 'react-best-practices',
      },
      {
        name: 'tests',
        applyTo: '**/*.test.{ts,tsx},**/*.spec.ts',
        sourceSkill: 'superpowers:test-driven-development',
      },
      {
        name: 'api-routes',
        applyTo: 'app/api/**',
        sourceSkill: 'vercel:vercel-functions',
      },
      {
        name: 'content',
        applyTo: 'content/**',
        body: 'All content is Zod-validated at build. Schema in `content/schema.ts`. Never inline copy in JSX.',
      },
    ],
  },

  skills: [
    'superpowers:brainstorming',
    'superpowers:writing-plans',
    'superpowers:verification-before-completion',
    'superpowers:systematic-debugging',
    'superpowers:test-driven-development',
    'thinking-pre-mortem',
    'thinking-model-router',
    'thinking-five-whys-plus',
    'commit-commands:commit',
    'commit-commands:commit-push-pr',
    'code-review:code-review',
    'security-review',
    'humanizer',
  ],

  agents: [
    'architect-reviewer',
    'nextjs-developer',
    'typescript-pro',
    'code-reviewer',
    'test-automator',
    'ui-ux-tester',
    'security-auditor',
    'performance-engineer',
    'accessibility-tester',
    'ai-engineer',
    'dx-optimizer',
  ],

  mcp: ['context7', 'chrome-devtools', 'postman', 'vercel'],
};
```

Names use plugin prefix (`superpowers:brainstorming`) when needed to disambiguate. Resolution order is personal-first, plugin cache second.

`applyTo` entries can wrap a source skill (translator extracts the body) or inline a `body` string. Wrapping a skill means edits to the skill flow through on next regeneration.

## 6. Translation rules

### 6.1 Skill → Prompt file

| Skill | Prompt |
|---|---|
| `name:` | Filename `<name>.prompt.md` |
| `description:` (dispatcher trigger) | Rewritten to user-facing one-liner; original kept as "When to use" section |
| Body markdown | Preserved |
| `<EXTREMELY-IMPORTANT>`, `<SUBAGENT-STOP>` tags | Stripped (no equivalent runtime) |
| "Use Skill tool to invoke X" preamble | Stripped (no skill runtime) |
| `[[other-skill]]` references | Rewritten to `/other-skill` if ported; replaced with comment + WARN log otherwise |
| (added) `mode:` | `'agent'` for most skills, `'ask'` for read-only thinking skills |
| (added) auto-gen header | Cites source path; warns against hand-editing |

Skills with hard checklists (brainstorming, verification-before-completion) get a leading note: "Copilot doesn't auto-invoke this — when you run `/<name>`, follow every step exactly."

### 6.2 Agent → Chat mode + Prompt (both)

| Agent | Chat mode | Prompt |
|---|---|---|
| `name:` | Filename | Filename |
| `description:` | `description:` | `description:` (rewritten as one-shot framing) |
| `tools: [...]` | `tools: [...]` after tool-name mapping | Same |
| Body (system prompt) | Body verbatim | Body wrapped in "For this single response, act as..." |
| `model:` | `model:` if specified | `model:` if specified |

Both surfaces are useful: chat mode for persistent persona, prompt for one-shot.

**Tool name mapping** in `lib/copilot/tool-map.ts`:

```ts
export const toolMap = {
  Read: 'read_file',
  Write: 'create_file',
  Edit: 'replace_string_in_file',
  Bash: 'run_in_terminal',
  Grep: 'grep_search',
  Glob: 'file_search',
  WebFetch: 'fetch_webpage',
  WebSearch: 'open_simple_browser',
};
```

Unmapped tools (`TaskCreate`, `Skill`, `ScheduleWakeup`, etc.) are dropped with a WARN log.

### 6.3 CLAUDE.md → copilot-instructions.md

Body copied verbatim, with surgical rewrites:
- "invoke `<agent>` agent" → "use `/<agent>` prompt or `@<agent>` chat mode"
- "invoke `<skill>` skill" → "run `/<skill>`"
- Dispatch tables preserved as reference, with annotation header noting auto-trigger is Claude Code only
- Auto-gen header prepended

### 6.4 MCP → `.vscode/mcp.json`

Source shape (Claude):
```json
{ "mcpServers": { "context7": { "command": "npx", "args": [...], "env": {...} } } }
```

Target shape (VS Code):
```json
{ "servers": { "context7": { "type": "stdio", "command": "npx", "args": [...], "env": {...} } } }
```

Differences:
- Top-level key: `mcpServers` → `servers`
- VS Code requires explicit `type: "stdio" | "sse" | "http"` — inferred from presence of `command` vs `url`
- Env vars wrapped as `${input:VAR_NAME}` so VS Code prompts on first use rather than baking secrets
- Only the manifest whitelist survives

### 6.5 `[[skill-ref]]` two-pass resolution

A skill body may reference other skills as `[[writing-plans]]`. When ported to Copilot:
- Pass 1: collect all skill/agent names being ported (`portedNames: Set<string>`)
- Pass 2: each translator rewrites `[[X]]` to `/X` if `X ∈ portedNames`, otherwise replaces with a comment `<!-- originally referenced [X] skill — not ported -->` and emits a WARN

## 7. Data flow

```
manifest → resolve sources → pass 1 (collect ported names) → pass 2 (translate) → diff → write
```

Entry point (`scripts/sync-copilot.ts`, ~80 lines):

```ts
const flags = parseFlags(process.argv);    // --dry-run, --diff, --verbose, --only=<surface>
const sources = scanClaudeSources();       // {skillsIndex, agentsIndex}
const resolved = resolveManifest(config, sources);    // fail loudly on missing entries
const portedNames = collectPortedNames(resolved);

const outputs = [
  ...resolved.skills.map(s => skillToPrompt(s, portedNames)),
  ...resolved.agents.flatMap(a => [agentToChatmode(a), agentToPrompt(a, portedNames)]),
  claudemdToInstructions(config.instructions.projectClaudeMd, portedNames),
  applyToInstructions(config.instructions.applyTo, sources, portedNames),
  mcpToVscode(config.mcp),
];

const userInstructions = claudemdToInstructions(
  config.instructions.globalClaudeMd,
  portedNames,
  { target: 'user' }
);

if (flags.dryRun) printDiff(outputs);
else { writeAll(outputs); writeUserInstructions(userInstructions); }
```

### Operational modes

1. `pnpm sync:copilot` — write all files
2. `pnpm sync:copilot --dry-run` — print summary of what would change, no writes
3. `pnpm sync:copilot --diff` — print unified diff vs current files
4. `pnpm sync:copilot --diff --exit-code` — exit non-zero if any diff exists (CI gate)
5. `pnpm sync:copilot --only=mcp` — regenerate only one surface

### Skill source resolution

1. `~/.claude/skills/<name>/SKILL.md` (personal)
2. `~/.claude/plugins/cache/<marketplace>/<plugin>/<version>/skills/<name>/SKILL.md` — latest version (semver-sorted)

### Failure modes

| Failure | Behavior |
|---|---|
| Manifest references unknown skill/agent | Hard fail with `ERROR: skill 'foo' not found. Available: [...]` |
| Plugin uninstalled but referenced | Same hard-fail path |
| Tool name has no mapping | WARN, drop from output, continue |
| `[[ref]]` to unported skill | WARN, replace with comment, continue |
| MCP server type not inferable | Hard fail |

## 8. Testing strategy

Each translator is a pure function tested with fixtures in `__tests__/copilot/fixtures/`. Fixtures are synthetic — small skill/agent markdown that exercises specific rules. Not copies of real skills (those evolve; fixtures stay stable).

```ts
// __tests__/copilot/skill-to-prompt.test.ts
describe('skillToPrompt', () => {
  it('rewrites [[ref]] to /prompt-name when ref is ported', () => {
    const input = loadFixture('skills/brainstorming.skill.md');
    const result = skillToPrompt(input, new Set(['writing-plans']));
    expect(result).toContain('/writing-plans');
    expect(result).not.toContain('[[writing-plans]]');
  });

  it('strips [[ref]] with WARN when ref is not ported', () => {
    const input = loadFixture('skills/brainstorming.skill.md');
    const result = skillToPrompt(input, new Set());
    expect(result).not.toContain('[[writing-plans]]');
    expect(warnings).toContain(/not ported.*writing-plans/);
  });

  it('strips <SUBAGENT-STOP> blocks', () => { /* ... */ });
  it('preserves auto-gen header', () => { /* ... */ });
  it('emits valid YAML frontmatter for Copilot', () => { /* ... */ });
});
```

A full-pipeline **snapshot test** runs `sync-copilot.ts` against a fixture manifest and snapshots the output tree. Catches integration drift.

## 9. CI integration

Add to `.github/workflows/ci.yml`:

```yaml
- name: Verify Copilot port is in sync
  run: pnpm sync:copilot --diff --exit-code
```

Runs on every PR. If `CLAUDE.md` or the manifest changes without regeneration, CI fails with the diff inline. Forces the regeneration commit into the same PR.

## 10. Edge cases

### Handled

| Case | Behavior |
|---|---|
| Plugin upgraded, skill path changed | `sources.ts` resolves latest version each run |
| Plugin uninstalled, manifest still references it | Hard fail at resolution |
| Skill renamed upstream | Hard fail; manifest entry must update |
| Agent has no `tools:` frontmatter | Emit chat mode with `tools: []` (unrestricted) |
| Skill body has `<SUBAGENT-STOP>` | Stripped |
| Skill body has Bash/Read/Write tool examples | Preserved verbatim — informative even if Copilot maps differently |
| CLAUDE.md dispatch tables | Preserved with annotation header |
| MCP server uses env vars | Rewritten to `${input:VAR}` |
| Global CLAUDE.md changes | Generator emits user-level file + prints paste reminder |

### Explicitly not handled

| Case | Reason |
|---|---|
| Hooks | Copilot has no runtime equivalent. Dropped with README note. |
| Output styles | No equivalent. Active style captured as instructions preamble if needed. |
| Memory system | Conversation-scoped persistence not available in Copilot. Dropped. |
| Skill auto-trigger by description | Fundamentally not portable. `applyTo` per-file rules are partial substitute. |
| MCP servers requiring OAuth | Mirrored, but first invocation in VS Code re-prompts auth. Documented. |
| Slash-command-style skills (`/ralph-loop`) | Dropped if not a true skill. |

## 11. Build sequence (PR plan)

| # | PR | Surface | Verifiable outcome |
|---|---|---|---|
| 1 | **Foundation** | `sources.ts`, `frontmatter.ts`, `tool-map.ts`, manifest types, entrypoint with `--dry-run`, snapshot harness | `pnpm sync:copilot --dry-run` runs end-to-end |
| 2 | **CLAUDE.md + MCP** | `claudemd-to-instructions.ts`, `mcp-to-vscode.ts` | `.github/copilot-instructions.md` + `.vscode/mcp.json` generated and committed |
| 3 | **Skills + agents** | `skill-to-prompt.ts`, `agent-to-chatmode.ts`, `agent-to-prompt.ts`, `[[ref]]` resolver | `.github/prompts/` + `.github/chatmodes/` populated |
| 4 | **`applyTo` + CI gate** | `applyto-to-instructions.ts`, CI workflow step | Per-file rules + CI drift gate |

Each PR ends with a manual smoke test: open VS Code Copilot Chat in the repo, verify the new artifact behaves.

## 12. Gotchas

- **VS Code Copilot frontmatter schemas are evolving.** Lock to a known-working VS Code version in the README; revisit quarterly.
- **`.github/chatmodes/` is VS Code Copilot only.** JetBrains Copilot doesn't recognize chat modes today. Prompts and instructions work in both. README must note this.
- **The auto-gen header isn't enough on its own.** A teammate could still hand-edit a generated file. The CI drift gate is what enforces hygiene.
- **MCP auth state isn't portable.** Re-auth in VS Code on first use is unavoidable.
- **Plugin cache is volatile.** Generator pins to latest version on disk, not a fixed version. A plugin downgrade between syncs can produce different output. Acceptable for personal use.

## 13. Success criteria

Port is successful when, opening this repo in VS Code with Copilot Chat enabled:

1. Copilot uses the project's stack, budgets, and constraints without being told (`.github/copilot-instructions.md` works).
2. `/architect-reviewer`, `/code-reviewer`, `/brainstorming`, `/writing-plans`, `/commit` appear in the `/` palette and behave like their Claude Code counterparts (modulo manual invocation).
3. Editing `components/Foo.tsx` auto-loads React guidance; editing `app/api/ask/route.ts` auto-loads API/Vercel function guidance.
4. `context7`, `chrome-devtools`, `postman`, `vercel` MCP servers are callable from Copilot Chat.
5. Running `pnpm sync:copilot --diff --exit-code` after a manifest edit reliably fails CI until the regeneration is committed.

## 14. Open questions

None. All forks resolved during brainstorming.

## 15. Future work (not part of this spec)

- Cursor / Cody / Zed renderers (add as needed)
- Bidirectional sync
- npm-published version of the generator
- VS Code extension wrapping the generator
- Quarterly review of VS Code Copilot frontmatter schemas
