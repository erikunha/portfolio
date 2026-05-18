# Claude Code → VS Code Copilot harness port — design

**Date:** 2026-05-18
**Status:** Revised after architect-reviewer gate (round 1) — pending second review
**Author:** Erik Cunha (with Claude Code, brainstorming skill)
**Revision notes:** Addresses architect-reviewer findings B1-B9. MCP source heterogeneity, [[ref]] resolution semantics, PR-sequence consistency, platform fallback, success-criteria verifiability, frontmatter schema pinning, CI gate approach all updated.

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
│       ├── frontmatter.ts         # YAML parse/emit with named emitters (§6.7) + COPILOT_TARGET_VERSION const
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

### Generated files (NOT committed, outside repo-tracked output)

```
<VS Code User dir>/
└── copilot-user-instructions.md     # primary destination

erik-portifolio/.copilot-port-output/
└── copilot-user-instructions.md     # fallback destination (gitignored)
```

The VS Code User directory is platform-specific:
- macOS: `~/Library/Application Support/Code/User/`
- Linux: `~/.config/Code/User/`
- Windows: `%APPDATA%\Code\User\`

The generator resolves the path via `process.platform`. If the directory does not exist or is not writable, the generator falls back to writing `./.copilot-port-output/copilot-user-instructions.md` in the repo. **`./.copilot-port-output/` is gitignored from PR-1 onward** and is explicitly excluded from the CI drift gate (§9). This prevents personal global content from ever landing under repo-tracked paths.

Global instructions apply across all repos, so cannot live inside a single repo. The generator writes the file and prints a one-line reminder to paste it into VS Code's user-level Copilot instructions setting (VS Code does not auto-load files from this path yet — manual paste required once).

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

`applyTo` entries can wrap a source skill (translator extracts the body) or inline a `body` string. Wrapping a skill means edits to the skill flow through on next regeneration — **but only for personal skills under `~/.claude/skills/`**. Plugin-provided skills (the majority of manifest entries) are read-only cache artifacts; any "edit" to them is overwritten when the plugin updates. For plugin skills, "flow through" means the latest cached version is used at each regeneration, not that user edits persist.

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

Source files in the harness use **heterogeneous shapes**. The translator must handle all observed variants.

#### 6.4.1 Source-of-truth precedence

For each name in the manifest's `mcp:` whitelist, the resolver scans these source files in order and uses the first match:

1. `~/.claude/.mcp.json` (personal overrides — highest priority)
2. For each plugin enabled in `~/.claude/settings.json` (`enabledPlugins[*] === true`), the file `~/.claude/plugins/cache/<marketplace>/<plugin>/<version>/.mcp.json` where `<version>` is resolved per §7 version rules.
3. If no match: hard-fail with `ERROR: MCP server 'X' not found in personal config or any enabled plugin`.

The translator also normalizes server *naming*: `~/.claude/.mcp.json` may contain a server like `chrome-devtools-real` that is a personal alias for the plugin's `chrome-devtools`. The manifest is the source of truth for VS Code naming — the translator maps the resolved source onto the manifest name.

#### 6.4.2 Source shape variants

Real source shapes observed in the harness (verified empirically):

```json
// Variant A — bare object, no wrapper (e.g., context7)
{ "context7": { "command": "npx", "args": ["-y", "@upstash/context7-mcp"] } }

// Variant B — wrapped, stdio, no env (e.g., chrome-devtools)
{ "mcpServers": { "chrome-devtools": { "command": "npx", "args": ["chrome-devtools-mcp@latest"] } } }

// Variant C — wrapped, stdio, with env and secrets
{ "mcpServers": { "some-server": { "command": "...", "args": [...], "env": { "API_KEY": "${SOME_KEY}" } } } }

// Variant D — wrapped, http transport, secrets in headers (e.g., postman)
{ "mcpServers": { "postman": { "type": "http", "url": "https://mcp.postman.com/mcp",
    "headers": { "Authorization": "Bearer ${POSTMAN_API_KEY}", "X-Source": "..." } } } }

