# Claude Code → VS Code Copilot Harness Port Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a re-runnable TypeScript generator that translates the Claude Code harness in `~/.claude/` (skills, agents, CLAUDE.md, MCP servers) into VS Code Copilot Chat configuration files (`.github/copilot-instructions.md`, `.github/prompts/`, `.github/chatmodes/`, `.github/instructions/`, `.vscode/mcp.json`), so the same authoring discipline works across both tools.

**Architecture:** Modular TypeScript with per-surface translator modules. A curated manifest (`scripts/copilot-port.config.ts`) drives generation; six translators (`claudemd-to-instructions`, `mcp-to-vscode`, `skill-to-prompt`, `agent-to-chatmode`, `agent-to-prompt`, `applyto-to-instructions`) emit files via a shared `frontmatter.ts` with version pinning and a shared `refs.ts` two-pass resolver. Defense in depth: local pre-commit hook regenerates when source changes; a separate cache-independent CI script verifies that PRs touching source also commit generated artifacts.

**Tech Stack:** TypeScript (strict), tsx (already installed), gray-matter (frontmatter parse/emit), semver (plugin version resolution), Vitest (testing), pnpm. All new deps are dev-only.

**Spec:** `docs/superpowers/specs/2026-05-18-claude-to-copilot-port-design.md`

---

## Scope check

The plan covers 4 PRs sharing infrastructure (`sources.ts`, `frontmatter.ts`, `types.ts`). This is correctly one plan because each PR's translator depends on the shared foundation built in PR-1. Each PR independently produces a working artifact testable in VS Code.

## File structure

### Source files (hand-edited)
```
scripts/
├── sync-copilot.ts                 # entrypoint, ~120 lines, calls translators
├── copilot-port.config.ts          # curated manifest (the one file you edit)
├── check-copilot-drift.ts          # CI drift gate (PR-4)
└── lib/copilot/
    ├── types.ts                    # CopilotPortConfig, Skill, Agent, McpServer types
    ├── sources.ts                  # scan ~/.claude/, resolve plugin versions
    ├── frontmatter.ts              # COPILOT_TARGET_VERSION + named emitters
    ├── tool-map.ts                 # Claude tool names → Copilot tool IDs
    ├── refs.ts                     # two-pass [[ref]] resolver
    ├── auto-gen-header.ts          # shared auto-gen header builder
    └── translators/
        ├── claudemd-to-instructions.ts
        ├── mcp-to-vscode.ts
        ├── skill-to-prompt.ts
        ├── agent-to-chatmode.ts
        ├── agent-to-prompt.ts
        └── applyto-to-instructions.ts
```

### Tests (one per translator + shared helpers + snapshot)
```
__tests__/copilot/
├── fixtures/
│   ├── claudemd/
│   ├── mcp/                        # one fixture per variant A-E + mixed
│   ├── skills/
│   ├── agents/
│   ├── sources/                    # fake claude-home for sources.ts tests
│   └── manifest.ts                 # test manifest used by snapshot
├── auto-gen-header.test.ts
├── sources.test.ts
├── frontmatter.test.ts
├── refs.test.ts
├── tool-map.test.ts
├── claudemd-to-instructions.test.ts
├── mcp-to-vscode.test.ts
├── skill-to-prompt.test.ts
├── agent-to-chatmode.test.ts
├── agent-to-prompt.test.ts
├── applyto-to-instructions.test.ts
├── check-drift.test.ts
└── snapshot.test.ts                # full-pipeline snapshot
```

### Generated (committed, auto-gen header)
```
.github/
├── copilot-instructions.md
├── prompts/<name>.prompt.md         (one per skill + one per agent)
├── chatmodes/<name>.chatmode.md     (one per agent)
└── instructions/<name>.instructions.md  (one per applyTo entry)
.vscode/mcp.json
```

### Generated (gitignored)
```
.copilot-port-output/copilot-user-instructions.md  (fallback only)
```

### Modified
```
package.json                    # add scripts:copilot, deps
.gitignore                      # add .copilot-port-output/
.husky/pre-commit               # add regen-on-source-change block (PR-4)
.github/workflows/ci.yml        # add drift check step (PR-4)
```

**Commit style:** Per project memory, scope = feature area not technical category. All commits use `feat(copilot-port): <description>` for source code, `test(copilot-port): <description>` for test-only commits, `chore(copilot-port): <description>` for config/deps, `ci(copilot-port): <description>` for CI workflow changes, and `docs(copilot-port): <description>` for docs.

---

## PR-1 — Foundation + CLAUDE.md translator

PR-1 ships the shared infrastructure (`sources.ts`, `frontmatter.ts`, `types.ts`, `auto-gen-header.ts`), the first translator (`claudemd-to-instructions.ts`), the entrypoint wired only to that translator, the manifest scaffold, the snapshot harness, and the gitignore entry. Verifiable outcome: `pnpm sync:copilot` writes a working `.github/copilot-instructions.md`.

### Task 1: Install dependencies and add npm script

**Files:**
- Modify: `package.json`
- Modify: `.gitignore`

- [ ] **Step 1: Install gray-matter and semver as dev dependencies**

Run:
```bash
pnpm add -D gray-matter semver @types/semver
```

Expected: lockfile updates; no peer-dep warnings.

- [ ] **Step 2: Add the `sync:copilot` script to package.json**

In `package.json`, in the `"scripts"` section, add after the existing `"test"` line:

```json
"sync:copilot": "tsx scripts/sync-copilot.ts",
```

- [ ] **Step 3: Add `.copilot-port-output/` to .gitignore**

Append to `.gitignore`:

```
# Copilot port — fallback output dir for non-darwin platforms (gitignored per spec §4)
.copilot-port-output/
```

- [ ] **Step 4: Commit**

```bash
git add package.json pnpm-lock.yaml .gitignore
git commit -m "chore(copilot-port): add gray-matter, semver, sync:copilot script"
```

### Task 2: Create types.ts with all shared interfaces

**Files:**
- Create: `scripts/lib/copilot/types.ts`

- [ ] **Step 1: Write the types**

Create `scripts/lib/copilot/types.ts`:

```ts
// Manifest types (what the user edits in copilot-port.config.ts)

export type ApplyToEntry = {
  name: string;
  applyTo: string;
  /** Pull body from a skill (mutually exclusive with `body`) */
  sourceSkill?: string;
  /** Inline body (mutually exclusive with `sourceSkill`) */
  body?: string;
};

export type CopilotPortConfig = {
  instructions: {
    projectClaudeMd: string;     // repo-relative path
    globalClaudeMd: string;      // absolute path (may include ~)
    applyTo: ApplyToEntry[];
  };
  skills: string[];              // bare or plugin-prefixed names
  agents: string[];              // agent names from ~/.claude/agents/
  mcp: string[];                 // MCP server names to whitelist
};

// Source types (what sources.ts produces by scanning ~/.claude/)

export type SourceKind = 'skill' | 'agent';

export type SkillSource = {
  kind: 'skill';
  name: string;                  // bare name (e.g., 'brainstorming')
  qualifiedName: string;         // with plugin prefix (e.g., 'superpowers:brainstorming')
  path: string;                  // absolute path to SKILL.md or skill markdown
  frontmatter: Record<string, unknown>;
  body: string;
  origin: 'personal' | 'plugin';
  plugin?: string;               // plugin name if origin === 'plugin'
};

export type AgentSource = {
  kind: 'agent';
  name: string;
  path: string;
  frontmatter: Record<string, unknown>;
  body: string;
};

export type McpServerSource = {
  name: string;                  // server name as it appears in source file
  path: string;                  // absolute path to .mcp.json
  config: Record<string, unknown>; // the server's config object
  origin: 'personal' | 'plugin';
  plugin?: string;
};

export type SourceIndex = {
  skills: Map<string, SkillSource>;       // keyed by bare name
  agents: Map<string, AgentSource>;
  mcpServers: Map<string, McpServerSource>;
};

// Output types (what translators produce)

export type TranslatorOutput = {
  path: string;                  // repo-relative output path
  content: string;
};

// Pass 1 / Pass 2 reference resolution
export type PortedNames = Map<string, SourceKind>;
```

- [ ] **Step 2: Verify types compile**

Run:
```bash
pnpm typecheck
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add scripts/lib/copilot/types.ts
git commit -m "feat(copilot-port): add shared types for manifest, sources, outputs"
```

### Task 3: Create auto-gen-header helper

**Files:**
- Create: `scripts/lib/copilot/auto-gen-header.ts`
- Create: `__tests__/copilot/auto-gen-header.test.ts`

- [ ] **Step 1: Write the failing test**

Create `__tests__/copilot/auto-gen-header.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { autoGenHeader, hasAutoGenHeader } from '@/scripts/lib/copilot/auto-gen-header';

describe('autoGenHeader', () => {
  it('contains the AUTO-GENERATED marker', () => {
    const h = autoGenHeader('CLAUDE.md');
    expect(h).toContain('AUTO-GENERATED');
  });

  it('cites the source file path', () => {
    const h = autoGenHeader('CLAUDE.md');
    expect(h).toContain('CLAUDE.md');
  });

  it('warns against manual edits', () => {
    const h = autoGenHeader('x.md');
    expect(h.toLowerCase()).toContain('do not edit');
  });
});

describe('hasAutoGenHeader', () => {
  it('returns true when content begins with marker', () => {
    const content = autoGenHeader('a.md') + '\n\nbody';
    expect(hasAutoGenHeader(content)).toBe(true);
  });

  it('returns false when content lacks marker', () => {
    expect(hasAutoGenHeader('# just a doc\n')).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:
```bash
pnpm test __tests__/copilot/auto-gen-header.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

Create `scripts/lib/copilot/auto-gen-header.ts`:

```ts
const MARKER = 'AUTO-GENERATED by scripts/sync-copilot.ts';

export function autoGenHeader(sourcePath: string): string {
  return [
    `<!-- ${MARKER} — do not edit by hand.`,
    `     Source: ${sourcePath}`,
    `     Regenerate with: pnpm sync:copilot -->`,
  ].join('\n');
}

export function hasAutoGenHeader(content: string): boolean {
  return content.trimStart().startsWith(`<!-- ${MARKER}`);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run:
```bash
pnpm test __tests__/copilot/auto-gen-header.test.ts
```

Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/copilot/auto-gen-header.ts __tests__/copilot/auto-gen-header.test.ts
git commit -m "feat(copilot-port): add auto-gen header helper"
```

### Task 4: Implement frontmatter.ts with named emitters and version pin

**Files:**
- Create: `scripts/lib/copilot/frontmatter.ts`
- Create: `__tests__/copilot/frontmatter.test.ts`

Per spec §6.7: a single `COPILOT_TARGET_VERSION` constant and per-surface emitters localize VS Code Copilot schema volatility.

- [ ] **Step 1: Write the failing test**

Create `__tests__/copilot/frontmatter.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  COPILOT_TARGET_VERSION,
  emitChatmodeFrontmatter,
  emitInstructionsFrontmatter,
  emitPromptFrontmatter,
  parseFrontmatter,
} from '@/scripts/lib/copilot/frontmatter';

describe('COPILOT_TARGET_VERSION', () => {
  it('is a non-empty string', () => {
    expect(typeof COPILOT_TARGET_VERSION).toBe('string');
    expect(COPILOT_TARGET_VERSION.length).toBeGreaterThan(0);
  });
});

describe('parseFrontmatter', () => {
  it('returns empty frontmatter for body-only content', () => {
    const { data, content } = parseFrontmatter('# Hello\n');
    expect(data).toEqual({});
    expect(content).toBe('# Hello\n');
  });

  it('parses YAML frontmatter and body separately', () => {
    const src = `---\nname: x\ndescription: y\n---\n# Body\n`;
    const { data, content } = parseFrontmatter(src);
    expect(data).toEqual({ name: 'x', description: 'y' });
    expect(content.trim()).toBe('# Body');
  });
});

describe('emitPromptFrontmatter', () => {
  it('emits mode and description in YAML block', () => {
    const out = emitPromptFrontmatter({ mode: 'agent', description: 'Test' });
    expect(out).toMatch(/^---\n/);
    expect(out).toContain('mode: agent');
    expect(out).toContain('description: Test');
    expect(out.trimEnd().endsWith('---')).toBe(true);
  });

  it('emits tools array when provided', () => {
    const out = emitPromptFrontmatter({ mode: 'agent', description: 'x', tools: ['read_file', 'grep_search'] });
    expect(out).toContain('tools:');
    expect(out).toContain('read_file');
    expect(out).toContain('grep_search');
  });
});

describe('emitChatmodeFrontmatter', () => {
  it('emits description and tools for chat mode', () => {
    const out = emitChatmodeFrontmatter({ description: 'persona', tools: ['read_file'] });
    expect(out).toContain('description: persona');
    expect(out).toContain('read_file');
  });
});

