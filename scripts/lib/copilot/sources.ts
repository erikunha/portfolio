import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import semver from 'semver';
import { parseFrontmatter } from './frontmatter';
import type { AgentSource, McpServerSource, SkillSource, SourceIndex } from './types';

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
    const sorted = semverDirs.sort(semver.rcompare);
    const winner = sorted[0];
    if (winner !== undefined) return winner;
  }

  const byMtime = entries
    .map((e) => ({ name: e, mtime: statSync(path.join(pluginDir, e)).mtimeMs }))
    .sort((a, b) => {
      if (b.mtime !== a.mtime) return b.mtime - a.mtime;
      if (a.name === 'unknown') return 1;
      if (b.name === 'unknown') return -1;
      return a.name.localeCompare(b.name);
    });
  const top = byMtime[0];
  if (top !== undefined) return top.name;
  throw new Error(`no version dirs in ${pluginDir}`);
}

function loadMarkdownFile(filePath: string): { data: Record<string, unknown>; body: string } {
  const raw = readFileSync(filePath, 'utf8');
  const { data, content } = parseFrontmatter(raw);
  return { data, body: content };
}

function makeSkillSource(
  kind: 'skill',
  name: string,
  qualifiedName: string,
  filePath: string,
  data: Record<string, unknown>,
  body: string,
  origin: 'personal' | 'plugin',
  plugin: string | undefined,
): SkillSource {
  if (plugin !== undefined) {
    return { kind, name, qualifiedName, path: filePath, frontmatter: data, body, origin, plugin };
  }
  return { kind, name, qualifiedName, path: filePath, frontmatter: data, body, origin };
}

function makeMcpSource(
  name: string,
  filePath: string,
  config: Record<string, unknown>,
  origin: 'personal' | 'plugin',
  plugin: string | undefined,
): McpServerSource {
  if (plugin !== undefined) {
    return { name, path: filePath, config, origin, plugin };
  }
  return { name, path: filePath, config, origin };
}

function scanSkillsDir(
  skillsDir: string,
  origin: 'personal' | 'plugin',
  plugin?: string,
): SkillSource[] {
  let entries: string[];
  try {
    entries = readdirSync(skillsDir);
  } catch {
    return [];
  }
  const out: SkillSource[] = [];
  for (const entry of entries) {
    const entryPath = path.join(skillsDir, entry);
    let stat: ReturnType<typeof statSync>;
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
        out.push(
          makeSkillSource(
            'skill',
            name,
            plugin ? `${plugin}:${name}` : name,
            skillFile,
            data,
            body,
            origin,
            plugin,
          ),
        );
      } catch {
        // No SKILL.md in this dir — skip.
      }
    } else if (entry.endsWith('.md')) {
      const name = entry.replace(/\.md$/, '');
      try {
        const { data, body } = loadMarkdownFile(entryPath);
        const skillName = (data.name as string) || name;
        out.push(
          makeSkillSource(
            'skill',
            skillName,
            plugin ? `${plugin}:${skillName}` : skillName,
            entryPath,
            data,
            body,
            origin,
            plugin,
          ),
        );
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

function scanMcpJsonFile(
  filePath: string,
  origin: 'personal' | 'plugin',
  plugin?: string,
): McpServerSource[] {
  let raw: string;
  try {
    raw = readFileSync(filePath, 'utf8');
  } catch {
    return [];
  }
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return [];
  }
  // Per spec §6.4.2, accept both wrapped {"mcpServers": {...}} and bare {"name": {...}} shapes
  const servers = (parsed.mcpServers as Record<string, unknown>) ?? parsed;
  const out: McpServerSource[] = [];
  for (const [name, config] of Object.entries(servers)) {
    if (typeof config !== 'object' || config === null) continue;
    out.push(makeMcpSource(name, filePath, config as Record<string, unknown>, origin, plugin));
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
    parsed = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return [];
  }
  const enabled = (parsed.enabledPlugins as Record<string, boolean>) ?? {};
  const result: Array<{ plugin: string; marketplace: string }> = [];
  for (const [key, v] of Object.entries(enabled)) {
    if (v !== true) continue;
    const atIdx = key.indexOf('@');
    if (atIdx === -1) continue;
    const plugin = key.slice(0, atIdx);
    const marketplace = key.slice(atIdx + 1);
    if (plugin && marketplace) {
      result.push({ plugin, marketplace });
    }
  }
  return result;
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