// Variant E — wrapped, http transport, OAuth (no secrets, e.g., vercel)
{ "mcpServers": { "vercel": { "type": "http", "url": "https://mcp.vercel.com", "note": "..." } } }
```

Normalization rules:
- Strip `mcpServers` wrapper if present; treat bare object as equivalent.
- Infer `type`: presence of `url` → `"http"`; presence of `command` → `"stdio"`; both or neither → hard-fail.
- Drop non-VS-Code keys (`note`, `description`, comments) silently.

#### 6.4.3 Secret rewriting

VS Code's `${input:VAR}` mechanism works in **any string value** of the server config (env value, header value, arg value, url). The translator scans all string values recursively and rewrites `${SECRET_NAME}` references to `${input:SECRET_NAME}`. Heuristic for "is this a secret?":
- Inside `env` map: every value matching `^\$\{[A-Z_][A-Z0-9_]*\}$` is rewritten.
- Inside `headers` map: any value containing `Bearer ${X}`, `Token ${X}`, or starting with `${X}` is rewritten by extracting the var name.
- Inside `url`: any `${X}` in the URL is rewritten.
- Inside `args` array: any element matching `^\$\{[A-Z_][A-Z0-9_]*\}$` is rewritten.

The translator emits a corresponding `inputs:` block at the top of `.vscode/mcp.json` listing each unique `${input:X}` variable with `type: "promptString"`, `id: X`, `description: "Value for X"`, and `password: true` for things that look like keys/tokens.

#### 6.4.4 Target shape

```json
{
  "inputs": [
    { "type": "promptString", "id": "POSTMAN_API_KEY", "description": "...", "password": true }
  ],
  "servers": {
    "context7":       { "type": "stdio", "command": "npx", "args": [...] },
    "chrome-devtools":{ "type": "stdio", "command": "npx", "args": [...] },
    "postman":        { "type": "http", "url": "...", "headers": { "Authorization": "Bearer ${input:POSTMAN_API_KEY}" } },
    "vercel":         { "type": "http", "url": "..." }
  }
}
```

#### 6.4.5 Test fixture coverage

`__tests__/copilot/fixtures/mcp/` must include one fixture per variant (A–E) above, plus a "mixed" fixture exercising secret rewriting across env, headers, args, and url simultaneously.

### 6.5 `[[ref]]` two-pass resolution

A skill or agent body may reference other entries as `[[writing-plans]]` or `[[code-reviewer]]`. When ported to Copilot, the invocation surface differs by kind:
- A **skill** is invoked via `/<name>` (prompt file).
- An **agent** is invoked via `@<name>` (chat mode for persistent persona) — though it also gets a `/<name>` prompt version for one-shot.

Resolution algorithm:
- **Pass 1** — collect a typed map `portedNames: Map<string, 'skill' | 'agent'>` over every manifest entry.
- **Pass 2** — each translator rewrites `[[X]]` as follows:
  - If `portedNames.get(X) === 'agent'` → emit `@X` (preferred for persistent context) with `/X` as a parenthetical alternative on first occurrence in a given file.
  - If `portedNames.get(X) === 'skill'` → emit `/X`.
  - If `X` is not in `portedNames` → replace with HTML comment `<!-- originally referenced [X] — not ported -->` and emit a WARN to stdout.

**Prose-level tool references are NOT rewritten.** If an agent body says "uses the Bash tool to run tests", the body is preserved verbatim even when `Bash` is mapped to `run_in_terminal` in the chat mode's `tools:` array. The auto-gen header on the chat mode file documents this divergence: "Frontmatter `tools:` reflects Copilot tool IDs; prose may reference Claude Code tool names."

### 6.6 Name disambiguation for filename collisions

Manifest entries use plugin-prefixed names (`superpowers:brainstorming`, `commit-commands:commit`) where needed. The translator chooses filename based on uniqueness:
- Default: bare name. `superpowers:brainstorming` → `brainstorming.prompt.md`.
- Collision: if two manifest entries resolve to the same bare name, both are emitted with disambiguating prefix: `<plugin>--<name>.prompt.md`. Collision detection runs in Pass 1.

If a collision is detected and the user wants different names, they edit the manifest (e.g., add an explicit `as: 'commit-cmd'` field — schema detail deferred to implementation but reserved in `lib/copilot/types.ts`).

### 6.7 Frontmatter version pinning

VS Code Copilot's prompt-file and chat-mode frontmatter schemas evolve across releases. To localize that volatility:
- All frontmatter emission goes through `lib/copilot/frontmatter.ts` via named emitters: `emitPromptFrontmatter(opts)`, `emitChatmodeFrontmatter(opts)`, `emitInstructionsFrontmatter(opts)`.
- That file exports a single `COPILOT_TARGET_VERSION` constant (initial value: the VS Code Copilot version verified at PR-1 land time, e.g. `"1.95.x"`).
- Translators never emit YAML directly — they call the emitters, which know the target schema. When the schema changes upstream, the emitter and constant change together in a single PR.

## 7. Data flow

```
manifest → resolve sources → pass 1 (collect ported names) → pass 2 (translate) → diff → write
```

Entry point (`scripts/sync-copilot.ts`, ~80 lines):

```ts
const flags = parseFlags(process.argv);    // --dry-run, --diff, --verbose, --only=<surface>
const sources = scanClaudeSources();       // {skillsIndex, agentsIndex, mcpIndex}
const resolved = resolveManifest(config, sources);    // fail loudly on missing entries
const portedNames: Map<string, 'skill' | 'agent'> = collectPortedNames(resolved);  // §6.5

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
3. `pnpm sync:copilot --diff` — print unified diff vs current files (informational only)
4. `pnpm sync:copilot --only=mcp` — regenerate only one surface (skills/agents/instructions/mcp)
5. `pnpm sync:copilot --verbose` — emit WARN/INFO logs for all rewrites