describe('emitInstructionsFrontmatter', () => {
  it('emits applyTo glob', () => {
    const out = emitInstructionsFrontmatter({ applyTo: 'components/**' });
    expect(out).toContain("applyTo: 'components/**'");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:
```bash
pnpm test __tests__/copilot/frontmatter.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

Create `scripts/lib/copilot/frontmatter.ts`:

```ts
import matter from 'gray-matter';

/**
 * VS Code Copilot frontmatter target version. Bump when the upstream schema
 * changes; emitters are pinned to this version.
 */
export const COPILOT_TARGET_VERSION = '1.95.x';

export type PromptFrontmatter = {
  mode: 'agent' | 'ask' | 'edit';
  description: string;
  tools?: string[];
  model?: string;
};

export type ChatmodeFrontmatter = {
  description: string;
  tools?: string[];
  model?: string;
};

export type InstructionsFrontmatter = {
  applyTo: string;
};

export function parseFrontmatter(source: string): { data: Record<string, unknown>; content: string } {
  const parsed = matter(source);
  return { data: parsed.data, content: parsed.content };
}

function needsQuoting(s: string): boolean {
  return /[:#&*!|>'"%@`{}\[\]]|^[-?]|^\s|\s$/.test(s);
}

function emitYamlBlock(data: Record<string, unknown>): string {
  const lines: string[] = ['---'];
  for (const [key, value] of Object.entries(data)) {
    if (value === undefined || value === null) continue;
    if (Array.isArray(value)) {
      lines.push(`${key}:`);
      for (const item of value) {
        lines.push(`  - ${typeof item === 'string' ? item : JSON.stringify(item)}`);
      }
    } else if (typeof value === 'string') {
      lines.push(`${key}: ${needsQuoting(value) ? `'${value.replace(/'/g, "''")}'` : value}`);
    } else {
      lines.push(`${key}: ${JSON.stringify(value)}`);
    }
  }
  lines.push('---');
  return lines.join('\n');
}

export function emitPromptFrontmatter(fm: PromptFrontmatter): string {
  return emitYamlBlock({ ...fm });
}

export function emitChatmodeFrontmatter(fm: ChatmodeFrontmatter): string {
  return emitYamlBlock({ ...fm });
}

export function emitInstructionsFrontmatter(fm: InstructionsFrontmatter): string {
  return emitYamlBlock({ applyTo: fm.applyTo });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run:
```bash
pnpm test __tests__/copilot/frontmatter.test.ts
```

Expected: PASS (all tests).

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/copilot/frontmatter.ts __tests__/copilot/frontmatter.test.ts
git commit -m "feat(copilot-port): add frontmatter emitters with COPILOT_TARGET_VERSION pin"
```

### Task 5: Implement sources.ts with plugin version resolution

**Files:**
- Create: `scripts/lib/copilot/sources.ts`
- Create: `__tests__/copilot/sources.test.ts`
- Create: `__tests__/copilot/fixtures/sources/` (fixture filesystem)

Per spec §7.1: parseable semver wins → mtime tiebreak → alphabetical → hard fail.

- [ ] **Step 1: Build the fixture filesystem**

Create the fixture tree:

```bash
mkdir -p __tests__/copilot/fixtures/sources/claude-home/skills/personal-skill
mkdir -p __tests__/copilot/fixtures/sources/claude-home/agents
mkdir -p __tests__/copilot/fixtures/sources/claude-home/plugins/cache/marketplaceA/pluginX/5.1.0/skills/plugin-skill
mkdir -p __tests__/copilot/fixtures/sources/claude-home/plugins/cache/marketplaceA/pluginX/4.2.0/skills/plugin-skill
mkdir -p __tests__/copilot/fixtures/sources/claude-home/plugins/cache/marketplaceA/pluginX/unknown/skills/plugin-skill
mkdir -p __tests__/copilot/fixtures/sources/claude-home/plugins/cache/marketplaceA/pluginY/1a2f18b05cf5
mkdir -p __tests__/copilot/fixtures/sources/claude-home/plugins/cache/marketplaceA/pluginY/416e40da03a2
```

Create `__tests__/copilot/fixtures/sources/claude-home/skills/personal-skill/SKILL.md`:
```md
---
name: personal-skill
description: A personal skill fixture
---
Body of personal skill.
```

Create `__tests__/copilot/fixtures/sources/claude-home/agents/agent-a.md`:
```md
---
name: agent-a
description: An agent fixture
tools: [Read, Write, Edit]
---
You are agent A.
```

Create `__tests__/copilot/fixtures/sources/claude-home/plugins/cache/marketplaceA/pluginX/5.1.0/skills/plugin-skill/SKILL.md`:
```md
---
name: plugin-skill
description: From version 5.1.0
---
Plugin skill at v5.1.0.
```

Create `__tests__/copilot/fixtures/sources/claude-home/plugins/cache/marketplaceA/pluginX/4.2.0/skills/plugin-skill/SKILL.md`:
```md
---
name: plugin-skill
description: From version 4.2.0
---
Plugin skill at v4.2.0.
```

Create `__tests__/copilot/fixtures/sources/claude-home/plugins/cache/marketplaceA/pluginX/unknown/skills/plugin-skill/SKILL.md`:
```md
---
name: plugin-skill
description: Unknown version
---
Should not be picked over semver.
```

Create `__tests__/copilot/fixtures/sources/claude-home/settings.json`:
```json
{
  "enabledPlugins": {
    "pluginX@marketplaceA": true,
    "pluginY@marketplaceA": true
  }
}
```

- [ ] **Step 2: Write the failing test**

Create `__tests__/copilot/sources.test.ts`:

```ts
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { resolvePluginVersion, scanClaudeSources } from '@/scripts/lib/copilot/sources';

const FIXTURE_HOME = path.resolve(__dirname, 'fixtures/sources/claude-home');

describe('resolvePluginVersion', () => {
  it('picks the highest parseable semver among version dirs', () => {
    const pluginDir = path.join(FIXTURE_HOME, 'plugins/cache/marketplaceA/pluginX');
    const resolved = resolvePluginVersion(pluginDir);
    expect(resolved).toBe('5.1.0');
  });

  it('falls back to mtime when no semver dirs exist', () => {
    const pluginDir = path.join(FIXTURE_HOME, 'plugins/cache/marketplaceA/pluginY');
    const resolved = resolvePluginVersion(pluginDir);
    expect(['1a2f18b05cf5', '416e40da03a2']).toContain(resolved);
  });

  it('throws when no version dirs exist', () => {
    const pluginDir = path.join(FIXTURE_HOME, 'plugins/cache/marketplaceA/nonexistent');
    expect(() => resolvePluginVersion(pluginDir)).toThrow(/no version dirs/);
  });
});

describe('scanClaudeSources', () => {
  it('indexes personal skills', () => {
    const idx = scanClaudeSources(FIXTURE_HOME);
    expect(idx.skills.has('personal-skill')).toBe(true);
    const s = idx.skills.get('personal-skill')!;
    expect(s.origin).toBe('personal');
    expect(s.frontmatter.description).toBe('A personal skill fixture');
  });

  it('indexes plugin skills from highest semver version', () => {
    const idx = scanClaudeSources(FIXTURE_HOME);
    expect(idx.skills.has('plugin-skill')).toBe(true);
    const s = idx.skills.get('plugin-skill')!;
    expect(s.origin).toBe('plugin');
    expect(s.plugin).toBe('pluginX');
    expect(s.frontmatter.description).toBe('From version 5.1.0');
  });

  it('indexes agents from personal agents dir', () => {
    const idx = scanClaudeSources(FIXTURE_HOME);
    expect(idx.agents.has('agent-a')).toBe(true);
    const a = idx.agents.get('agent-a')!;
    expect(a.frontmatter.name).toBe('agent-a');
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

```bash
pnpm test __tests__/copilot/sources.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 4: Write the implementation**

Create `scripts/lib/copilot/sources.ts`:

```ts
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import semver from 'semver';
import { parseFrontmatter } from './frontmatter';
import type {
  AgentSource,
  McpServerSource,
  SkillSource,
  SourceIndex,
} from './types';

/**
 * Resolve which version directory of a plugin to use.
 * Per spec §7.1:
 *   1. Parseable semver wins (highest)
 *   2. No semver → newest mtime
 *   3. All identical mtime → alphabetical, 'unknown' last
 *   4. No dirs → throw
 */
export function resolvePluginVersion(pluginDir: string): string {
  let entries: string[];
  try {
    entries = readdirSync(pluginDir).filter((e) => {
      try {
        return statSync(path.join(pluginDir, e)).isDirectory();
      } catch {
        return false;
      }
    });
  } catch {
    throw new Error(`no version dirs in ${pluginDir}`);
  }
  if (entries.length === 0) {
    throw new Error(`no version dirs in ${pluginDir}`);
  }

  const semverDirs = entries.filter((e) => semver.valid(e));
  if (semverDirs.length > 0) {
    return semverDirs.sort(semver.rcompare)[0];
  }

  const byMtime = entries
    .map((e) => ({ name: e, mtime: statSync(path.join(pluginDir, e)).mtimeMs }))
    .sort((a, b) => {
      if (b.mtime !== a.mtime) return b.mtime - a.mtime;
      if (a.name === 'unknown') return 1;
      if (b.name === 'unknown') return -1;
      return a.name.localeCompare(b.name);
    });
  return byMtime[0].name;
}

function loadMarkdownFile(filePath: string): { data: Record<string, unknown>; body: string } {
  const raw = readFileSync(filePath, 'utf8');
  const { data, content } = parseFrontmatter(raw);
  return { data, body: content };
}

function scanSkillsDir(skillsDir: string, origin: 'personal' | 'plugin', plugin?: string): SkillSource[] {
  let entries: string[];
  try {
    entries = readdirSync(skillsDir);
  } catch {
    return [];
  }
  const out: SkillSource[] = [];
  for (const entry of entries) {
    const entryPath = path.join(skillsDir, entry);
    let stat;
    try {
      stat = statSync(entryPath);
    } catch {
      continue;
    }
    if (stat.isDirectory()) {
      const skillFile = path.join(entryPath, 'SKILL.md');
      try {
        const { data, body } = loadMarkdownFile(skillFile);
        const name = (data.name as string) || entry;
        out.push({
          kind: 'skill',
          name,
          qualifiedName: plugin ? `${plugin}:${name}` : name,
          path: skillFile,
          frontmatter: data,
          body,
          origin,
          plugin,
        });
      } catch {
        // No SKILL.md in this dir — skip.
      }
    } else if (entry.endsWith('.md')) {
      const name = entry.replace(/\.md$/, '');
      try {
        const { data, body } = loadMarkdownFile(entryPath);
        const skillName = (data.name as string) || name;
        out.push({
          kind: 'skill',
          name: skillName,
          qualifiedName: plugin ? `${plugin}:${skillName}` : skillName,
          path: entryPath,
          frontmatter: data,
          body,
          origin,
          plugin,
        });
      } catch {
        // skip
      }
    }
  }
  return out;
}

function scanAgentsDir(agentsDir: string): AgentSource[] {
  let entries: string[];
  try {
    entries = readdirSync(agentsDir);
  } catch {
    return [];
  }
  const out: AgentSource[] = [];
  for (const entry of entries) {
    if (!entry.endsWith('.md')) continue;
    const filePath = path.join(agentsDir, entry);
    const { data, body } = loadMarkdownFile(filePath);
    const name = (data.name as string) || entry.replace(/\.md$/, '');
    out.push({
      kind: 'agent',
      name,
      path: filePath,
      frontmatter: data,
      body,
    });
  }
  return out;
}

function scanMcpJsonFile(filePath: string, origin: 'personal' | 'plugin', plugin?: string): McpServerSource[] {
  let raw: string;
  try {
    raw = readFileSync(filePath, 'utf8');
  } catch {
    return [];
  }
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  // Per spec §6.4.2, accept both wrapped {"mcpServers": {...}} and bare {"name": {...}} shapes
  const servers = (parsed.mcpServers as Record<string, unknown>) ?? parsed;
  const out: McpServerSource[] = [];
  for (const [name, config] of Object.entries(servers)) {
    if (typeof config !== 'object' || config === null) continue;
    out.push({
      name,
      path: filePath,
      config: config as Record<string, unknown>,
      origin,
      plugin,
    });
  }
  return out;
}

function getEnabledPlugins(settingsPath: string): Array<{ plugin: string; marketplace: string }> {
  let raw: string;
  try {
    raw = readFileSync(settingsPath, 'utf8');
  } catch {
    return [];
  }
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  const enabled = (parsed.enabledPlugins as Record<string, boolean>) ?? {};
  return Object.entries(enabled)
    .filter(([, v]) => v === true)
    .map(([key]) => {
      const [plugin, marketplace] = key.split('@');
      return { plugin, marketplace };
    });
}

export function scanClaudeSources(
  claudeHome: string = path.join(process.env.HOME ?? '', '.claude'),
): SourceIndex {
  const skills = new Map<string, SkillSource>();
  const agents = new Map<string, AgentSource>();
  const mcpServers = new Map<string, McpServerSource>();

  // Personal skills (highest priority — added first, never overwritten below)
  for (const s of scanSkillsDir(path.join(claudeHome, 'skills'), 'personal')) {
    if (!skills.has(s.name)) skills.set(s.name, s);
  }

  // Personal agents
  for (const a of scanAgentsDir(path.join(claudeHome, 'agents'))) {
    agents.set(a.name, a);
  }

  // Personal MCP servers
  for (const m of scanMcpJsonFile(path.join(claudeHome, '.mcp.json'), 'personal')) {
    mcpServers.set(m.name, m);
  }

  // Plugin sources
  const settingsPath = path.join(claudeHome, 'settings.json');
  for (const { plugin, marketplace } of getEnabledPlugins(settingsPath)) {
    const pluginDir = path.join(claudeHome, 'plugins/cache', marketplace, plugin);
    let version: string;
    try {
      version = resolvePluginVersion(pluginDir);
    } catch {
      continue;
    }
    const versionDir = path.join(pluginDir, version);

    for (const s of scanSkillsDir(path.join(versionDir, 'skills'), 'plugin', plugin)) {
      if (!skills.has(s.name)) skills.set(s.name, s);
    }

    for (const m of scanMcpJsonFile(path.join(versionDir, '.mcp.json'), 'plugin', plugin)) {
      if (!mcpServers.has(m.name)) mcpServers.set(m.name, m);
    }
  }

  return { skills, agents, mcpServers };
}
```

- [ ] **Step 5: Run test to verify it passes**

```bash
pnpm test __tests__/copilot/sources.test.ts
```

Expected: PASS (6 tests).

- [ ] **Step 6: Commit**

```bash
git add scripts/lib/copilot/sources.ts __tests__/copilot/sources.test.ts __tests__/copilot/fixtures/sources
git commit -m "feat(copilot-port): scan ~/.claude/ with plugin version resolution"
```

### Task 6: Implement claudemd-to-instructions translator

**Files:**
- Create: `scripts/lib/copilot/translators/claudemd-to-instructions.ts`
- Create: `__tests__/copilot/claudemd-to-instructions.test.ts`
- Create: `__tests__/copilot/fixtures/claudemd/sample.md`

Per spec §6.3: body copied verbatim with surgical rewrites for agent/skill references and dispatch-table annotation.

- [ ] **Step 1: Create the fixture**

Create `__tests__/copilot/fixtures/claudemd/sample.md`:

```md
# Sample project

## Project agent dispatch

Invoke the named agent before the described action.

| Phase | Trigger | Agent |
|---|---|---|
| Planning | Before invoking writing-plans | architect-reviewer agent |
| Testing | When writing tests | test-automator agent |

## Skill dispatch

| Trigger | Skill |
|---|---|
| Before any feature | superpowers:brainstorming skill |
| Before any git commit | commit-commands:commit skill |
```

- [ ] **Step 2: Write the failing test**

Create `__tests__/copilot/claudemd-to-instructions.test.ts`:

```ts
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { claudemdToInstructions } from '@/scripts/lib/copilot/translators/claudemd-to-instructions';
import type { PortedNames } from '@/scripts/lib/copilot/types';

const FIXTURE = path.resolve(__dirname, 'fixtures/claudemd/sample.md');

describe('claudemdToInstructions', () => {
  it('prepends auto-gen header', () => {
    const source = readFileSync(FIXTURE, 'utf8');
    const out = claudemdToInstructions(source, FIXTURE, new Map() as PortedNames, { target: 'project' });
    expect(out.content.startsWith('<!-- AUTO-GENERATED')).toBe(true);
  });

  it('rewrites "<agent> agent" to /<agent> or @<agent> when agent is ported', () => {
    const source = readFileSync(FIXTURE, 'utf8');
    const ported: PortedNames = new Map([['architect-reviewer', 'agent']]);
    const out = claudemdToInstructions(source, FIXTURE, ported, { target: 'project' });
    expect(out.content).toMatch(/@architect-reviewer|\/architect-reviewer/);
    expect(out.content).not.toContain('architect-reviewer agent');
  });

  it('rewrites "<skill> skill" to /<skill> when skill is ported', () => {
    const source = readFileSync(FIXTURE, 'utf8');
    const ported: PortedNames = new Map([['superpowers:brainstorming', 'skill']]);
    const out = claudemdToInstructions(source, FIXTURE, ported, { target: 'project' });
    expect(out.content).toContain('/superpowers:brainstorming');
  });

  it('writes to .github/copilot-instructions.md when target=project', () => {
    const source = readFileSync(FIXTURE, 'utf8');
    const out = claudemdToInstructions(source, FIXTURE, new Map() as PortedNames, { target: 'project' });
    expect(out.path).toBe('.github/copilot-instructions.md');
  });

  it('annotates dispatch table with auto-trigger warning', () => {
    const source = readFileSync(FIXTURE, 'utf8');
    const out = claudemdToInstructions(source, FIXTURE, new Map() as PortedNames, { target: 'project' });
    expect(out.content.toLowerCase()).toContain('auto-trigger is claude code only');
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

```bash
pnpm test __tests__/copilot/claudemd-to-instructions.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 4: Write the implementation**

Create `scripts/lib/copilot/translators/claudemd-to-instructions.ts`:

```ts
import { autoGenHeader } from '../auto-gen-header';
import type { PortedNames, TranslatorOutput } from '../types';

type Options = {
  /** 'project' → .github/copilot-instructions.md; 'user' → user-level fallback */
  target: 'project' | 'user';
};

const DISPATCH_TABLE_NOTE =
  '\n> **Note:** Auto-trigger is Claude Code only. In Copilot Chat, invoke each prompt manually via `/<name>` or switch to the chat mode via `@<name>`.\n';

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function claudemdToInstructions(
  source: string,
  sourcePath: string,
  portedNames: PortedNames,
  opts: Options,
): TranslatorOutput {
  let body = source;

  for (const [name, kind] of portedNames) {
    if (kind === 'agent') {
      const re = new RegExp(`\\b${escapeRegex(name)}\\s+agent\\b`, 'g');
      body = body.replace(re, `@${name} chat mode (or /${name} for one-shot)`);
    } else {
      const re = new RegExp(`\\b${escapeRegex(name)}\\s+skill\\b`, 'g');
      body = body.replace(re, `/${name}`);
    }
  }

  body = body.replace(/^(##\s+.*dispatch.*)$/gim, `$1${DISPATCH_TABLE_NOTE}`);

  const header = autoGenHeader(sourcePath);
  const content = `${header}\n\n${body}`;

  const outPath = opts.target === 'project'
    ? '.github/copilot-instructions.md'
    : '.copilot-port-output/copilot-user-instructions.md';

  return { path: outPath, content };
}
```

- [ ] **Step 5: Run test to verify it passes**

```bash
pnpm test __tests__/copilot/claudemd-to-instructions.test.ts
```

Expected: PASS (5 tests).

- [ ] **Step 6: Commit**

```bash
git add scripts/lib/copilot/translators/claudemd-to-instructions.ts __tests__/copilot/claudemd-to-instructions.test.ts __tests__/copilot/fixtures/claudemd
git commit -m "feat(copilot-port): translate CLAUDE.md to copilot-instructions.md"
```

### Task 7: Create manifest scaffold

**Files:**
- Create: `scripts/copilot-port.config.ts`

- [ ] **Step 1: Write the manifest with curated initial entries**

Create `scripts/copilot-port.config.ts`:

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

- [ ] **Step 2: Verify it typechecks**

```bash
pnpm typecheck
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add scripts/copilot-port.config.ts
git commit -m "feat(copilot-port): add curated manifest with initial skills/agents/MCP"
```

### Task 8: Build PR-1 entrypoint (claudemd-only)

**Files:**
- Create: `scripts/sync-copilot.ts`

The full entrypoint wires all six translators. PR-1 only calls `claudemd-to-instructions`; later PRs extend it.

- [ ] **Step 1: Write the entrypoint**

Create `scripts/sync-copilot.ts`:

```ts
#!/usr/bin/env tsx
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { config } from './copilot-port.config';
import { scanClaudeSources } from './lib/copilot/sources';
import { claudemdToInstructions } from './lib/copilot/translators/claudemd-to-instructions';
import type { PortedNames, TranslatorOutput } from './lib/copilot/types';

type Flags = {
  dryRun: boolean;
  diff: boolean;
  verbose: boolean;
  only?: string;
};

function parseFlags(argv: string[]): Flags {
  return {
    dryRun: argv.includes('--dry-run'),
    diff: argv.includes('--diff'),
    verbose: argv.includes('--verbose'),
    only: argv.find((a) => a.startsWith('--only='))?.split('=')[1],
  };
}

function expandHome(p: string): string {
  return p.startsWith('~') ? path.join(process.env.HOME ?? '', p.slice(1)) : p;
}

function collectPortedNames(): PortedNames {
  // PR-1: only CLAUDE.md is being ported; portedNames is empty for now.
  // Filled in PR-3 when skills/agents land.
  return new Map();
}

function writeOutput(out: TranslatorOutput, dryRun: boolean) {
  const full = path.resolve(process.cwd(), out.path);
  if (dryRun) {
    console.log(`[dry-run] would write ${out.path} (${out.content.length} bytes)`);
    return;
  }
  mkdirSync(path.dirname(full), { recursive: true });
  writeFileSync(full, out.content, 'utf8');
  console.log(`wrote ${out.path}`);
}

function main() {
  const flags = parseFlags(process.argv.slice(2));
  const _sources = scanClaudeSources();
  const portedNames = collectPortedNames();

  const outputs: TranslatorOutput[] = [];

  if (!flags.only || flags.only === 'instructions') {
    const projectClaudeMdPath = path.resolve(process.cwd(), config.instructions.projectClaudeMd);
    const projectClaudeMd = readFileSync(projectClaudeMdPath, 'utf8');
    outputs.push(
      claudemdToInstructions(projectClaudeMd, projectClaudeMdPath, portedNames, { target: 'project' }),
    );

    const globalPath = expandHome(config.instructions.globalClaudeMd);
    try {
      const globalContent = readFileSync(globalPath, 'utf8');
      outputs.push(
        claudemdToInstructions(globalContent, globalPath, portedNames, { target: 'user' }),
      );
    } catch (e) {
      console.warn(`[warn] global CLAUDE.md not readable at ${globalPath}: ${(e as Error).message}`);
    }
  }

  for (const out of outputs) writeOutput(out, flags.dryRun);
}

main();
```

- [ ] **Step 2: Run it dry**

```bash
pnpm sync:copilot --dry-run
```

Expected: prints "[dry-run] would write .github/copilot-instructions.md (NNN bytes)" and the user-instructions fallback.

- [ ] **Step 3: Run it for real**

```bash
pnpm sync:copilot
```

Expected: prints "wrote .github/copilot-instructions.md" and "wrote .copilot-port-output/copilot-user-instructions.md".

- [ ] **Step 4: Verify generated file**

```bash
head -5 .github/copilot-instructions.md
```

Expected: starts with `<!-- AUTO-GENERATED by scripts/sync-copilot.ts`.

- [ ] **Step 5: Commit**

```bash
git add scripts/sync-copilot.ts .github/copilot-instructions.md
git commit -m "feat(copilot-port): wire entrypoint, emit copilot-instructions.md"
```

### Task 9: Add the full-pipeline snapshot test harness

**Files:**
- Create: `__tests__/copilot/snapshot.test.ts`
- Create: `__tests__/copilot/fixtures/manifest.ts`

Per spec §8.

- [ ] **Step 1: Create the test manifest**

Create `__tests__/copilot/fixtures/manifest.ts`:

```ts
import type { CopilotPortConfig } from '@/scripts/lib/copilot/types';

export const fixtureManifest: CopilotPortConfig = {
  instructions: {
    projectClaudeMd: '__tests__/copilot/fixtures/claudemd/sample.md',
    globalClaudeMd: '__tests__/copilot/fixtures/claudemd/sample.md',
    applyTo: [],
  },
  skills: [],
  agents: [],
  mcp: [],
};
```

- [ ] **Step 2: Write the snapshot test**

Create `__tests__/copilot/snapshot.test.ts`:

```ts
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { claudemdToInstructions } from '@/scripts/lib/copilot/translators/claudemd-to-instructions';
import type { PortedNames } from '@/scripts/lib/copilot/types';
import { fixtureManifest } from './fixtures/manifest';

describe('snapshot: full-pipeline output (PR-1 surface)', () => {
  it('claudemd → copilot-instructions.md matches snapshot', () => {
    const source = readFileSync(
      path.resolve(__dirname, '..', '..', fixtureManifest.instructions.projectClaudeMd),
      'utf8',
    );
    const out = claudemdToInstructions(
      source,
      fixtureManifest.instructions.projectClaudeMd,
      new Map() as PortedNames,
      { target: 'project' },
    );
    expect(out.content).toMatchSnapshot();
  });
});
```

- [ ] **Step 3: Run the snapshot test**

```bash
pnpm test __tests__/copilot/snapshot.test.ts
```

Expected: PASS — snapshot created in `__tests__/copilot/__snapshots__/snapshot.test.ts.snap`.

- [ ] **Step 4: Commit**

```bash
git add __tests__/copilot/snapshot.test.ts __tests__/copilot/fixtures/manifest.ts __tests__/copilot/__snapshots__
git commit -m "test(copilot-port): add full-pipeline snapshot harness"
```

### Task 10: PR-1 smoke test

- [ ] **Step 1: Run the full test suite**

```bash
pnpm test
```

Expected: all tests pass.

- [ ] **Step 2: Run typecheck and lint**

```bash
pnpm typecheck && pnpm check
```

Expected: no errors.

- [ ] **Step 3: Manual smoke test in VS Code**

Open the repo in VS Code with Copilot Chat enabled. In a fresh chat, ask: *"What's the LCP perf budget for this project?"*

Expected: Copilot's response references `< 1.8s on 4G` (the value in the project CLAUDE.md performance budgets table). This confirms `.github/copilot-instructions.md` is being loaded.

PR-1 is done when:
- `pnpm sync:copilot` runs end-to-end
- `.github/copilot-instructions.md` is committed
- VS Code Copilot Chat picks up the file
- All tests pass

No additional commit — the previous commits constitute PR-1.

---

## PR-2 — MCP translator

PR-2 ships `mcp-to-vscode.ts` with handling for all 5 source-shape variants, secret rewriting across env/headers/args/url, and wires MCP into the entrypoint.

### Task 11: Create fixtures for all 5 MCP source variants

**Files:**
- Create: 6 files under `__tests__/copilot/fixtures/mcp/`

- [ ] **Step 1: Write variant A (bare, no wrapper)**

Create `__tests__/copilot/fixtures/mcp/variant-a-bare.json`:

```json
{
  "context7": {
    "command": "npx",
    "args": ["-y", "@upstash/context7-mcp"]
  }
}
```

- [ ] **Step 2: Write variant B (wrapped stdio, no env)**

Create `__tests__/copilot/fixtures/mcp/variant-b-stdio-no-env.json`:

```json
{
  "mcpServers": {
    "chrome-devtools": {
      "command": "npx",
      "args": ["chrome-devtools-mcp@latest"]
    }
  }
}
```

- [ ] **Step 3: Write variant C (wrapped stdio, env with secrets)**

Create `__tests__/copilot/fixtures/mcp/variant-c-stdio-env-secrets.json`:

```json
{
  "mcpServers": {
    "some-server": {
      "command": "npx",
      "args": ["some-mcp-server"],
      "env": {
        "API_KEY": "${SOME_API_KEY}",
        "REGION": "us-east-1"
      }
    }
  }
}
```

- [ ] **Step 4: Write variant D (http, headers with secrets)**

Create `__tests__/copilot/fixtures/mcp/variant-d-http-headers-secrets.json`:

```json
{
  "mcpServers": {
    "postman": {
      "type": "http",
      "url": "https://mcp.postman.com/mcp",
      "headers": {
        "Authorization": "Bearer ${POSTMAN_API_KEY}",
        "X-Source": "claude-code-plugin"
      }
    }
  }
}
```

- [ ] **Step 5: Write variant E (http, OAuth, no secrets)**

Create `__tests__/copilot/fixtures/mcp/variant-e-http-oauth.json`:

```json
{
  "mcpServers": {
    "vercel": {
      "type": "http",
      "url": "https://mcp.vercel.com",
      "note": "Official Vercel MCP server. Uses OAuth."
    }
  }
}
```

- [ ] **Step 6: Write the mixed fixture**

Create `__tests__/copilot/fixtures/mcp/mixed.json`:

```json
{
  "mcpServers": {
    "weird-server": {
      "command": "node",
      "args": ["server.js", "--token=${WEIRD_TOKEN}"],
      "env": {
        "DEBUG_KEY": "${DEBUG_VAL}",
        "STATIC": "yes"
      },
      "url": "https://weird.example/${WEIRD_PATH}",
      "headers": {
        "X-Auth": "Bearer ${ANOTHER_KEY}"
      }
    }
  }
}
```

- [ ] **Step 7: Commit fixtures**

```bash
git add __tests__/copilot/fixtures/mcp
git commit -m "test(copilot-port): add MCP source-shape fixtures for variants A-E + mixed"
```

### Task 12: Implement mcp-to-vscode translator

**Files:**
- Create: `scripts/lib/copilot/translators/mcp-to-vscode.ts`
- Create: `__tests__/copilot/mcp-to-vscode.test.ts`

Per spec §6.4.

- [ ] **Step 1: Write the failing test**

Create `__tests__/copilot/mcp-to-vscode.test.ts`:

```ts
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { mcpToVscode, normalizeServer } from '@/scripts/lib/copilot/translators/mcp-to-vscode';
import type { McpServerSource } from '@/scripts/lib/copilot/types';

const FIXTURES = path.resolve(__dirname, 'fixtures/mcp');

function loadVariant(filename: string, serverName: string): McpServerSource {
  const raw = JSON.parse(readFileSync(path.join(FIXTURES, filename), 'utf8'));
  const servers = raw.mcpServers ?? raw;
  return {
    name: serverName,
    path: path.join(FIXTURES, filename),
    config: servers[serverName],
    origin: 'plugin',
    plugin: 'test',
  };
}

describe('normalizeServer (per source variant)', () => {
  it('A: bare wrapper, stdio, no env', () => {
    const src = loadVariant('variant-a-bare.json', 'context7');
    const { server, inputs } = normalizeServer(src);
    expect(server.type).toBe('stdio');
    expect(server.command).toBe('npx');
    expect(server.args).toEqual(['-y', '@upstash/context7-mcp']);
    expect(inputs).toEqual([]);
  });

  it('B: wrapped stdio, no env', () => {
    const src = loadVariant('variant-b-stdio-no-env.json', 'chrome-devtools');
    const { server, inputs } = normalizeServer(src);
    expect(server.type).toBe('stdio');
    expect(server.command).toBe('npx');
    expect(inputs).toEqual([]);
  });

  it('C: stdio with env secrets — rewrites ${SECRET} to ${input:SECRET}', () => {
    const src = loadVariant('variant-c-stdio-env-secrets.json', 'some-server');
    const { server, inputs } = normalizeServer(src);
    expect(server.type).toBe('stdio');
    expect((server.env as Record<string, string>).API_KEY).toBe('${input:SOME_API_KEY}');
    expect((server.env as Record<string, string>).REGION).toBe('us-east-1');
    expect(inputs).toContainEqual({
      type: 'promptString',
      id: 'SOME_API_KEY',
      description: 'Value for SOME_API_KEY',
      password: true,
    });
  });

  it('D: http with headers secrets — rewrites Bearer ${X}', () => {
    const src = loadVariant('variant-d-http-headers-secrets.json', 'postman');
    const { server, inputs } = normalizeServer(src);
    expect(server.type).toBe('http');
    expect(server.url).toBe('https://mcp.postman.com/mcp');
    expect((server.headers as Record<string, string>).Authorization).toBe('Bearer ${input:POSTMAN_API_KEY}');
    expect((server.headers as Record<string, string>)['X-Source']).toBe('claude-code-plugin');
    expect(inputs.some((i) => i.id === 'POSTMAN_API_KEY')).toBe(true);
  });

  it('E: http OAuth — no inputs, strips note field', () => {
    const src = loadVariant('variant-e-http-oauth.json', 'vercel');
    const { server, inputs } = normalizeServer(src);
    expect(server.type).toBe('http');
    expect(server.url).toBe('https://mcp.vercel.com');
    expect('note' in server).toBe(false);
    expect(inputs).toEqual([]);
  });

  it('mixed: rewrites secrets across env, args, url, headers', () => {
    const src = loadVariant('mixed.json', 'weird-server');
    const { server, inputs } = normalizeServer(src);
    expect((server.env as Record<string, string>).DEBUG_KEY).toBe('${input:DEBUG_VAL}');
    expect((server.args as string[]).join(' ')).toContain('${input:WEIRD_TOKEN}');
    expect(server.url).toBe('https://weird.example/${input:WEIRD_PATH}');
    expect((server.headers as Record<string, string>)['X-Auth']).toBe('Bearer ${input:ANOTHER_KEY}');
    const ids = inputs.map((i) => i.id).sort();
    expect(ids).toEqual(['ANOTHER_KEY', 'DEBUG_VAL', 'WEIRD_PATH', 'WEIRD_TOKEN']);
  });

  it('hard-fails when neither command nor url is present', () => {
    const src: McpServerSource = {
      name: 'broken',
      path: 'fake',
      config: { args: ['x'] },
      origin: 'personal',
    };
    expect(() => normalizeServer(src)).toThrow(/neither command nor url/);
  });
});

describe('mcpToVscode (whole-file output)', () => {
  it('writes to .vscode/mcp.json with inputs and servers keys', () => {
    const sources: McpServerSource[] = [
      loadVariant('variant-a-bare.json', 'context7'),
      loadVariant('variant-d-http-headers-secrets.json', 'postman'),
    ];
    const out = mcpToVscode(sources);
    expect(out.path).toBe('.vscode/mcp.json');
    const parsed = JSON.parse(out.content);
    expect(parsed.servers.context7).toBeDefined();
    expect(parsed.servers.postman).toBeDefined();
    expect(parsed.inputs.some((i: { id: string }) => i.id === 'POSTMAN_API_KEY')).toBe(true);
  });

  it('produces an empty inputs array when no secrets exist', () => {
    const out = mcpToVscode([loadVariant('variant-a-bare.json', 'context7')]);
    const parsed = JSON.parse(out.content);
    expect(parsed.inputs).toEqual([]);
  });

  it('deduplicates inputs across servers', () => {
    const a = loadVariant('variant-d-http-headers-secrets.json', 'postman');
    const b: McpServerSource = { ...a, name: 'postman-2' };
    const out = mcpToVscode([a, b]);
    const parsed = JSON.parse(out.content);
    const ids = parsed.inputs.map((i: { id: string }) => i.id);
    expect(ids.filter((id: string) => id === 'POSTMAN_API_KEY')).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm test __tests__/copilot/mcp-to-vscode.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

Create `scripts/lib/copilot/translators/mcp-to-vscode.ts`:

```ts
import type { McpServerSource, TranslatorOutput } from '../types';

type VscodeInput = {
  type: 'promptString';
  id: string;
  description: string;
  password: boolean;
};

type VscodeServer = {
  type: 'stdio' | 'http';
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  url?: string;
  headers?: Record<string, string>;
};

const SECRET_TOKEN_RE = /\$\{([A-Z_][A-Z0-9_]*)\}/g;

function rewriteSecretsInString(s: string, collected: Set<string>): string {
  return s.replace(SECRET_TOKEN_RE, (_, name) => {
    collected.add(name);
    return `\${input:${name}}`;
  });
}

function rewriteSecretsInMap(
  obj: Record<string, unknown> | undefined,
  collected: Set<string>,
): Record<string, string> | undefined {
  if (!obj) return undefined;
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(obj)) {
    out[k] = typeof v === 'string' ? rewriteSecretsInString(v, collected) : String(v);
  }
  return out;
}

function rewriteSecretsInArray(arr: unknown[] | undefined, collected: Set<string>): string[] | undefined {
  if (!arr) return undefined;
  return arr.map((v) => (typeof v === 'string' ? rewriteSecretsInString(v, collected) : String(v)));
}

export function normalizeServer(src: McpServerSource): { server: VscodeServer; inputs: VscodeInput[] } {
  const config = src.config;
  const hasCommand = typeof config.command === 'string';
  const hasUrl = typeof config.url === 'string';

  if (!hasCommand && !hasUrl) {
    throw new Error(`MCP server '${src.name}' has neither command nor url`);
  }

  const collected = new Set<string>();
  const server: VscodeServer = {
    type: hasUrl ? 'http' : 'stdio',
  };

  if (hasCommand) {
    server.command = config.command as string;
    server.args = rewriteSecretsInArray(config.args as unknown[] | undefined, collected);
    server.env = rewriteSecretsInMap(config.env as Record<string, unknown> | undefined, collected);
  }
  if (hasUrl) {
    server.url = rewriteSecretsInString(config.url as string, collected);
    server.headers = rewriteSecretsInMap(config.headers as Record<string, unknown> | undefined, collected);
  }

  for (const k of Object.keys(server) as (keyof VscodeServer)[]) {
    if (server[k] === undefined) delete server[k];
  }

  const inputs: VscodeInput[] = [...collected].map((id) => ({
    type: 'promptString',
    id,
    description: `Value for ${id}`,
    password: true,
  }));

  return { server, inputs };
}

export function mcpToVscode(sources: McpServerSource[]): TranslatorOutput {
  const inputsById = new Map<string, VscodeInput>();
  const servers: Record<string, VscodeServer> = {};

  for (const src of sources) {
    const { server, inputs } = normalizeServer(src);
    servers[src.name] = server;
    for (const input of inputs) {
      if (!inputsById.has(input.id)) inputsById.set(input.id, input);
    }
  }

  const output = {
    inputs: [...inputsById.values()],
    servers,
  };

  return {
    path: '.vscode/mcp.json',
    content: `${JSON.stringify(output, null, 2)}\n`,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
pnpm test __tests__/copilot/mcp-to-vscode.test.ts
```

Expected: PASS (all tests).

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/copilot/translators/mcp-to-vscode.ts __tests__/copilot/mcp-to-vscode.test.ts
git commit -m "feat(copilot-port): translate MCP servers (variants A-E) to .vscode/mcp.json"
```

### Task 13: Wire MCP into entrypoint

**Files:**
- Modify: `scripts/sync-copilot.ts`

- [ ] **Step 1: Update the entrypoint**

Open `scripts/sync-copilot.ts`. Add this import alongside the existing translator import:

```ts
import { mcpToVscode } from './lib/copilot/translators/mcp-to-vscode';
```

In `main()`, replace `const _sources = scanClaudeSources();` with `const sources = scanClaudeSources();` (drop the underscore prefix). After the existing `instructions` block, add the MCP block:

```ts
  if (!flags.only || flags.only === 'mcp') {
    const wanted = new Set(config.mcp);
    const selected = [...wanted].map((name) => {
      const src = sources.mcpServers.get(name);
      if (!src) {
        throw new Error(
          `MCP server '${name}' not found in personal config or any enabled plugin. Available: ${[...sources.mcpServers.keys()].join(', ')}`,
        );
      }
      return src;
    });
    outputs.push(mcpToVscode(selected));
  }
```

- [ ] **Step 2: Run it**

```bash
pnpm sync:copilot
```

Expected: writes both `.github/copilot-instructions.md` and `.vscode/mcp.json`. No errors.

- [ ] **Step 3: Inspect the generated MCP file**

```bash
cat .vscode/mcp.json
```

Expected: JSON with `inputs:` array (containing `POSTMAN_API_KEY`) and `servers:` containing `context7`, `chrome-devtools`, `postman`, `vercel`.

- [ ] **Step 4: Commit**

```bash
git add scripts/sync-copilot.ts .vscode/mcp.json
git commit -m "feat(copilot-port): wire MCP translator into entrypoint"
```

### Task 14: PR-2 smoke test

- [ ] **Step 1: Full suite**

```bash
pnpm test && pnpm typecheck && pnpm check
```

Expected: all green.

- [ ] **Step 2: Manual smoke test in VS Code**

Open VS Code Copilot Chat. Verify the four MCP servers appear in the chat's tools picker. For each, attempt one operation:
- `context7`: ask "fetch React 19 docs from context7"
- `chrome-devtools`: ask "take a snapshot of localhost:3000" (with `pnpm dev` running)
- `postman`: VS Code prompts for `POSTMAN_API_KEY` on first use
- `vercel`: VS Code prompts for OAuth on first use

PR-2 is done when all four are callable.

---

## PR-3 — Skills + agents translators

PR-3 ships `skill-to-prompt`, `agent-to-chatmode`, `agent-to-prompt`, `refs.ts`, `tool-map.ts`, and wires them into the entrypoint with collision detection.

### Task 15: Implement tool-map

**Files:**
- Create: `scripts/lib/copilot/tool-map.ts`
- Create: `__tests__/copilot/tool-map.test.ts`

- [ ] **Step 1: Write the failing test**

Create `__tests__/copilot/tool-map.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { mapClaudeTools } from '@/scripts/lib/copilot/tool-map';

describe('mapClaudeTools', () => {
  it('maps known Claude tools to Copilot tool IDs', () => {
    const { mapped, dropped } = mapClaudeTools(['Read', 'Write', 'Edit', 'Bash', 'Grep', 'Glob']);
    expect(mapped).toEqual([
      'read_file',
      'create_file',
      'replace_string_in_file',
      'run_in_terminal',
      'grep_search',
      'file_search',
    ]);
    expect(dropped).toEqual([]);
  });

  it('drops unmapped tools and reports them', () => {
    const { mapped, dropped } = mapClaudeTools(['Read', 'TaskCreate', 'Skill', 'ScheduleWakeup']);
    expect(mapped).toEqual(['read_file']);
    expect(dropped.sort()).toEqual(['ScheduleWakeup', 'Skill', 'TaskCreate']);
  });

  it('handles empty input', () => {
    expect(mapClaudeTools([])).toEqual({ mapped: [], dropped: [] });
  });
});
```

- [ ] **Step 2: Run to verify it fails**

```bash
pnpm test __tests__/copilot/tool-map.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Write the implementation**

Create `scripts/lib/copilot/tool-map.ts`:

```ts
const TOOL_MAP: Record<string, string> = {
  Read: 'read_file',
  Write: 'create_file',
  Edit: 'replace_string_in_file',
  Bash: 'run_in_terminal',
  Grep: 'grep_search',
  Glob: 'file_search',
  WebFetch: 'fetch_webpage',
  WebSearch: 'open_simple_browser',
};

export function mapClaudeTools(tools: string[]): { mapped: string[]; dropped: string[] } {
  const mapped: string[] = [];
  const dropped: string[] = [];
  for (const t of tools) {
    if (t in TOOL_MAP) mapped.push(TOOL_MAP[t]);
    else dropped.push(t);
  }
  return { mapped, dropped };
}
```

- [ ] **Step 4: Run to verify it passes**

```bash
pnpm test __tests__/copilot/tool-map.test.ts
```

Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/copilot/tool-map.ts __tests__/copilot/tool-map.test.ts
git commit -m "feat(copilot-port): map Claude tool names to Copilot tool IDs"
```

### Task 16: Implement refs.ts (two-pass [[ref]] resolver)

**Files:**
- Create: `scripts/lib/copilot/refs.ts`
- Create: `__tests__/copilot/refs.test.ts`

Per spec §6.5.

- [ ] **Step 1: Write the failing test**

Create `__tests__/copilot/refs.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import { createRefRewriter } from '@/scripts/lib/copilot/refs';
import type { PortedNames } from '@/scripts/lib/copilot/types';

describe('createRefRewriter', () => {
  it('rewrites [[skill]] to /skill when kind is skill', () => {
    const ported: PortedNames = new Map([['writing-plans', 'skill']]);
    const rw = createRefRewriter(ported);
    expect(rw.rewrite('Use [[writing-plans]] next.')).toBe('Use /writing-plans next.');
  });

  it('rewrites [[agent]] to @agent on first occurrence (with /agent parenthetical) per file', () => {
    const ported: PortedNames = new Map([['code-reviewer', 'agent']]);
    const rw = createRefRewriter(ported);
    const out = rw.rewrite('First [[code-reviewer]] and second [[code-reviewer]].');
    expect(out).toBe('First @code-reviewer (or /code-reviewer) and second @code-reviewer.');
  });

  it('produces a fresh first-occurrence state per rewriter instance', () => {
    const ported: PortedNames = new Map([['code-reviewer', 'agent']]);
    const rw1 = createRefRewriter(ported);
    const rw2 = createRefRewriter(ported);
    expect(rw1.rewrite('[[code-reviewer]]')).toContain('(or /code-reviewer)');
    expect(rw2.rewrite('[[code-reviewer]]')).toContain('(or /code-reviewer)');
  });

  it('replaces unported [[ref]] with HTML comment and emits a warning', () => {
    const ported: PortedNames = new Map();
    const warn = vi.fn();
    const rw = createRefRewriter(ported, { onWarn: warn });
    const out = rw.rewrite('Use [[no-such-skill]] here.');
    expect(out).toContain('<!-- originally referenced [no-such-skill] — not ported -->');
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('no-such-skill'));
  });

  it('does not rewrite prose tool references like "Bash tool"', () => {
    const ported: PortedNames = new Map();
    const rw = createRefRewriter(ported);
    expect(rw.rewrite('uses the Bash tool to run tests')).toBe('uses the Bash tool to run tests');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm test __tests__/copilot/refs.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Write the implementation**

Create `scripts/lib/copilot/refs.ts`:

```ts
import type { PortedNames } from './types';

type RewriterOptions = {
  onWarn?: (message: string) => void;
};

export type RefRewriter = {
  rewrite(text: string): string;
};

export function createRefRewriter(ported: PortedNames, opts: RewriterOptions = {}): RefRewriter {
  const warn = opts.onWarn ?? ((m: string) => console.warn(`[refs] ${m}`));
  const firstOccurrence = new Set<string>();
  const REF = /\[\[([a-zA-Z0-9:_-]+)\]\]/g;

  return {
    rewrite(text: string): string {
      return text.replace(REF, (_match, name: string) => {
        const kind = ported.get(name);
        if (!kind) {
          warn(`[[${name}]] referenced but not in manifest — replacing with HTML comment`);
          return `<!-- originally referenced [${name}] — not ported -->`;
        }
        if (kind === 'agent') {
          if (!firstOccurrence.has(name)) {
            firstOccurrence.add(name);
            return `@${name} (or /${name})`;
          }
          return `@${name}`;
        }
        return `/${name}`;
      });
    },
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
pnpm test __tests__/copilot/refs.test.ts
```

Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/copilot/refs.ts __tests__/copilot/refs.test.ts
git commit -m "feat(copilot-port): two-pass [[ref]] resolver for skill vs agent kinds"
```

### Task 17: Implement skill-to-prompt translator

**Files:**
- Create: `scripts/lib/copilot/translators/skill-to-prompt.ts`
- Create: `__tests__/copilot/skill-to-prompt.test.ts`
- Create: `__tests__/copilot/fixtures/skills/brainstorming-fixture.md`

Per spec §6.1.

- [ ] **Step 1: Create the fixture skill**

Create `__tests__/copilot/fixtures/skills/brainstorming-fixture.md`:

```md
---
name: brainstorming-fixture
description: Use when starting any conversation — establishes how to find and use skills, requiring Skill tool invocation before ANY response including clarifying questions
---

<SUBAGENT-STOP>
If you were dispatched as a subagent, skip this skill.
</SUBAGENT-STOP>

<EXTREMELY-IMPORTANT>
You MUST invoke the Skill tool. This is non-negotiable.
</EXTREMELY-IMPORTANT>

# Brainstorming

Help turn ideas into specs.

After approval, invoke [[writing-plans]] to produce the plan.
```

- [ ] **Step 2: Write the failing test**

Create `__tests__/copilot/skill-to-prompt.test.ts`:

```ts
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { skillToPrompt } from '@/scripts/lib/copilot/translators/skill-to-prompt';
import { parseFrontmatter } from '@/scripts/lib/copilot/frontmatter';
import { createRefRewriter } from '@/scripts/lib/copilot/refs';
import type { SkillSource, PortedNames } from '@/scripts/lib/copilot/types';

const FIXTURE_PATH = path.resolve(__dirname, 'fixtures/skills/brainstorming-fixture.md');

function loadSkill(): SkillSource {
  const raw = readFileSync(FIXTURE_PATH, 'utf8');
  const { data, content } = parseFrontmatter(raw);
  return {
    kind: 'skill',
    name: 'brainstorming-fixture',
    qualifiedName: 'brainstorming-fixture',
    path: FIXTURE_PATH,
    frontmatter: data,
    body: content,
    origin: 'personal',
  };
}

describe('skillToPrompt', () => {
  it('writes to .github/prompts/<name>.prompt.md', () => {
    const skill = loadSkill();
    const out = skillToPrompt(skill, createRefRewriter(new Map() as PortedNames));
    expect(out.path).toBe('.github/prompts/brainstorming-fixture.prompt.md');
  });

  it('strips <SUBAGENT-STOP> blocks', () => {
    const out = skillToPrompt(loadSkill(), createRefRewriter(new Map() as PortedNames));
    expect(out.content).not.toContain('<SUBAGENT-STOP>');
    expect(out.content).not.toContain('dispatched as a subagent');
  });

  it('strips <EXTREMELY-IMPORTANT> blocks', () => {
    const out = skillToPrompt(loadSkill(), createRefRewriter(new Map() as PortedNames));
    expect(out.content).not.toContain('<EXTREMELY-IMPORTANT>');
    expect(out.content).not.toContain('non-negotiable');
  });

  it('rewrites [[ref]] when ported', () => {
    const ported: PortedNames = new Map([['writing-plans', 'skill']]);
    const out = skillToPrompt(loadSkill(), createRefRewriter(ported));
    expect(out.content).toContain('/writing-plans');
    expect(out.content).not.toContain('[[writing-plans]]');
  });

  it('prepends auto-gen header', () => {
    const out = skillToPrompt(loadSkill(), createRefRewriter(new Map() as PortedNames));
    expect(out.content).toMatch(/^<!-- AUTO-GENERATED/);
  });

  it('emits valid YAML frontmatter with mode: agent', () => {
    const out = skillToPrompt(loadSkill(), createRefRewriter(new Map() as PortedNames));
    expect(out.content).toMatch(/^<!--[\s\S]*?-->\n\n---\n/);
    expect(out.content).toContain('mode: agent');
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

```bash
pnpm test __tests__/copilot/skill-to-prompt.test.ts
```

Expected: FAIL.

- [ ] **Step 4: Write the implementation**

Create `scripts/lib/copilot/translators/skill-to-prompt.ts`:

```ts
import { autoGenHeader } from '../auto-gen-header';
import { emitPromptFrontmatter } from '../frontmatter';
import type { RefRewriter } from '../refs';
import type { SkillSource, TranslatorOutput } from '../types';

const STRIP_TAGS = ['SUBAGENT-STOP', 'EXTREMELY-IMPORTANT', 'EXTREMELY_IMPORTANT'];

function stripTagBlocks(body: string): string {
  let out = body;
  for (const tag of STRIP_TAGS) {
    const re = new RegExp(`<${tag}>[\\s\\S]*?<\\/${tag}>`, 'gi');
    out = out.replace(re, '');
  }
  out = out.replace(/^.*invoke the Skill tool.*$/gim, '');
  out = out.replace(/\n{3,}/g, '\n\n');
  return out;
}

export function skillToPrompt(source: SkillSource, rw: RefRewriter): TranslatorOutput {
  const fmDescription = (source.frontmatter.description as string | undefined) ?? '';
  const userFacingDescription =
    `Manually-invoked prompt — Copilot does not auto-trigger by description. ` +
    `Original Claude Code skill: ${source.qualifiedName}.`;

  const fm = emitPromptFrontmatter({
    mode: 'agent',
    description: userFacingDescription,
  });

  const stripped = stripTagBlocks(source.body);
  const rewritten = rw.rewrite(stripped);

  const whenToUse = fmDescription ? `\n\n## When to use\n\n${fmDescription}\n` : '';

  const header = autoGenHeader(source.path);
  const content = `${header}\n\n${fm}\n${whenToUse}${rewritten}\n`;

  return { path: `.github/prompts/${source.name}.prompt.md`, content };
}
```

- [ ] **Step 5: Run test to verify it passes**

```bash
pnpm test __tests__/copilot/skill-to-prompt.test.ts
```

Expected: PASS (6 tests).

- [ ] **Step 6: Commit**

```bash
git add scripts/lib/copilot/translators/skill-to-prompt.ts __tests__/copilot/skill-to-prompt.test.ts __tests__/copilot/fixtures/skills
git commit -m "feat(copilot-port): translate skills to .github/prompts/<name>.prompt.md"
```

### Task 18: Implement agent-to-chatmode translator

**Files:**
- Create: `scripts/lib/copilot/translators/agent-to-chatmode.ts`
- Create: `__tests__/copilot/agent-to-chatmode.test.ts`
- Create: `__tests__/copilot/fixtures/agents/reviewer-fixture.md`

Per spec §6.2.

- [ ] **Step 1: Create the agent fixture**

Create `__tests__/copilot/fixtures/agents/reviewer-fixture.md`:

```md
---
name: reviewer-fixture
description: Reviews code for quality issues
tools: [Read, Grep, Glob, Bash]
---

You are a code reviewer. When invoked, read the diff and report issues.
```

- [ ] **Step 2: Write the failing test**

Create `__tests__/copilot/agent-to-chatmode.test.ts`:

```ts
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { agentToChatmode } from '@/scripts/lib/copilot/translators/agent-to-chatmode';
import { parseFrontmatter } from '@/scripts/lib/copilot/frontmatter';
import type { AgentSource } from '@/scripts/lib/copilot/types';

const FIXTURE_PATH = path.resolve(__dirname, 'fixtures/agents/reviewer-fixture.md');

function loadAgent(): AgentSource {
  const raw = readFileSync(FIXTURE_PATH, 'utf8');
  const { data, content } = parseFrontmatter(raw);
  return {
    kind: 'agent',
    name: 'reviewer-fixture',
    path: FIXTURE_PATH,
    frontmatter: data,
    body: content,
  };
}

describe('agentToChatmode', () => {
  it('writes to .github/chatmodes/<name>.chatmode.md', () => {
    expect(agentToChatmode(loadAgent()).path).toBe('.github/chatmodes/reviewer-fixture.chatmode.md');
  });

  it('preserves agent body verbatim', () => {
    const out = agentToChatmode(loadAgent());
    expect(out.content).toContain('You are a code reviewer');
    expect(out.content).toContain('read the diff and report issues');
  });

  it('maps Claude tool names to Copilot tool IDs in frontmatter', () => {
    const out = agentToChatmode(loadAgent());
    expect(out.content).toContain('read_file');
    expect(out.content).toContain('grep_search');
    expect(out.content).toContain('file_search');
    expect(out.content).toContain('run_in_terminal');
  });

  it('emits empty tools array when agent has no tools frontmatter', () => {
    const a: AgentSource = {
      kind: 'agent',
      name: 'no-tools',
      path: 'fake.md',
      frontmatter: { description: 'no tools' },
      body: 'body',
    };
    expect(agentToChatmode(a).content).toContain('tools:');
  });

  it('prepends auto-gen header', () => {
    expect(agentToChatmode(loadAgent()).content).toMatch(/^<!-- AUTO-GENERATED/);
  });

  it('includes divergence note about prose tool references', () => {
    const out = agentToChatmode(loadAgent());
    expect(out.content.toLowerCase()).toContain('prose may reference claude code tool names');
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

```bash
pnpm test __tests__/copilot/agent-to-chatmode.test.ts
```

Expected: FAIL.

- [ ] **Step 4: Write the implementation**

Create `scripts/lib/copilot/translators/agent-to-chatmode.ts`:

```ts
import { autoGenHeader } from '../auto-gen-header';
import { emitChatmodeFrontmatter } from '../frontmatter';
import { mapClaudeTools } from '../tool-map';
import type { AgentSource, TranslatorOutput } from '../types';

const DIVERGENCE_NOTE =
  '<!-- Frontmatter `tools:` reflects Copilot tool IDs; prose may reference Claude Code tool names. -->';

export function agentToChatmode(source: AgentSource): TranslatorOutput {
  const fmDescription = (source.frontmatter.description as string | undefined) ?? source.name;
  const claudeTools = Array.isArray(source.frontmatter.tools)
    ? (source.frontmatter.tools as string[])
    : [];
  const { mapped } = mapClaudeTools(claudeTools);

  const fm = emitChatmodeFrontmatter({
    description: fmDescription,
    tools: mapped,
    model: (source.frontmatter.model as string | undefined) ?? undefined,
  });

  const header = autoGenHeader(source.path);
  const content = `${header}\n${DIVERGENCE_NOTE}\n\n${fm}\n\n${source.body.trim()}\n`;

  return { path: `.github/chatmodes/${source.name}.chatmode.md`, content };
}
```

- [ ] **Step 5: Run test to verify it passes**

```bash
pnpm test __tests__/copilot/agent-to-chatmode.test.ts
```

Expected: PASS (6 tests).

- [ ] **Step 6: Commit**

```bash
git add scripts/lib/copilot/translators/agent-to-chatmode.ts __tests__/copilot/agent-to-chatmode.test.ts __tests__/copilot/fixtures/agents
git commit -m "feat(copilot-port): translate agents to .github/chatmodes/<name>.chatmode.md"
```

### Task 19: Implement agent-to-prompt translator

**Files:**
- Create: `scripts/lib/copilot/translators/agent-to-prompt.ts`
- Create: `__tests__/copilot/agent-to-prompt.test.ts`

Per spec §6.2.

- [ ] **Step 1: Write the failing test**

Create `__tests__/copilot/agent-to-prompt.test.ts`:

```ts
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { agentToPrompt } from '@/scripts/lib/copilot/translators/agent-to-prompt';
import { parseFrontmatter } from '@/scripts/lib/copilot/frontmatter';
import { createRefRewriter } from '@/scripts/lib/copilot/refs';
import type { AgentSource, PortedNames } from '@/scripts/lib/copilot/types';

const FIXTURE_PATH = path.resolve(__dirname, 'fixtures/agents/reviewer-fixture.md');

function loadAgent(): AgentSource {
  const raw = readFileSync(FIXTURE_PATH, 'utf8');
  const { data, content } = parseFrontmatter(raw);
  return {
    kind: 'agent',
    name: 'reviewer-fixture',
    path: FIXTURE_PATH,
    frontmatter: data,
    body: content,
  };
}

describe('agentToPrompt', () => {
  it('writes to .github/prompts/<name>.prompt.md', () => {
    const out = agentToPrompt(loadAgent(), createRefRewriter(new Map() as PortedNames));
    expect(out.path).toBe('.github/prompts/reviewer-fixture.prompt.md');
  });

  it('wraps body with one-shot framing', () => {
    const out = agentToPrompt(loadAgent(), createRefRewriter(new Map() as PortedNames));
    expect(out.content.toLowerCase()).toContain('for this single response, act as');
  });

  it('emits mode: agent in prompt frontmatter', () => {
    const out = agentToPrompt(loadAgent(), createRefRewriter(new Map() as PortedNames));
    expect(out.content).toContain('mode: agent');
  });

  it('maps tools in frontmatter', () => {
    const out = agentToPrompt(loadAgent(), createRefRewriter(new Map() as PortedNames));
    expect(out.content).toContain('read_file');
  });

  it('rewrites [[ref]] in body', () => {
    const a: AgentSource = {
      kind: 'agent',
      name: 'x',
      path: 'fake.md',
      frontmatter: {},
      body: 'See [[code-reviewer]] for guidance.',
    };
    const ported: PortedNames = new Map([['code-reviewer', 'agent']]);
    const out = agentToPrompt(a, createRefRewriter(ported));
    expect(out.content).toContain('@code-reviewer');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm test __tests__/copilot/agent-to-prompt.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Write the implementation**

Create `scripts/lib/copilot/translators/agent-to-prompt.ts`:

```ts
import { autoGenHeader } from '../auto-gen-header';
import { emitPromptFrontmatter } from '../frontmatter';
import type { RefRewriter } from '../refs';
import { mapClaudeTools } from '../tool-map';
import type { AgentSource, TranslatorOutput } from '../types';

export function agentToPrompt(source: AgentSource, rw: RefRewriter): TranslatorOutput {
  const fmDescription = (source.frontmatter.description as string | undefined) ?? source.name;
  const claudeTools = Array.isArray(source.frontmatter.tools)
    ? (source.frontmatter.tools as string[])
    : [];
  const { mapped } = mapClaudeTools(claudeTools);

  const fm = emitPromptFrontmatter({
    mode: 'agent',
    description: `One-shot invocation: ${fmDescription}`,
    tools: mapped,
    model: (source.frontmatter.model as string | undefined) ?? undefined,
  });

  const rewritten = rw.rewrite(source.body.trim());
  const framing = `For this single response, act as the **${source.name}** agent. Persona:\n\n`;

  const header = autoGenHeader(source.path);
  const content = `${header}\n\n${fm}\n\n${framing}${rewritten}\n`;

  return { path: `.github/prompts/${source.name}.prompt.md`, content };
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
pnpm test __tests__/copilot/agent-to-prompt.test.ts
```

Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/copilot/translators/agent-to-prompt.ts __tests__/copilot/agent-to-prompt.test.ts
git commit -m "feat(copilot-port): translate agents to one-shot .github/prompts/<name>.prompt.md"
```

### Task 20: Wire skills + agents into entrypoint with collision detection

**Files:**
- Modify: `scripts/sync-copilot.ts`

Per spec §6.5 and §6.6.

- [ ] **Step 1: Update the entrypoint**

Open `scripts/sync-copilot.ts`. At the top, add these imports alongside the existing translator imports:

```ts
import { createRefRewriter } from './lib/copilot/refs';
import { agentToChatmode } from './lib/copilot/translators/agent-to-chatmode';
import { agentToPrompt } from './lib/copilot/translators/agent-to-prompt';
import { skillToPrompt } from './lib/copilot/translators/skill-to-prompt';
import type { SkillSource, AgentSource } from './lib/copilot/types';
```

Replace the existing `collectPortedNames` function with:

```ts
function resolveSkillsAndAgents(sources: ReturnType<typeof scanClaudeSources>) {
  const resolvedSkills: SkillSource[] = [];
  const resolvedAgents: AgentSource[] = [];

  for (const name of config.skills) {
    const bareName = name.includes(':') ? name.split(':')[1] : name;
    const s = sources.skills.get(bareName);
    if (!s) {
      throw new Error(
        `skill '${name}' not found. Available: ${[...sources.skills.keys()].slice(0, 20).join(', ')}…`,
      );
    }
    resolvedSkills.push(s);
  }

  for (const name of config.agents) {
    const a = sources.agents.get(name);
    if (!a) {
      throw new Error(
        `agent '${name}' not found. Available: ${[...sources.agents.keys()].join(', ')}`,
      );
    }
    resolvedAgents.push(a);
  }

  return { resolvedSkills, resolvedAgents };
}

function detectCollisions(skills: SkillSource[], agents: AgentSource[]): Map<string, number> {
  const counts = new Map<string, number>();
  const allNames = [...skills.map((s) => s.name), ...agents.map((a) => a.name)];
  for (const n of allNames) counts.set(n, (counts.get(n) ?? 0) + 1);
  const collisions = new Map<string, number>();
  for (const [name, count] of counts) {
    if (count > 1) collisions.set(name, count);
  }
  return collisions;
}

function collectPortedNames(skills: SkillSource[], agents: AgentSource[]): PortedNames {
  const m: PortedNames = new Map();
  for (const s of skills) m.set(s.name, 'skill');
  for (const a of agents) m.set(a.name, 'agent');
  return m;
}
```

Replace the entire `main()` function with:

```ts
function main() {
  const flags = parseFlags(process.argv.slice(2));
  const sources = scanClaudeSources();
  const { resolvedSkills, resolvedAgents } = resolveSkillsAndAgents(sources);

  // Pass 1 — collect ported names + detect collisions
  const portedNames = collectPortedNames(resolvedSkills, resolvedAgents);
  const collisions = detectCollisions(resolvedSkills, resolvedAgents);
  if (collisions.size > 0) {
    console.warn(`[warn] name collisions detected: ${[...collisions.keys()].join(', ')}. Using bare names; consider plugin prefixes in manifest.`);
  }

  // Pass 2 — translate
  const outputs: TranslatorOutput[] = [];

  if (!flags.only || flags.only === 'instructions') {
    const projectClaudeMdPath = path.resolve(process.cwd(), config.instructions.projectClaudeMd);
    const projectClaudeMd = readFileSync(projectClaudeMdPath, 'utf8');
    outputs.push(
      claudemdToInstructions(projectClaudeMd, projectClaudeMdPath, portedNames, { target: 'project' }),
    );

    const globalPath = expandHome(config.instructions.globalClaudeMd);
    try {
      const globalContent = readFileSync(globalPath, 'utf8');
      outputs.push(
        claudemdToInstructions(globalContent, globalPath, portedNames, { target: 'user' }),
      );
    } catch (e) {
      console.warn(`[warn] global CLAUDE.md not readable at ${globalPath}: ${(e as Error).message}`);
    }
  }

  if (!flags.only || flags.only === 'skills') {
    const rw = createRefRewriter(portedNames);
    for (const s of resolvedSkills) outputs.push(skillToPrompt(s, rw));
  }

  if (!flags.only || flags.only === 'agents') {
    const rw = createRefRewriter(portedNames);
    for (const a of resolvedAgents) {
      outputs.push(agentToChatmode(a));
      outputs.push(agentToPrompt(a, rw));
    }
  }

  if (!flags.only || flags.only === 'mcp') {
    const wanted = new Set(config.mcp);
    const selected = [...wanted].map((name) => {
      const src = sources.mcpServers.get(name);
      if (!src) {
        throw new Error(
          `MCP server '${name}' not found. Available: ${[...sources.mcpServers.keys()].join(', ')}`,
        );
      }
      return src;
    });
    outputs.push(mcpToVscode(selected));
  }

  for (const out of outputs) writeOutput(out, flags.dryRun);
}

main();
```

- [ ] **Step 2: Run it**

```bash
pnpm sync:copilot
```

Expected: writes instructions, MCP, plus `.github/prompts/<each skill>.prompt.md`, `.github/prompts/<each agent>.prompt.md`, `.github/chatmodes/<each agent>.chatmode.md`. Hard-fails clearly if any manifest entry is missing.

- [ ] **Step 3: Verify structure**

```bash
ls .github/prompts/ && ls .github/chatmodes/
```

Expected: one `.prompt.md` per skill (13), one `.prompt.md` per agent (11), one `.chatmode.md` per agent (11).

- [ ] **Step 4: Commit**

```bash
git add scripts/sync-copilot.ts .github/prompts .github/chatmodes
git commit -m "feat(copilot-port): wire skills + agents translators with collision detection"
```

### Task 21: PR-3 smoke test

- [ ] **Step 1: Run all tests**

```bash
pnpm test && pnpm typecheck && pnpm check
```

Expected: all green.

- [ ] **Step 2: Smoke test in VS Code**

Open Copilot Chat. Type `/` in the chat input. Verify each manifest entry appears: `/brainstorming`, `/writing-plans`, `/architect-reviewer`, `/code-reviewer`, etc.

Switch chat mode by typing `@architect-reviewer`. Verify the mode loads.

Invoke `/code-reviewer` with a recent commit's diff. Verify it produces a sensible review.

PR-3 is done when:
- `/` palette lists every manifest entry
- At least one chat mode (`@architect-reviewer`) is selectable
- At least one prompt produces sensible output

---

## PR-4 — applyTo + drift gates

PR-4 ships `applyto-to-instructions.ts`, the pre-commit hook for local regeneration, `scripts/check-copilot-drift.ts` for the cache-independent CI gate, the CI workflow step, and an extended snapshot test.

### Task 22: Implement applyto-to-instructions translator

**Files:**
- Create: `scripts/lib/copilot/translators/applyto-to-instructions.ts`
- Create: `__tests__/copilot/applyto-to-instructions.test.ts`

Per spec §5.

- [ ] **Step 1: Write the failing test**

Create `__tests__/copilot/applyto-to-instructions.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { applyToToInstructions } from '@/scripts/lib/copilot/translators/applyto-to-instructions';
import type { ApplyToEntry, SkillSource, SourceIndex } from '@/scripts/lib/copilot/types';

function emptyIndex(): SourceIndex {
  return { skills: new Map(), agents: new Map(), mcpServers: new Map() };
}

const fakeSkill: SkillSource = {
  kind: 'skill',
  name: 'fake-skill',
  qualifiedName: 'fake-skill',
  path: 'fake-skill.md',
  frontmatter: { description: 'a fake skill' },
  body: '## Use this skill when X.\n\nDo Y.',
  origin: 'personal',
};

describe('applyToToInstructions', () => {
  it('writes to .github/instructions/<name>.instructions.md', () => {
    const entry: ApplyToEntry = { name: 'foo', applyTo: 'src/**', body: 'rule' };
    expect(applyToToInstructions(entry, emptyIndex()).path).toBe('.github/instructions/foo.instructions.md');
  });

  it('emits applyTo glob in frontmatter', () => {
    const entry: ApplyToEntry = { name: 'foo', applyTo: 'src/**', body: 'rule' };
    expect(applyToToInstructions(entry, emptyIndex()).content).toContain("applyTo: 'src/**'");
  });

  it('uses inline body when provided', () => {
    const entry: ApplyToEntry = { name: 'foo', applyTo: 'src/**', body: 'inline rule body' };
    expect(applyToToInstructions(entry, emptyIndex()).content).toContain('inline rule body');
  });

  it('extracts body from sourceSkill when provided', () => {
    const idx = emptyIndex();
    idx.skills.set('fake-skill', fakeSkill);
    const entry: ApplyToEntry = { name: 'foo', applyTo: 'src/**', sourceSkill: 'fake-skill' };
    const out = applyToToInstructions(entry, idx);
    expect(out.content).toContain('Use this skill when X');
    expect(out.content).toContain('Do Y');
  });

  it('hard-fails when sourceSkill is not found', () => {
    const entry: ApplyToEntry = { name: 'foo', applyTo: 'src/**', sourceSkill: 'nope' };
    expect(() => applyToToInstructions(entry, emptyIndex())).toThrow(/sourceSkill 'nope' not found/);
  });

  it('hard-fails when both sourceSkill and body are provided', () => {
    const entry: ApplyToEntry = {
      name: 'foo',
      applyTo: 'src/**',
      sourceSkill: 'fake-skill',
      body: 'x',
    };
    const idx = emptyIndex();
    idx.skills.set('fake-skill', fakeSkill);
    expect(() => applyToToInstructions(entry, idx)).toThrow(/exactly one of/);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

```bash
pnpm test __tests__/copilot/applyto-to-instructions.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Write the implementation**

Create `scripts/lib/copilot/translators/applyto-to-instructions.ts`:

```ts
import { autoGenHeader } from '../auto-gen-header';
import { emitInstructionsFrontmatter } from '../frontmatter';
import type { ApplyToEntry, SourceIndex, TranslatorOutput } from '../types';

export function applyToToInstructions(entry: ApplyToEntry, sources: SourceIndex): TranslatorOutput {
  const hasBody = typeof entry.body === 'string' && entry.body.length > 0;
  const hasSkill = typeof entry.sourceSkill === 'string' && entry.sourceSkill.length > 0;

  if (hasBody === hasSkill) {
    throw new Error(
      `applyTo entry '${entry.name}': exactly one of \`body\` or \`sourceSkill\` is required (both or neither were provided)`,
    );
  }

  let body: string;
  let sourcePath: string;
  if (hasSkill) {
    const bareName = entry.sourceSkill!.includes(':')
      ? entry.sourceSkill!.split(':')[1]
      : entry.sourceSkill!;
    const skill = sources.skills.get(bareName);
    if (!skill) {
      throw new Error(`applyTo entry '${entry.name}': sourceSkill '${entry.sourceSkill}' not found`);
    }
    body = skill.body.trim();
    sourcePath = skill.path;
  } else {
    body = entry.body!;
    sourcePath = `inline body in scripts/copilot-port.config.ts (entry: ${entry.name})`;
  }

  const fm = emitInstructionsFrontmatter({ applyTo: entry.applyTo });
  const header = autoGenHeader(sourcePath);
  const content = `${header}\n\n${fm}\n\n${body}\n`;

  return { path: `.github/instructions/${entry.name}.instructions.md`, content };
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
pnpm test __tests__/copilot/applyto-to-instructions.test.ts
```

Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/copilot/translators/applyto-to-instructions.ts __tests__/copilot/applyto-to-instructions.test.ts
git commit -m "feat(copilot-port): translate applyTo entries to .github/instructions/"
```

### Task 23: Wire applyTo into entrypoint

**Files:**
- Modify: `scripts/sync-copilot.ts`

- [ ] **Step 1: Add the applyTo import + block**

Open `scripts/sync-copilot.ts`. Add this import:

```ts
import { applyToToInstructions } from './lib/copilot/translators/applyto-to-instructions';
```

In `main()`, after the agents block and before the MCP block, add:

```ts
  if (!flags.only || flags.only === 'applyto') {
    for (const entry of config.instructions.applyTo) {
      outputs.push(applyToToInstructions(entry, sources));
    }
  }
```

- [ ] **Step 2: Run it**

```bash
pnpm sync:copilot
```

Expected: writes 4 instructions files: `react`, `tests`, `api-routes`, `content`.

- [ ] **Step 3: Inspect output**

```bash
head -10 .github/instructions/react.instructions.md
```

Expected: auto-gen header, then `applyTo: 'components/**,app/**/*.tsx'` frontmatter, then body extracted from the `react-best-practices` skill.

- [ ] **Step 4: Commit**

```bash
git add scripts/sync-copilot.ts .github/instructions
git commit -m "feat(copilot-port): wire applyTo translator into entrypoint"
```

### Task 24: Implement check-copilot-drift.ts (CI drift gate)

**Files:**
- Create: `scripts/check-copilot-drift.ts`
- Create: `__tests__/copilot/check-drift.test.ts`

Per spec §9.2. Uses `execFileSync` (no shell, no command injection risk) rather than `execSync`.

- [ ] **Step 1: Write the failing test**

Create `__tests__/copilot/check-drift.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { analyzeDrift } from '@/scripts/check-copilot-drift';

describe('analyzeDrift', () => {
  it('passes when no source files changed', () => {
    expect(analyzeDrift(['README.md', 'package.json']).ok).toBe(true);
  });

  it('passes when source changed AND generated changed in same diff', () => {
    expect(analyzeDrift(['CLAUDE.md', '.github/copilot-instructions.md']).ok).toBe(true);
  });

  it('fails when CLAUDE.md changed without any generated file', () => {
    const r = analyzeDrift(['CLAUDE.md']);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/CLAUDE\.md.*regenerate/);
  });

  it('fails when manifest changed without any generated file', () => {
    const r = analyzeDrift(['scripts/copilot-port.config.ts']);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/copilot-port\.config\.ts.*regenerate/);
  });

  it('accepts any matching generated artifact', () => {
    expect(analyzeDrift(['CLAUDE.md', '.github/prompts/foo.prompt.md']).ok).toBe(true);
    expect(analyzeDrift(['CLAUDE.md', '.github/chatmodes/x.chatmode.md']).ok).toBe(true);
    expect(analyzeDrift(['CLAUDE.md', '.github/instructions/y.instructions.md']).ok).toBe(true);
    expect(analyzeDrift(['CLAUDE.md', '.vscode/mcp.json']).ok).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm test __tests__/copilot/check-drift.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Write the implementation**

Create `scripts/check-copilot-drift.ts`:

```ts
#!/usr/bin/env tsx
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { hasAutoGenHeader } from './lib/copilot/auto-gen-header';

const SOURCE_PATTERNS = [/^CLAUDE\.md$/, /^scripts\/copilot-port\.config\.ts$/];

const GENERATED_PATTERNS = [
  /^\.github\/copilot-instructions\.md$/,
  /^\.github\/prompts\//,
  /^\.github\/chatmodes\//,
  /^\.github\/instructions\//,
  /^\.vscode\/mcp\.json$/,
];

export type DriftResult = { ok: true } | { ok: false; reason: string };

export function analyzeDrift(changedFiles: string[]): DriftResult {
  const sourceChanged = changedFiles.find((f) => SOURCE_PATTERNS.some((re) => re.test(f)));
  if (!sourceChanged) return { ok: true };

  const generatedChanged = changedFiles.some((f) => GENERATED_PATTERNS.some((re) => re.test(f)));
  if (generatedChanged) return { ok: true };

  return {
    ok: false,
    reason: `${sourceChanged} changed but no generated files updated. Run \`pnpm sync:copilot\` and commit the regenerated files.`,
  };
}

async function readDirSafe(p: string): Promise<string[]> {
  try {
    return await readdir(p);
  } catch {
    return [];
  }
}

async function listGeneratedFiles(): Promise<string[]> {
  const files: string[] = [];
  if ((await readDirSafe('.github')).includes('copilot-instructions.md')) {
    files.push('.github/copilot-instructions.md');
  }
  for (const subdir of ['prompts', 'chatmodes', 'instructions']) {
    const entries = await readDirSafe(path.join('.github', subdir));
    for (const e of entries) files.push(path.join('.github', subdir, e));
  }
  return files;
}

async function verifyAutoGenHeaders(): Promise<DriftResult> {
  const files = await listGeneratedFiles();
  const missing: string[] = [];
  for (const f of files) {
    const content = readFileSync(f, 'utf8');
    if (!hasAutoGenHeader(content)) missing.push(f);
  }
  if (missing.length > 0) {
    return {
      ok: false,
      reason: `Generated files missing auto-gen header: ${missing.join(', ')}. Did someone hand-edit them?`,
    };
  }
  return { ok: true };
}

async function main() {
  const range = process.argv[2];
  if (!range) {
    console.error('Usage: tsx scripts/check-copilot-drift.ts <git-diff-range>');
    process.exit(2);
  }

  // execFileSync avoids shell — no command injection even with attacker-controlled range.
  let changed: string[];
  try {
    const out = execFileSync('git', ['diff', '--name-only', range], { encoding: 'utf8' });
    changed = out.split('\n').filter(Boolean);
  } catch (e) {
    console.error(`git diff failed: ${(e as Error).message}`);
    process.exit(2);
  }

  const driftResult = analyzeDrift(changed);
  if (!driftResult.ok) {
    console.error(`DRIFT FAIL: ${driftResult.reason}`);
    process.exit(1);
  }

  const headerResult = await verifyAutoGenHeaders();
  if (!headerResult.ok) {
    console.error(`HEADER FAIL: ${headerResult.reason}`);
    process.exit(1);
  }

  console.log('Copilot port drift check: OK');
}

const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain) main();
```

- [ ] **Step 4: Run test to verify it passes**

```bash
pnpm test __tests__/copilot/check-drift.test.ts
```

Expected: PASS (5 tests).

- [ ] **Step 5: Smoke-test the script locally**

```bash
pnpm tsx scripts/check-copilot-drift.ts HEAD~1..HEAD
```

Expected: prints `Copilot port drift check: OK`.

- [ ] **Step 6: Commit**

```bash
git add scripts/check-copilot-drift.ts __tests__/copilot/check-drift.test.ts
git commit -m "feat(copilot-port): add CI drift gate (cache-independent name + header check)"
```

### Task 25: Wire pre-commit hook for local regeneration

**Files:**
- Modify: `.husky/pre-commit`

Per spec §9.1.

- [ ] **Step 1: View current pre-commit hook**

```bash
cat .husky/pre-commit
```

Read the existing content to know what to preserve.

- [ ] **Step 2: Append the regeneration block**

Append to `.husky/pre-commit` (preserve all existing content):

```sh

# Copilot port — regenerate when source changes (spec §9.1)
if git diff --cached --name-only | grep -qE '^(CLAUDE\.md|scripts/copilot-port\.config\.ts)$'; then
  echo "[pre-commit] Copilot source changed — regenerating .github/* and .vscode/mcp.json"
  pnpm sync:copilot
  git add .github/copilot-instructions.md \
          .github/prompts \
          .github/chatmodes \
          .github/instructions \
          .vscode/mcp.json
fi
```

- [ ] **Step 3: Smoke-test the hook**

Make a trivial edit to `CLAUDE.md`, stage, and try to commit:

```bash
echo "" >> CLAUDE.md
git add CLAUDE.md
git commit -m "test: pre-commit hook smoke test"
```

Expected: pre-commit output includes `[pre-commit] Copilot source changed — regenerating`. The commit succeeds with regenerated files included.

After verifying, undo:

```bash
git reset HEAD~1
git checkout CLAUDE.md
```

- [ ] **Step 4: Commit the hook**

```bash
git add .husky/pre-commit
git commit -m "chore(copilot-port): regenerate Copilot outputs on source change in pre-commit"
```

### Task 26: Add CI workflow step

**Files:**
- Modify: `.github/workflows/ci.yml`

- [ ] **Step 1: Inspect the existing CI workflow**

```bash
cat .github/workflows/ci.yml
```

Locate where existing test/typecheck steps run.

- [ ] **Step 2: Add the drift-check step**

After the existing `pnpm test` step (or equivalent gating step), insert:

```yaml
      - name: Verify Copilot port artifacts in sync
        run: pnpm tsx scripts/check-copilot-drift.ts ${{ github.event.pull_request.base.sha || 'HEAD~1' }}..HEAD
```

- [ ] **Step 3: Verify YAML is valid**

```bash
python3 -c "import yaml; yaml.safe_load(open('.github/workflows/ci.yml'))"
```

Expected: no parse errors.

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci(copilot-port): add cache-independent drift gate to CI"
```

### Task 27: Extend snapshot test to cover all surfaces

**Files:**
- Modify: `__tests__/copilot/snapshot.test.ts`

- [ ] **Step 1: Replace the snapshot test**

Replace the contents of `__tests__/copilot/snapshot.test.ts` with:

```ts
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { createRefRewriter } from '@/scripts/lib/copilot/refs';
import { parseFrontmatter } from '@/scripts/lib/copilot/frontmatter';
import { agentToChatmode } from '@/scripts/lib/copilot/translators/agent-to-chatmode';
import { agentToPrompt } from '@/scripts/lib/copilot/translators/agent-to-prompt';
import { applyToToInstructions } from '@/scripts/lib/copilot/translators/applyto-to-instructions';
import { claudemdToInstructions } from '@/scripts/lib/copilot/translators/claudemd-to-instructions';
import { mcpToVscode } from '@/scripts/lib/copilot/translators/mcp-to-vscode';
import { skillToPrompt } from '@/scripts/lib/copilot/translators/skill-to-prompt';
import type {
  AgentSource,
  McpServerSource,
  PortedNames,
  SkillSource,
  SourceIndex,
} from '@/scripts/lib/copilot/types';
import { fixtureManifest } from './fixtures/manifest';

function loadSkillFixture(p: string): SkillSource {
  const raw = readFileSync(p, 'utf8');
  const { data, content } = parseFrontmatter(raw);
  return {
    kind: 'skill',
    name: (data.name as string) ?? path.basename(p, '.md'),
    qualifiedName: (data.name as string) ?? path.basename(p, '.md'),
    path: p,
    frontmatter: data,
    body: content,
    origin: 'personal',
  };
}

function loadAgentFixture(p: string): AgentSource {
  const raw = readFileSync(p, 'utf8');
  const { data, content } = parseFrontmatter(raw);
  return {
    kind: 'agent',
    name: (data.name as string) ?? path.basename(p, '.md'),
    path: p,
    frontmatter: data,
    body: content,
  };
}

describe('snapshot: full-pipeline output', () => {
  it('claudemd → copilot-instructions.md', () => {
    const source = readFileSync(
      path.resolve(__dirname, '..', '..', fixtureManifest.instructions.projectClaudeMd),
      'utf8',
    );
    const out = claudemdToInstructions(
      source,
      fixtureManifest.instructions.projectClaudeMd,
      new Map() as PortedNames,
      { target: 'project' },
    );
    expect(out.content).toMatchSnapshot();
  });

  it('skill → prompt.md', () => {
    const skill = loadSkillFixture(path.resolve(__dirname, 'fixtures/skills/brainstorming-fixture.md'));
    const rw = createRefRewriter(new Map() as PortedNames);
    expect(skillToPrompt(skill, rw).content).toMatchSnapshot();
  });

  it('agent → chatmode.md', () => {
    const agent = loadAgentFixture(path.resolve(__dirname, 'fixtures/agents/reviewer-fixture.md'));
    expect(agentToChatmode(agent).content).toMatchSnapshot();
  });

  it('agent → prompt.md', () => {
    const agent = loadAgentFixture(path.resolve(__dirname, 'fixtures/agents/reviewer-fixture.md'));
    const rw = createRefRewriter(new Map() as PortedNames);
    expect(agentToPrompt(agent, rw).content).toMatchSnapshot();
  });

  it('mcp → mcp.json', () => {
    const fixtureDir = path.resolve(__dirname, 'fixtures/mcp');
    const sources: McpServerSource[] = [
      {
        name: 'context7',
        path: path.join(fixtureDir, 'variant-a-bare.json'),
        config: JSON.parse(readFileSync(path.join(fixtureDir, 'variant-a-bare.json'), 'utf8')).context7,
        origin: 'plugin',
        plugin: 'context7',
      },
      {
        name: 'postman',
        path: path.join(fixtureDir, 'variant-d-http-headers-secrets.json'),
        config: JSON.parse(readFileSync(path.join(fixtureDir, 'variant-d-http-headers-secrets.json'), 'utf8')).mcpServers.postman,
        origin: 'plugin',
        plugin: 'postman',
      },
    ];
    expect(mcpToVscode(sources).content).toMatchSnapshot();
  });

  it('applyTo (inline body) → instructions.md', () => {
    const idx: SourceIndex = { skills: new Map(), agents: new Map(), mcpServers: new Map() };
    const out = applyToToInstructions(
      { name: 'snap', applyTo: 'src/**', body: 'rule X' },
      idx,
    );
    expect(out.content).toMatchSnapshot();
  });
});
```

- [ ] **Step 2: Update snapshots**

```bash
pnpm test __tests__/copilot/snapshot.test.ts -u
```

Expected: all snapshots regenerated. PASS.

- [ ] **Step 3: Run once more without -u to confirm stable**

```bash
pnpm test __tests__/copilot/snapshot.test.ts
```

Expected: PASS without changes.

- [ ] **Step 4: Commit**

```bash
git add __tests__/copilot/snapshot.test.ts __tests__/copilot/__snapshots__
git commit -m "test(copilot-port): extend snapshot to cover all six translator outputs"
```

### Task 28: PR-4 final smoke test + docs note

**Files:**
- Modify: `README.md` (if present) or create `docs/superpowers/notes/copilot-port-usage.md`

- [ ] **Step 1: Final full-suite run**

```bash
pnpm ci:local
```

Expected: lint + typecheck + test all green.

- [ ] **Step 2: Add usage note**

If `README.md` exists, append a section. Otherwise create `docs/superpowers/notes/copilot-port-usage.md`:

```md
# Copilot port (Claude Code harness mirrored to VS Code Copilot)

Source: `~/.claude/` skills, agents, CLAUDE.md, MCP servers. Manifest in `scripts/copilot-port.config.ts`.

- `pnpm sync:copilot` — regenerate `.github/{copilot-instructions.md,prompts/,chatmodes/,instructions/}` and `.vscode/mcp.json`.
- The pre-commit hook regenerates automatically when `CLAUDE.md` or the manifest changes.
- CI verifies (cache-independently) that any PR touching source also commits generated artifacts.
- See `docs/superpowers/specs/2026-05-18-claude-to-copilot-port-design.md` for design.
- Periodically run `pnpm sync:copilot` to absorb upstream plugin-content changes (these don't trigger the pre-commit hook).
```

- [ ] **Step 3: Smoke-test all PR-4 criteria**

Manual verification per spec §13.1:
- Open `components/sections/Hero.tsx` in VS Code. Ask Copilot to "refactor this for clarity." Verify the response shows it loaded React guidance.
- Open `app/api/ask/route.ts`. Ask Copilot to "add input validation." Verify response shows it loaded `api-routes.instructions.md` content.

- [ ] **Step 4: Commit**

```bash
git add README.md docs/superpowers/notes/copilot-port-usage.md
git commit -m "docs(copilot-port): document sync workflow and pre-commit behavior"
```

PR-4 is done when:
- `pnpm sync:copilot` round-trips with no diff
- `pnpm tsx scripts/check-copilot-drift.ts HEAD~1..HEAD` passes
- applyTo rules verified loading in VS Code
- All tests + lint + typecheck green
- README/docs updated

---

## Self-review checklist (performed by the planner, not by an agent)

**Spec coverage:**
- §1-3 (Problem, Scope, Fidelity map): documentation; no tasks needed
- §4 File layout: covered by Tasks 2, 5, 8, 12, 13, 17, 18, 19, 22, 23
- §5 Manifest: Task 7
- §6.1 Skill → Prompt: Task 17
- §6.2 Agent → Chat mode + Prompt: Tasks 18, 19
- §6.3 CLAUDE.md → instructions: Task 6
- §6.4 MCP: Tasks 11, 12
- §6.5 [[ref]] resolution: Task 16
- §6.6 Name collision: Task 20 (collision detection in entrypoint)
- §6.7 Frontmatter pinning + emitters: Task 4
- §7 Data flow: Tasks 8, 13, 20, 23
- §7.1 Plugin version resolution: Task 5
- §8 Testing strategy: Tasks 9, 27
- §9.1 Pre-commit hook: Task 25
- §9.2 CI drift gate: Tasks 24, 26
- §9.3 Out of scope for drift: documented in Task 28
- §10 Edge cases: handled in Tasks 5, 12, 16, 17, 18
- §11 PR sequence: matches Tasks 1-10 (PR-1), 11-14 (PR-2), 15-21 (PR-3), 22-28 (PR-4)
- §12 Gotchas: documented in code/comments and the docs note in Task 28
- §13.1 Author smoke tests: Tasks 10, 14, 21, 28
- §13.2 CI-gated criteria: Tasks 24, 26 (drift + header), Task 9/27 (snapshot + unit tests)
- §14 Open questions: none
- §15 Future work: out of scope

**Placeholder scan:** No "TBD", "TODO", "implement later", "similar to Task N". Every code step contains complete, runnable code.

**Type consistency:**
- `PortedNames` is `Map<string, SourceKind>` (= `Map<string, 'skill' | 'agent'>`) — used consistently in Tasks 6, 16, 17, 19, 20.
- `TranslatorOutput` is `{ path: string; content: string }` — used in every translator (Tasks 6, 12, 17, 18, 19, 22).
- `SourceIndex` is `{ skills, agents, mcpServers }` (all Maps) — used in Tasks 5, 20, 22.
- `RefRewriter` has `rewrite(text: string): string` — used in Tasks 16, 17, 19.
- `createRefRewriter(ported, opts?)` signature consistent across Tasks 16, 17, 19, 27.

**Security review:**
- `scripts/check-copilot-drift.ts` uses `execFileSync('git', [...args])` — no shell, no command-injection risk.
- The pre-commit hook is a `git` pipe — `grep -qE` pattern is anchored and uses fixed patterns; no user input flows into shell-interpreted positions.

No inconsistencies found.

---

## Execution handoff

Plan complete and saved to `docs/superpowers/plans/2026-05-18-claude-to-copilot-port.md`. Two execution options:

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration. Lower risk of context drift; each task gets full attention.

**2. Inline Execution** — Execute tasks in this session using `superpowers:executing-plans`, batch execution with checkpoints. Faster if you're watching live, but more session context pressure.

**Which approach?**