The CI drift detection is a **separate, cache-independent** check (`scripts/check-copilot-drift.ts`, §9.2), not a generator flag.

### Skill source resolution

1. `~/.claude/skills/<name>/SKILL.md` (personal — highest priority)
2. `~/.claude/plugins/cache/<marketplace>/<plugin>/<version>/skills/<name>/SKILL.md` — version chosen per §7.1 rules below.

### 7.1 Plugin version resolution

The plugin cache directory contains version names that vary by source: parseable semver (`5.1.0`, `1.0.0`), git SHA prefixes (`1a2f18b05cf5`, `416e40da03a2`), literal `unknown`, and any future patterns added by the harness.

Resolution rules, in order:
1. **Parseable semver wins.** Among all version dirs whose name parses as semver (`semver.valid()` returns non-null), pick the highest.
2. **No parseable semver → newest mtime wins.** Among the remaining (non-semver-named) dirs, pick the one whose directory `mtime` is most recent. This handles SHA-named dirs and git mirrors deterministically.
3. **All dirs unparseable AND identical mtime → alphabetical tiebreak**, with `unknown` always sorted last.
4. **No dirs at all → hard-fail** with `ERROR: plugin '<name>' is enabled in settings.json but no version dirs exist in cache`.

This rule applies to both skill source resolution AND MCP source resolution (§6.4.1 step 2).

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

**Problem:** The generator reads from `~/.claude/` (personal cache, plugin installs). That filesystem doesn't exist in CI runners. The generator literally cannot run there.

**Solution: two-layer drift defense, neither of which needs the cache in CI.**

### 9.1 Pre-commit hook (local)

Add to `.husky/pre-commit`:

```sh
# If any generator input changed, regenerate before commit
if git diff --cached --name-only | grep -qE '^(CLAUDE\.md|scripts/copilot-port\.config\.ts)$'; then
  pnpm sync:copilot
  git add .github/copilot-instructions.md .github/prompts .github/chatmodes .github/instructions .vscode/mcp.json
fi
```

This runs **on the dev machine** where `~/.claude/` exists. Catches drift at commit time. Updates the staged commit to include regenerated outputs.

### 9.2 CI manifest-change gate (remote)

CI doesn't regenerate — it enforces a weaker, cache-independent invariant: **if the manifest or project CLAUDE.md was modified, at least one generated artifact must also be modified in the same commit range.**

Add to `.github/workflows/ci.yml`:

```yaml
- name: Verify Copilot port artifacts updated with source
  run: pnpm tsx scripts/check-copilot-drift.ts ${{ github.event.pull_request.base.sha }}..HEAD
```

`scripts/check-copilot-drift.ts` is a small ~30-line script that uses `git diff --name-only <range>` and asserts:
- If `CLAUDE.md` or `scripts/copilot-port.config.ts` is in the diff, then at least one of `.github/copilot-instructions.md`, `.github/prompts/**`, `.github/chatmodes/**`, `.github/instructions/**`, `.vscode/mcp.json` must also be in the diff. Otherwise fail with a message pointing to `pnpm sync:copilot`.

This is **not perfect** — a developer who manually edits a generated file matching the rule can spoof it. The pre-commit hook is the strong gate; the CI gate is the catch-net for missing the hook (or working on a different machine).

### 9.3 Out of scope for drift detection

- Drift caused by upstream skill content changes (e.g., `superpowers` plugin upgrade changes `brainstorming.md`) without a corresponding manifest or CLAUDE.md edit is **not caught**. Mitigated by running `pnpm sync:copilot` periodically on the dev machine; documented in README as part of plugin-update hygiene.
- The `.copilot-port-output/` directory is gitignored and excluded from CI diff checks.

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

Re-cut so each PR ends with a real, user-visible artifact — no PR ships scaffolding without a working translator.

| # | PR | Deliverable surface | Verifiable outcome |
|---|---|---|---|
| 1 | **Foundation + CLAUDE.md translator** | `sources.ts`, `frontmatter.ts` (with `COPILOT_TARGET_VERSION` constant + named emitters), `types.ts`, manifest scaffold, `claudemd-to-instructions.ts`, snapshot harness, `.copilot-port-output/` added to `.gitignore`, pre-commit hook stub | `pnpm sync:copilot` writes `.github/copilot-instructions.md` end-to-end. Copilot Chat in VS Code surfaces the project context. Smoke test: open repo in VS Code, verify Copilot knows the budgets. |
| 2 | **MCP translator** | `mcp-to-vscode.ts` with all 5 source-shape variants (§6.4.2), secret rewriting (§6.4.3), plugin-version resolver (§7.1), fixtures per variant | `.vscode/mcp.json` written. Smoke test: invoke each whitelisted MCP server from Copilot Chat; auth flows complete; servers respond. |
| 3 | **Skills + agents** | `skill-to-prompt.ts`, `agent-to-chatmode.ts`, `agent-to-prompt.ts`, `refs.ts` (two-pass `[[ref]]` resolver with skill/agent kind awareness), `tool-map.ts`, name-collision detection | `.github/prompts/` + `.github/chatmodes/` populated. Smoke test: `/` palette lists each manifest entry; invoking `/code-reviewer` produces the expected agent behavior; `@architect-reviewer` chat mode loads. |
| 4 | **applyTo + drift gates** | `applyto-to-instructions.ts`, pre-commit hook activation, `scripts/check-copilot-drift.ts`, CI workflow step | Per-file rules load on editing `components/**`, `app/api/**`, `__tests__/**`. Smoke test: open `components/Hero.tsx` in VS Code, ask Copilot for refactor — React guidance is automatically applied. CI gate fails a synthetic test PR that edits CLAUDE.md without regenerating. |

Each PR ends with the smoke test for **its** deliverable. The author runs the smoke test manually before merging.

### 11.1 Why this re-cut

The prior sequence had PR-1 shipping foundation alone with the verifiable outcome "`--dry-run` runs end-to-end." That was incoherent because the entrypoint references translators that didn't exist yet. The new PR-1 ships the simplest translator (`claudemd-to-instructions`) alongside the foundation so the verifiable outcome is real: a working `.github/copilot-instructions.md`.

## 12. Gotchas

- **VS Code Copilot frontmatter schemas are evolving.** Isolated via `lib/copilot/frontmatter.ts` named emitters and the `COPILOT_TARGET_VERSION` constant (§6.7). When schema changes upstream, one file changes; revisit quarterly.
- **`.github/chatmodes/` is VS Code Copilot only.** JetBrains Copilot doesn't recognize chat modes today. Prompts and instructions work in both. README must note this.
- **The auto-gen header isn't enough on its own.** A teammate could still hand-edit a generated file. The pre-commit hook (§9.1) is the strong gate; the CI manifest-change check (§9.2) is the catch-net; missing the header altogether triggers CI criterion #8 (§13.2).
- **MCP auth state isn't portable.** Re-auth in VS Code on first use is unavoidable. Documented in README.
- **Plugin cache is volatile.** Resolved per §7.1: parseable semver first, then mtime tiebreak. Plugin downgrades between syncs can change output; mitigated by the pre-commit hook regenerating on relevant source changes.
- **Generator cannot run in CI.** CI has no `~/.claude/` cache (§9). Drift defense relies on local pre-commit + a static manifest-change gate. Documented as a known limitation.
- **Personal `~/.claude/.mcp.json` may use server names that differ from manifest names** (e.g., `chrome-devtools-real` vs manifest `chrome-devtools`). The manifest is the source of truth; the resolver matches by intent, not by literal name (§6.4.1).

## 13. Success criteria

Criteria split by who verifies them.

### 13.1 Author smoke tests (manual, run at PR review)

These depend on Copilot Chat model behavior and cannot be CI-gated. The PR author runs each in VS Code before requesting merge; failure blocks the PR.

| # | Criterion | How to verify |
|---|---|---|
| 1 | Project context loads | Open repo in VS Code. In a fresh Copilot Chat session, ask "What's the perf budget for LCP on this site?" Response references the table in `.github/copilot-instructions.md` (file is ≤ 200 lines and contains the budget table verbatim). |
| 2 | Prompts appear in `/` palette | Type `/` in Copilot Chat input. Every manifest entry (skills + agents) appears. File content matches the snapshot fixture in `__tests__/copilot/__snapshots__/`. |
| 3 | applyTo rules fire | Open `components/Hero.tsx` and ask Copilot to refactor — Copilot's response shows it loaded `react.instructions.md` (e.g., references `'use client'` discipline, RSC defaults). Repeat for `app/api/ask/route.ts` (loads `api-routes.instructions.md`). |
| 4 | MCP servers reachable | In Copilot Chat with each MCP enabled in turn, ask for a known-good operation (e.g., context7: "fetch React 19 docs"; postman: "list my collections"). Servers respond; auth flows complete on first use. |

### 13.2 CI-gated (automated, runs on every PR)

| # | Criterion | Where verified |
|---|---|---|
| 5 | Translator unit tests pass | `pnpm test` runs all `__tests__/copilot/*.test.ts` |
| 6 | Snapshot integrity | `pnpm test` includes the full-pipeline snapshot test from §8 |
| 7 | Manifest-change drift gate | `scripts/check-copilot-drift.ts` (§9.2) fires on PRs that change `CLAUDE.md` or `scripts/copilot-port.config.ts` without updating generated files |
| 8 | Generated files committed | A separate CI check fails if any generated file lacks the auto-gen header (catches hand-edits that wipe the marker) |

### 13.3 Out of criteria scope

- "Copilot behaves identically to Claude Code." Out of scope — no skill auto-trigger, no subagent isolation, by design (§3).
- "Generator runs in CI." Out of scope — CI has no `~/.claude/` cache (§9).
- "Skill upgrades propagate without manual regen." Acknowledged limitation; mitigation is the periodic `pnpm sync:copilot` discipline noted in §9.3.

## 14. Open questions

None. All forks resolved during brainstorming.

## 15. Future work (not part of this spec)

- Cursor / Cody / Zed renderers (add as needed)
- Bidirectional sync
- npm-published version of the generator
- VS Code extension wrapping the generator
- Quarterly review of VS Code Copilot frontmatter schemas
